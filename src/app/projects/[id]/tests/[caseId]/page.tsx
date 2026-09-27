'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Play,
  Bug,
  Edit,
  Clock,
  Laptop,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Paperclip,
  GitBranch,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { TestCase, TestRun, Issue, Evidence, Environment, TestSuite } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { TestRunnerModal } from '@/components/execution/TestRunnerModal';
import { TestCaseModal } from '@/components/cases/TestCaseModal';
import { IssueModal } from '@/components/issues/IssueModal';
import { RetestButton } from '@/components/issues/RetestButton';
import { EvidenceGallery } from '@/components/evidence/EvidenceGallery';
import { EvidenceUploader } from '@/components/evidence/EvidenceUploader';
import { formatDate, formatDuration, resolveProjectId } from '@/lib/utils';

export default function TestCaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const caseId = params.caseId as string;
  const supabase = createClient();

  const [testCase, setTestCase] = React.useState<any | null>(null);
  const [runs, setRuns] = React.useState<any[]>([]);
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [evidenceList, setEvidenceList] = React.useState<Evidence[]>([]);
  const [environments, setEnvironments] = React.useState<Environment[]>([]);
  const [suites, setSuites] = React.useState<TestSuite[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Expanded run IDs for inspecting step results
  const [expandedRunIds, setExpandedRunIds] = React.useState<Record<string, boolean>>({});

  // Active tab
  const [activeTab, setActiveTab] = React.useState<'steps' | 'history' | 'issues' | 'evidence'>('steps');

  // Modals & Active Retest
  const [isRunnerOpen, setIsRunnerOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = React.useState(false);
  const [retestingIssue, setRetestingIssue] = React.useState<Issue | null>(null);

  const fetchCaseDetails = React.useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch test case with steps (support UUID or key like TM-001)
      const isCaseUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caseId);
      let caseQuery = supabase
        .from('test_cases')
        .select(`
          *,
          suite:test_suites(id, name),
          steps:test_steps(*)
        `);

      if (isCaseUuid) {
        caseQuery = caseQuery.eq('id', caseId);
      } else {
        caseQuery = caseQuery.ilike('key', caseId);
      }

      const { data: cData, error: cErr } = await caseQuery.single();

      if (cErr) throw cErr;

      const resolvedCaseId = cData.id;
      const resolvedProjectId = cData.project_id;

      // 2. Fetch runs with step results
      const { data: runsData } = await supabase
        .from('test_runs')
        .select(`
          *,
          environment:environments(id, name, os),
          step_results:test_step_results(*)
        `)
        .eq('test_case_id', resolvedCaseId)
        .order('run_number', { ascending: false });

      // 3. Fetch linked issues
      const { data: issuesData } = await supabase
        .from('issues')
        .select('*')
        .eq('test_case_id', resolvedCaseId)
        .order('created_at', { ascending: false });

      // 4. Fetch evidence
      const runIds = (runsData || []).map((r) => r.id);
      let evList: Evidence[] = [];
      if (runIds.length > 0) {
        const { data: evData } = await supabase
          .from('evidence')
          .select('*')
          .in('test_run_id', runIds);
        evList = evData || [];
      }

      // 5. Fetch envs and suites using resolved project UUID
      const { data: envsData } = await supabase
        .from('environments')
        .select('*')
        .eq('project_id', resolvedProjectId);

      const { data: sData } = await supabase
        .from('test_suites')
        .select('*')
        .eq('project_id', resolvedProjectId);

      const sortedRuns = (runsData || []).sort(
        (a: any, b: any) =>
          (b.run_number || 0) - (a.run_number || 0) ||
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTestCase(cData);
      setRuns(sortedRuns);
      setIssues(issuesData || []);
      setEvidenceList(evList);
      setEnvironments(envsData || []);
      setSuites(sData || []);
    } catch (err) {
      console.error('Fetch case detail error:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId, supabase]);

  React.useEffect(() => {
    if (caseId) {
      fetchCaseDetails();
    }
  }, [caseId, fetchCaseDetails]);

  const toggleRunExpand = (runId: string) => {
    setExpandedRunIds((prev) => ({ ...prev, [runId]: !prev[runId] }));
  };

  const handleSaveRun = async (runData: any) => {
    try {
      const resolvedCaseUuid = testCase?.id || caseId;
      const res = await fetch(`/api/projects/${projectId}/retest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issue_id: retestingIssue?.id || null,
          test_case_id: resolvedCaseUuid,
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
        console.error('Failed to save run via retest API:', await res.json());
      }
    } catch (err) {
      console.error('Save run error:', err);
    } finally {
      setRetestingIssue(null);
      await fetchCaseDetails();
      setActiveTab('history');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('issues-updated'));
      }
    }
  };

  const handleSaveIssue = async (issueData: any) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const resolvedCaseUuid = testCase?.id || caseId;
    const pId = testCase?.project_id || (await resolveProjectId(supabase, projectId));

    // Fetch project key for issue key
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

    const { data: newIssue, error: issueErr } = await supabase
      .from('issues')
      .insert({
        project_id: pId,
        issue_key: issueKey,
        title: issueData.title,
        description: issueData.description || null,
        test_case_id: resolvedCaseUuid,
        test_run_id: runs[0]?.id || null,
        severity: issueData.severity,
        priority: issueData.priority,
        status: issueData.status,
        assigned_to: issueData.assigned_to || null,
        root_cause: issueData.root_cause || null,
        fix_description: issueData.fix_description || null,
        related_commit: issueData.related_commit || null,
        resolution: issueData.resolution || null,
        created_by: user?.id,
      })
      .select()
      .single();

    if (issueErr) throw issueErr;

    await fetchCaseDetails();
    setActiveTab('issues');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
        <div className="h-40 bg-zinc-900 rounded-xl border border-zinc-800 animate-pulse" />
      </div>
    );
  }

  if (!testCase) {
    return (
      <div className="p-12 text-center text-zinc-400">
        Test case not found.
      </div>
    );
  }

  const sortedSteps = [...(testCase.steps || [])].sort((a, b) => a.step_number - b.step_number);
  const latestRun = [...runs].sort(
    (a, b) =>
      (b.run_number || 0) - (a.run_number || 0) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${projectId}/tests`}>
            <Button size="xs" variant="ghost" className="gap-1 text-zinc-400 hover:text-zinc-200">
              <ArrowLeft className="h-3.5 w-3.5" />
              All Tests
            </Button>
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="font-mono text-sm font-bold text-blue-400">{testCase.key}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="outline"
            onClick={() => setIsIssueModalOpen(true)}
            className="gap-1.5 text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
          >
            <Bug className="h-3.5 w-3.5" />
            Report Issue
          </Button>

          <Button
            size="xs"
            variant="primary"
            onClick={() => setIsRunnerOpen(true)}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Play className="h-3.5 w-3.5 fill-white" />
            Execute Test Run
          </Button>
        </div>
      </div>

      {/* Test Case Header Card */}
      <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold">
                {testCase.key}
              </span>
              {testCase.suite && (
                <span className="text-xs text-zinc-400 font-mono">
                  📁 {testCase.suite.name}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">
              {testCase.title}
            </h1>
            {testCase.description && (
              <p className="text-xs text-zinc-400 leading-relaxed max-w-3xl">
                {testCase.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {latestRun ? (
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-zinc-500 font-mono uppercase mb-0.5">
                  Latest Result (Run #{latestRun.run_number})
                </span>
                <StatusBadge status={latestRun.status} />
              </div>
            ) : (
              <span className="text-xs text-zinc-500 font-mono">Unexecuted</span>
            )}
          </div>
        </div>

        {/* Metadata badges row */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-zinc-800 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span>Type:</span>
            <span className="font-semibold text-zinc-200 uppercase">{testCase.type}</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span>Priority:</span>
            <span className="font-semibold text-zinc-200 capitalize">{testCase.priority}</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span>Severity:</span>
            <span className="font-semibold text-zinc-200 capitalize">{testCase.severity}</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span>Case Lifecycle:</span>
            <span className="font-semibold text-zinc-200 uppercase">{testCase.status}</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span>History:</span>
            <span className="font-semibold text-zinc-200">{runs.length} runs recorded</span>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-2 border-b border-zinc-800 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('steps')}
          className={`pb-2.5 px-3 border-b-2 transition-colors ${
            activeTab === 'steps'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Procedure & Steps ({sortedSteps.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'history'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          Execution History ({runs.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('issues')}
          className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'issues'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Bug className="h-3.5 w-3.5" />
          Linked Defects ({issues.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('evidence')}
          className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'evidence'
              ? 'border-blue-500 text-blue-400 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Paperclip className="h-3.5 w-3.5" />
          Attached Evidence ({evidenceList.length})
        </button>
      </div>

      {/* Tab: Procedure & Steps */}
      {activeTab === 'steps' && (
        <div className="space-y-6">
          {/* Preconditions & Test Data */}
          {(testCase.preconditions || testCase.test_data) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {testCase.preconditions && (
                <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/30 text-xs space-y-1.5">
                  <span className="font-semibold text-zinc-300 block">Pre-conditions:</span>
                  <p className="text-zinc-400 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                    {testCase.preconditions}
                  </p>
                </div>
              )}
              {testCase.test_data && (
                <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/30 text-xs space-y-1.5">
                  <span className="font-semibold text-zinc-300 block">Test Data / Input Fixtures:</span>
                  <p className="text-zinc-400 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                    {testCase.test_data}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Steps Table */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <div className="p-3 bg-zinc-900/80 border-b border-zinc-800 font-semibold text-xs text-zinc-300 flex items-center justify-between">
              <span>Step-by-Step Test Procedure</span>
              <span className="font-mono text-zinc-500">{sortedSteps.length} Steps</span>
            </div>

            {sortedSteps.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                No individual steps specified for this test case.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/60 text-xs">
                {sortedSteps.map((step) => (
                  <div key={step.id} className="p-4 flex items-start gap-4 hover:bg-zinc-800/20">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-800 font-mono text-xs font-bold text-zinc-300">
                      {step.step_number}
                    </span>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase font-medium block mb-0.5">
                          Action
                        </span>
                        <p className="text-zinc-200 font-medium leading-relaxed">
                          {step.action}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase font-medium block mb-0.5">
                          Expected Result
                        </span>
                        <p className="text-zinc-400 font-mono text-[11px] leading-relaxed">
                          {step.expected_result || 'None specified'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Execution History */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {runs.length === 0 ? (
            <div className="p-12 text-center border border-dashed rounded-xl border-zinc-800 text-xs text-zinc-500 space-y-2">
              <p>No executions have been recorded for this test case yet.</p>
              <Button
                size="sm"
                variant="primary"
                onClick={() => setIsRunnerOpen(true)}
                className="gap-1.5"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                Launch First Execution
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => {
                const isExpanded = expandedRunIds[run.id];
                const stepResults = run.step_results || [];

                return (
                  <div
                    key={run.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden text-xs"
                  >
                    <div
                      onClick={() => toggleRunExpand(run.id)}
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold text-zinc-300">
                          Run #{run.run_number}
                        </span>
                        <StatusBadge status={run.status} />
                        <span className="text-zinc-400 font-mono text-[11px]">
                          {formatDuration(run.duration_ms)}
                        </span>
                        {run.environment && (
                          <span className="text-zinc-400 text-[11px] flex items-center gap-1 font-mono">
                            <Laptop className="h-3 w-3" />
                            {run.environment.name}
                          </span>
                        )}
                        {run.build_number && (
                          <span className="text-zinc-500 text-[11px] font-mono">
                            Build: {run.build_number}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-zinc-500 font-mono text-[11px]">
                          {formatDate(run.created_at)}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-zinc-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-zinc-500" />
                        )}
                      </div>
                    </div>

                    {/* Expandable Step Results Detail */}
                    {isExpanded && (
                      <div className="p-4 bg-zinc-950/60 border-t border-zinc-800/80 space-y-3">
                        {run.actual_result && (
                          <div className="text-xs">
                            <span className="font-semibold text-zinc-300 block mb-0.5">
                              Outcome / Discrepancy:
                            </span>
                            <p className="text-zinc-400 font-mono text-[11px]">
                              {run.actual_result}
                            </p>
                          </div>
                        )}

                        {stepResults.length > 0 && (
                          <div className="space-y-1.5 pt-2">
                            <span className="text-[10px] text-zinc-500 uppercase font-semibold block">
                              Recorded Step Outcomes
                            </span>
                            <div className="divide-y divide-zinc-800/40 rounded border border-zinc-800/60">
                              {stepResults.map((sr: any) => (
                                <div
                                  key={sr.id}
                                  className="p-2 flex items-center justify-between text-[11px]"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-zinc-500">
                                      Step {sr.step_number}
                                    </span>
                                    {sr.actual_result && (
                                      <span className="text-rose-400 font-mono">
                                        - {sr.actual_result}
                                      </span>
                                    )}
                                  </div>
                                  <StatusBadge status={sr.status} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Linked Issues */}
      {activeTab === 'issues' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="xs"
              variant="outline"
              onClick={() => setIsIssueModalOpen(true)}
              className="gap-1 text-rose-400 border-rose-500/30"
            >
              <Bug className="h-3 w-3" />
              File Defect
            </Button>
          </div>

          {issues.length === 0 ? (
            <div className="p-8 text-center border border-dashed rounded-xl border-zinc-800 text-xs text-zinc-500">
              No defects or verification discrepancies currently filed for this test case.
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-medium">
                  <tr>
                    <th className="p-3">Key</th>
                    <th className="p-3">Title</th>
                    <th className="p-3">Severity</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Fix Commit</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {issues.map((issue) => (
                    <tr key={issue.id} className="hover:bg-zinc-800/30">
                      <td className="p-3 font-mono font-bold text-rose-400">
                        {issue.issue_key}
                      </td>
                      <td className="p-3 font-medium text-zinc-200">
                        {issue.title}
                      </td>
                      <td className="p-3 uppercase font-mono text-[10px] text-zinc-400">
                        {issue.severity}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase font-medium ${
                            issue.status === 'closed' || issue.status === 'fixed' || (issue.status as string) === 'resolved'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : issue.status === 'in_progress'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {issue.status === 'closed' ? 'Closed / Resolved' : issue.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-zinc-400 text-[11px]">
                        {issue.related_commit || '—'}
                      </td>
                      <td className="p-3 text-right">
                        {issue.status === 'closed' || issue.status === 'fixed' || (issue.status as string) === 'resolved' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-semibold justify-end">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            Verified
                          </span>
                        ) : (
                          <RetestButton
                            issue={issue}
                            testCase={testCase}
                            onTriggerRetest={(iss) => {
                              setRetestingIssue(iss);
                              setIsRunnerOpen(true);
                            }}
                            size="xs"
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Evidence */}
      {activeTab === 'evidence' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2">
            <h3 className="text-xs font-semibold text-zinc-200">Upload New Verification Evidence</h3>
            <EvidenceUploader
              projectId={projectId}
              testRunId={runs[0]?.id}
              onUploadSuccess={() => fetchCaseDetails()}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-zinc-200">Attached Evidence Gallery</h3>
            <EvidenceGallery evidenceList={evidenceList} />
          </div>
        </div>
      )}

      {/* Runner Modal */}
      {isRunnerOpen && (
        <TestRunnerModal
          isOpen={isRunnerOpen}
          onClose={() => setIsRunnerOpen(false)}
          testCase={testCase}
          environments={environments}
          onSaveRun={handleSaveRun}
        />
      )}

      {/* Issue Modal */}
      {isIssueModalOpen && (
        <IssueModal
          isOpen={isIssueModalOpen}
          onClose={() => setIsIssueModalOpen(false)}
          projectId={projectId}
          testCase={testCase}
          testRun={latestRun}
          onSaveIssue={handleSaveIssue}
        />
      )}
    </div>
  );
}
