'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Bug,
  Plus,
  Search,
  Filter,
  AlertOctagon,
  CheckCircle2,
  Clock,
  ArrowRight,
  GitCommit,
} from 'lucide-react';
import { Issue, TestCase, Environment } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { IssueModal } from '@/components/issues/IssueModal';
import { RetestButton } from '@/components/issues/RetestButton';
import { TestRunnerModal } from '@/components/execution/TestRunnerModal';
import { formatDate, resolveProjectId } from '@/lib/utils';
import { logAuditEvent } from '@/lib/audit';

export default function IssuesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [issues, setIssues] = React.useState<any[]>([]);
  const [testCases, setTestCases] = React.useState<TestCase[]>([]);
  const [environments, setEnvironments] = React.useState<Environment[]>([]);
  const [resolvedProjectId, setResolvedProjectId] = React.useState<string>(projectId);
  const [loading, setLoading] = React.useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('active');
  const [severityFilter, setSeverityFilter] = React.useState('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [retestActiveCase, setRetestActiveCase] = React.useState<TestCase | null>(null);
  const [retestActiveIssue, setRetestActiveIssue] = React.useState<Issue | null>(null);

  const fetchIssues = React.useCallback(async () => {
    setLoading(true);
    try {
      const pId = await resolveProjectId(supabase, projectId);
      setResolvedProjectId(pId);

      const { data: issuesData, error } = await supabase
        .from('issues')
        .select(`
          *,
          test_case:test_cases(id, key, title, steps:test_steps(*)),
          test_run:test_runs(id, run_number, status)
        `)
        .eq('project_id', pId)
        .order('created_at', { ascending: false });

      if (error) console.error('Fetch issues error:', error);

      const { data: casesData } = await supabase
        .from('test_cases')
        .select('*')
        .eq('project_id', pId);

      const { data: envsData } = await supabase
        .from('environments')
        .select('*')
        .eq('project_id', pId);

      setIssues(issuesData || []);
      setTestCases(casesData || []);
      setEnvironments(envsData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  React.useEffect(() => {
    if (projectId) {
      fetchIssues();
    }
  }, [projectId, fetchIssues]);

  const handleSaveIssue = async (issueData: any) => {
    const pId = await resolveProjectId(supabase, projectId);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: proj } = await supabase
      .from('projects')
      .select('key')
      .eq('id', pId)
      .single();

    const { count } = await supabase
      .from('issues')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', pId);

    const issueKey = `${proj?.key || 'BUG'}-BUG-${(count || 0) + 1}`;

    const { data: newIssue, error } = await supabase
      .from('issues')
      .insert({
        project_id: pId,
        issue_key: issueKey,
        title: issueData.title,
        description: issueData.description || null,
        test_case_id: issueData.test_case_id || null,
        severity: issueData.severity,
        priority: issueData.priority,
        status: issueData.status,
        root_cause: issueData.root_cause || null,
        fix_description: issueData.fix_description || null,
        related_commit: issueData.related_commit || null,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) throw error;

    await logAuditEvent({
      projectId: pId,
      action: 'create_issue',
      entityType: 'issue',
      entityId: newIssue.id,
      details: { issue_key: issueKey, title: issueData.title },
    });

    await fetchIssues();
  };

  const handleRetestRunSaved = async (runData: any) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/retest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issue_id: retestActiveIssue?.id,
          test_case_id: runData.test_case_id,
          status: runData.status,
          duration_ms: runData.duration_ms,
          actual_result: runData.actual_result,
          notes: runData.notes,
          environment_id: runData.environment_id,
          application_version: runData.application_version,
          build_number: runData.build_number,
          branch: runData.branch,
          commit_sha: runData.commit_sha,
          step_results: runData.step_results,
        }),
      });

      if (!res.ok) {
        console.error('Retest API error:', await res.json());
      }
    } catch (err) {
      console.error('Failed to submit retest:', err);
    } finally {
      setRetestActiveCase(null);
      setRetestActiveIssue(null);
      await fetchIssues();
    }
  };

  // Helper: check if issue is closed/resolved/fixed
  const isIssueClosed = (status: string) => status === 'closed' || status === 'resolved' || status === 'fixed';

  // KPIs
  const totalIssues = issues.length;
  const openIssues = issues.filter(
    (i) => !isIssueClosed(i.status) && i.status !== 'rejected' && i.status !== 'wont_fix'
  ).length;
  const blockerIssues = issues.filter(
    (i) => (i.severity === 'blocker' || i.severity === 'critical') && !isIssueClosed(i.status) && i.status !== 'rejected' && i.status !== 'wont_fix'
  ).length;
  const resolvedIssues = issues.filter((i) => isIssueClosed(i.status)).length;

  const filteredIssues = issues.filter((i) => {
    const matchesSearch =
      i.issue_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.root_cause && i.root_cause.toLowerCase().includes(searchQuery.toLowerCase()));

    const isClosed = isIssueClosed(i.status);
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
        ? !isClosed && i.status !== 'rejected' && i.status !== 'wont_fix'
        : statusFilter === 'resolved'
        ? isClosed
        : i.status === statusFilter;

    const matchesSeverity = severityFilter === 'all' || i.severity === severityFilter;

    return matchesSearch && matchesStatus && matchesSeverity;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Bug className="h-5 w-5 text-rose-500" />
            Crash & Defect Issues
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Test-linked defects, verification discrepancies, root causes, and retest validation
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsCreateModalOpen(true)}
          className="gap-1.5 self-start sm:self-auto bg-rose-600 hover:bg-rose-700 text-white"
        >
          <Plus className="h-4 w-4" />
          Report Defect
        </Button>
      </div>

      {/* KPI Stats - Clickable Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => { setStatusFilter('active'); setSeverityFilter('all'); }}
          className={`p-4 rounded-xl border text-left transition-all shadow-sm cursor-pointer ${
            statusFilter === 'active'
              ? 'border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/30'
              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase">Open Defects</span>
          <div className="text-2xl font-bold font-mono text-amber-500 dark:text-amber-400 mt-1">{openIssues}</div>
        </button>

        <button
          type="button"
          onClick={() => { setSeverityFilter('critical'); }}
          className={`p-4 rounded-xl border text-left transition-all shadow-sm cursor-pointer ${
            severityFilter === 'critical'
              ? 'border-rose-500/60 bg-rose-500/10 ring-1 ring-rose-500/30'
              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase">Blocker / Critical</span>
          <div className="text-2xl font-bold font-mono text-rose-500 dark:text-rose-400 mt-1">{blockerIssues}</div>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter('resolved'); setSeverityFilter('all'); }}
          className={`p-4 rounded-xl border text-left transition-all shadow-sm cursor-pointer ${
            statusFilter === 'resolved'
              ? 'border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/30'
              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase">Verified Resolved</span>
          <div className="text-2xl font-bold font-mono text-emerald-500 dark:text-emerald-400 mt-1">{resolvedIssues}</div>
        </button>

        <button
          type="button"
          onClick={() => { setStatusFilter('all'); setSeverityFilter('all'); }}
          className={`p-4 rounded-xl border text-left transition-all shadow-sm cursor-pointer ${
            statusFilter === 'all' && severityFilter === 'all'
              ? 'border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800/50 ring-1 ring-zinc-400/30'
              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase">Total Logged</span>
          <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">{totalIssues}</div>
        </button>
      </div>

      {/* Quick Segment Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700/60 w-fit">
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            Active Defects ({openIssues})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('resolved')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              statusFilter === 'resolved'
                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            Verified Resolved ({resolvedIssues})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            All ({totalIssues})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search defects..."
              className="pl-9 h-8 text-xs"
            />
          </div>

          <Select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="w-36 h-8 text-xs"
          >
            <option value="all">All Severities</option>
            <option value="blocker">Blocker</option>
            <option value="critical">Critical</option>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
            <option value="trivial">Trivial</option>
          </Select>

          <span className="text-xs text-zinc-500 font-mono hidden md:inline ml-2 whitespace-nowrap">
            {filteredIssues.length} showing
          </span>
        </div>
      </div>

      {/* Issues Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-zinc-100 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-xl border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/20 space-y-2">
          <Bug className="h-8 w-8 text-zinc-400 dark:text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-300">No Defects Logged</h3>
          <p className="text-xs text-zinc-500">
            {issues.length === 0
              ? 'Zero defects filed for this project. Clean verification bill of health.'
              : 'No defects match the selected filters.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
              <tr>
                <th className="p-3 w-32">Key</th>
                <th className="p-3">Title & Linked Test</th>
                <th className="p-3 w-28">Severity</th>
                <th className="p-3 w-28">Status</th>
                <th className="p-3 w-36">Fix Commit</th>
                <th className="p-3 w-32">Date</th>
                <th className="p-3 w-32 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-mono">
              {filteredIssues.map((issue) => (
                <tr key={issue.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className="p-3 font-bold text-rose-500 dark:text-rose-400">
                    {issue.issue_key}
                  </td>

                  <td className="p-3 font-sans">
                    <div className="space-y-0.5">
                      <span className="font-medium text-zinc-900 dark:text-zinc-200 block">
                        {issue.title}
                      </span>
                      {issue.resolution && (
                        <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 inline text-emerald-500 shrink-0" />
                          <span>{issue.resolution}</span>
                        </div>
                      )}
                      {issue.test_case && (
                        <Link
                          href={`/projects/${projectId}/tests/${issue.test_case.id}`}
                          className="text-[11px] font-mono text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                        >
                          <span>Case: {issue.test_case.key}</span>
                          <span className="text-zinc-500 truncate max-w-xs">
                            ({issue.test_case.title})
                          </span>
                        </Link>
                      )}
                    </div>
                  </td>

                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        issue.severity === 'blocker' || issue.severity === 'critical'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {issue.severity}
                    </span>
                  </td>

                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-medium ${
                        isIssueClosed(issue.status)
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : issue.status === 'in_progress'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {issue.status === 'closed' ? 'Closed / Resolved' : issue.status}
                    </span>
                  </td>

                  <td className="p-3 text-zinc-400 text-[11px]">
                    {issue.related_commit ? (
                      <span className="flex items-center gap-1 text-zinc-300">
                        <GitCommit className="h-3 w-3 text-zinc-500" />
                        {issue.related_commit.slice(0, 8)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>

                  <td className="p-3 text-zinc-500 text-[11px]">
                    {formatDate(issue.created_at)}
                  </td>

                  <td className="p-3 text-right font-sans">
                    {isIssueClosed(issue.status) ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold justify-end">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        Verified
                      </span>
                    ) : issue.test_case ? (
                      <RetestButton
                        issue={issue}
                        testCase={issue.test_case}
                        onTriggerRetest={(iss, tc) => {
                          setRetestActiveCase(tc ?? issue.test_case);
                          setRetestActiveIssue(iss);
                        }}
                        size="xs"
                      />
                    ) : (
                      <span className="text-[11px] text-zinc-500 font-mono">No Test</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Issue Modal */}
      <IssueModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        projectId={projectId}
        onSaveIssue={handleSaveIssue}
      />

      {/* Retest Execution Runner Modal */}
      {retestActiveCase && (
        <TestRunnerModal
          isOpen={!!retestActiveCase}
          onClose={() => {
            setRetestActiveCase(null);
            setRetestActiveIssue(null);
          }}
          testCase={retestActiveCase}
          environments={environments}
          onSaveRun={handleRetestRunSaved}
        />
      )}
    </div>
  );
}
