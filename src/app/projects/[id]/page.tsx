import * as React from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  Bug,
  FileText,
  Plus,
  FileCode,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { MetricCard } from '@/components/ui/metric-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/utils';

interface ProjectOverviewProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectOverviewPage({ params }: ProjectOverviewProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Resolve project id if a key was provided
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  let resolvedId = id;
  let projectName = 'Project';
  let projectKey = '';
  if (!isUuid) {
    const { data: proj } = await supabase.from('projects').select('id, name, key').ilike('key', id).maybeSingle();
    if (proj?.id) { resolvedId = proj.id; projectName = proj.name; projectKey = proj.key; }
  } else {
    const { data: proj } = await supabase.from('projects').select('name, key').eq('id', id).maybeSingle();
    if (proj) { projectName = proj.name; projectKey = proj.key; }
  }

  // Fetch test cases
  const { data: testCases } = await supabase
    .from('test_cases')
    .select('id, key, title, status, severity, created_at, suite:test_suites(name), test_runs:test_runs(status, created_at)')
    .eq('project_id', resolvedId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Fetch counts
  const { count: totalCases } = await supabase
    .from('test_cases')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', resolvedId);

  const { count: totalRuns } = await supabase
    .from('test_runs')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', resolvedId);

  const { count: passRuns } = await supabase
    .from('test_runs')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', resolvedId)
    .eq('status', 'pass');

  const { data: openIssuesData } = await supabase
    .from('issues')
    .select('id, issue_key, title, severity, status, created_at')
    .eq('project_id', resolvedId)
    .in('status', ['open', 'investigating', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(5);

  const { count: totalOpenIssues } = await supabase
    .from('issues')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', resolvedId)
    .in('status', ['open', 'investigating', 'in_progress']);

  const cases = testCases || [];
  const openIssues = openIssuesData || [];
  const passRate = (totalRuns || 0) > 0 ? Math.round(((passRuns || 0) / (totalRuns || 1)) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {projectName}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Test Manager — track test cases, bugs, and pass rates for your project
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/projects/${resolvedId}/tests/new`}>
            <Button size="xs" variant="outline" className="gap-1.5 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900">
              <Plus className="h-3.5 w-3.5 text-blue-500" />
              Add Test Case
            </Button>
          </Link>
          <Link href={`/projects/${resolvedId}/import`}>
            <Button size="xs" variant="outline" className="gap-1.5 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900">
              <FileCode className="h-3.5 w-3.5 text-purple-500" />
              AI Agent Guide
            </Button>
          </Link>
          <Link href={`/projects/${resolvedId}/reports`}>
            <Button size="xs" variant="primary" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Reports
            </Button>
          </Link>
        </div>
      </div>

      {/* Empty state banner */}
      {(totalCases || 0) === 0 && (
        <div className="p-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900/30 text-xs text-zinc-600 dark:text-zinc-400 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-500 text-base">🚀</span>
            <div>
              <strong className="text-zinc-900 dark:text-zinc-100 block font-semibold">Ready to go!</strong>
              <span>Add your first test case manually, or let your AI agent push tests automatically via the API.</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/projects/${resolvedId}/tests/new`}>
              <Button size="xs" variant="primary" className="gap-1">
                <Plus className="h-3 w-3" />
                Add Test Case
              </Button>
            </Link>
            <Link href={`/projects/${resolvedId}/import`}>
              <Button size="xs" variant="outline" className="gap-1">
                <FileCode className="h-3 w-3" />
                AI Agent Guide
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Test Cases"
          value={totalCases || 0}
          description={`${totalRuns || 0} total executions recorded`}
          icon={<CheckSquare className="h-4 w-4 text-blue-500" />}
        />
        <MetricCard
          title="Pass Rate"
          value={`${passRate}%`}
          description={`${passRuns || 0} passed out of ${totalRuns || 0} runs`}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        />
        <MetricCard
          title="Open Bugs"
          value={totalOpenIssues || 0}
          description="Issues currently open or in progress"
          icon={<Bug className="h-4 w-4 text-rose-500" />}
        />
      </div>

      {/* Recent Test Cases + Open Bugs side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Test Cases */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent Test Cases</h2>
            </div>
            <Link href={`/projects/${resolvedId}/tests`} className="text-xs text-blue-500 hover:underline">
              View all →
            </Link>
          </div>
          {cases.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
              No test cases yet. <Link href={`/projects/${resolvedId}/tests/new`} className="text-blue-500 hover:underline">Add one now →</Link>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {cases.map((tc: any) => {
                const latestRun = tc.test_runs?.[0];
                return (
                  <Link
                    key={tc.id}
                    href={`/projects/${resolvedId}/tests/${tc.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 font-bold shrink-0">{tc.key}</span>
                        <span className="text-xs text-zinc-800 dark:text-zinc-200 font-medium truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {tc.title}
                        </span>
                      </div>
                      {tc.suite && (
                        <span className="text-[11px] text-zinc-400 font-mono">📁 {tc.suite.name}</span>
                      )}
                    </div>
                    <div className="shrink-0 ml-3">
                      {latestRun ? (
                        <StatusBadge status={latestRun.status} />
                      ) : (
                        <span className="text-[11px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                          Not run
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Open Bugs */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-rose-500" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Open Bugs</h2>
            </div>
            <Link href={`/projects/${resolvedId}/issues`} className="text-xs text-blue-500 hover:underline">
              View all →
            </Link>
          </div>
          {openIssues.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
              🎉 No open bugs right now.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {openIssues.map((issue: any) => (
                <Link
                  key={issue.id}
                  href={`/projects/${resolvedId}/issues`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-rose-600 dark:text-rose-400 font-bold shrink-0">{issue.issue_key}</span>
                      <span className="text-xs text-zinc-800 dark:text-zinc-200 font-medium truncate group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                        {issue.title}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-400">{formatDate(issue.created_at)}</span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase shrink-0 ml-3 ${
                    issue.severity === 'blocker' || issue.severity === 'critical'
                      ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                      : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                  }`}>
                    {issue.severity}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
