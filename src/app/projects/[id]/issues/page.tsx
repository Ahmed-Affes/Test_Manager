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
import { formatDate } from '@/lib/utils';
import { logAuditEvent } from '@/lib/audit';

export default function IssuesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [issues, setIssues] = React.useState<any[]>([]);
  const [testCases, setTestCases] = React.useState<TestCase[]>([]);
  const [environments, setEnvironments] = React.useState<Environment[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [severityFilter, setSeverityFilter] = React.useState('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [retestActiveCase, setRetestActiveCase] = React.useState<TestCase | null>(null);
  const [retestActiveIssue, setRetestActiveIssue] = React.useState<Issue | null>(null);

  const fetchIssues = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data: issuesData, error } = await supabase
        .from('issues')
        .select(`
          *,
          test_case:test_cases(id, key, title, steps:test_steps(*)),
          test_run:test_runs(id, run_number, status)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) console.error('Fetch issues error:', error);

      const { data: casesData } = await supabase
        .from('test_cases')
        .select('*')
        .eq('project_id', projectId);

      const { data: envsData } = await supabase
        .from('environments')
        .select('*')
        .eq('project_id', projectId);

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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: proj } = await supabase
      .from('projects')
      .select('key')
      .eq('id', projectId)
      .single();

    const { count } = await supabase
      .from('issues')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    const issueKey = `${proj?.key || 'BUG'}-BUG-${(count || 0) + 1}`;

    const { data: newIssue, error } = await supabase
      .from('issues')
      .insert({
        project_id: projectId,
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
      projectId,
      action: 'create_issue',
      entityType: 'issue',
      entityId: newIssue.id,
      details: { issue_key: issueKey, title: issueData.title },
    });

    await fetchIssues();
  };

  const handleRetestRunSaved = async (runData: any) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 1. Insert retest run
    const { count } = await supabase
      .from('test_runs')
      .select('*', { count: 'exact', head: true })
      .eq('test_case_id', runData.test_case_id);

    const runNumber = (count || 0) + 1;

    const { data: newRun, error: runErr } = await supabase
      .from('test_runs')
      .insert({
        project_id: projectId,
        test_case_id: runData.test_case_id,
        run_number: runNumber,
        status: runData.status,
        duration_ms: runData.duration_ms,
        environment_id: runData.environment_id || null,
        actual_result: runData.actual_result || null,
        notes: `Retest verification for issue ${retestActiveIssue?.issue_key}`,
        executed_by: user?.id,
      })
      .select()
      .single();

    if (runErr) throw runErr;

    // 2. If the retest passed, mark the issue resolved/closed!
    if (retestActiveIssue && runData.status === 'passed') {
      await supabase
        .from('issues')
        .update({
          status: 'resolved',
          resolution: `Verified passed in Run #${runNumber}`,
        })
        .eq('id', retestActiveIssue.id);

      await logAuditEvent({
        projectId,
        action: 'resolve_issue',
        entityType: 'issue',
        entityId: retestActiveIssue.id,
        details: {
          issue_key: retestActiveIssue.issue_key,
          resolved_by_run_id: newRun.id,
        },
      });
    }

    setRetestActiveCase(null);
    setRetestActiveIssue(null);
    await fetchIssues();
  };

  // KPIs
  const totalIssues = issues.length;
  const openIssues = issues.filter((i) => i.status === 'open' || i.status === 'in_progress').length;
  const blockerIssues = issues.filter(
    (i) => (i.severity === 'blocker' || i.severity === 'critical') && i.status !== 'resolved' && i.status !== 'closed'
  ).length;
  const resolvedIssues = issues.filter((i) => i.status === 'resolved' || i.status === 'closed').length;

  const filteredIssues = issues.filter((i) => {
    const matchesSearch =
      i.issue_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.root_cause && i.root_cause.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' || i.severity === severityFilter;

    return matchesSearch && matchesStatus && matchesSeverity;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Bug className="h-5 w-5 text-rose-500" />
            Defects & Discrepancies
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
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

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <span className="text-[11px] font-mono text-zinc-400 uppercase">Open Defects</span>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">{openIssues}</div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <span className="text-[11px] font-mono text-zinc-400 uppercase">Blocker / Critical</span>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-1">{blockerIssues}</div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <span className="text-[11px] font-mono text-zinc-400 uppercase">Verified Resolved</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{resolvedIssues}</div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <span className="text-[11px] font-mono text-zinc-400 uppercase">Total Logged</span>
          <div className="text-2xl font-bold font-mono text-zinc-100 mt-1">{totalIssues}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by bug key, title, root cause..."
            className="pl-9 h-8 text-xs bg-zinc-900/60 border-zinc-800"
          />
        </div>

        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-36 h-8 text-xs bg-zinc-900/60 border-zinc-800"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
          <option value="rejected">Rejected</option>
        </Select>

        <Select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="w-36 h-8 text-xs bg-zinc-900/60 border-zinc-800"
        >
          <option value="all">All Severities</option>
          <option value="blocker">Blocker</option>
          <option value="critical">Critical</option>
          <option value="major">Major</option>
          <option value="minor">Minor</option>
          <option value="trivial">Trivial</option>
        </Select>

        <span className="text-xs text-zinc-500 font-mono ml-auto">
          {filteredIssues.length} defects
        </span>
      </div>

      {/* Issues Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-zinc-900/40 border border-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-xl border-zinc-800 bg-zinc-900/20 space-y-2">
          <Bug className="h-8 w-8 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-300">No Defects Found</h3>
          <p className="text-xs text-zinc-500">
            {issues.length === 0
              ? 'Zero defects filed for this project. Clean verification bill of health.'
              : 'No defects match the selected filters.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-medium">
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
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {filteredIssues.map((issue) => (
                <tr key={issue.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="p-3 font-bold text-rose-400">
                    {issue.issue_key}
                  </td>

                  <td className="p-3 font-sans">
                    <div className="space-y-0.5">
                      <span className="font-medium text-zinc-200 block">
                        {issue.title}
                      </span>
                      {issue.test_case && (
                        <Link
                          href={`/projects/${projectId}/tests/${issue.test_case.id}`}
                          className="text-[11px] font-mono text-blue-400 hover:underline inline-flex items-center gap-1"
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
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {issue.severity}
                    </span>
                  </td>

                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-medium ${
                        issue.status === 'resolved' || issue.status === 'closed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : issue.status === 'in_progress'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {issue.status}
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
                    {issue.test_case ? (
                      <RetestButton
                        issue={issue}
                        testCase={issue.test_case}
                        onTriggerRetest={() => {
                          setRetestActiveCase(issue.test_case);
                          setRetestActiveIssue(issue);
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
