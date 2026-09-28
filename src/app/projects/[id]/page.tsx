import * as React from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  Bug,
  FileText,
  Plus,
  FileCode,
  CheckCircle2,
  TrendingUp,
  Clock,
  AlertTriangle,
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

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  let resolvedId = id;
  let projectName = 'Project';
  if (!isUuid) {
    const { data: proj } = await supabase.from('projects').select('id, name, key').ilike('key', id).maybeSingle();
    if (proj?.id) { resolvedId = proj.id; projectName = proj.name; }
  } else {
    const { data: proj } = await supabase.from('projects').select('name, key').eq('id', id).maybeSingle();
    if (proj) { projectName = proj.name; }
  }

  // Fetch last 7 days of runs for trend
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  // Fetch all overview metrics concurrently in a single parallel roundtrip
  const [
    recentCasesRes,
    totalCasesRes,
    totalRunsRes,
    passRunsRes,
    failRunsRes,
    blockedRunsRes,
    openIssuesListRes,
    totalOpenIssuesRes,
    recentRunsRes,
  ] = await Promise.all([
    // Recent test cases
    supabase
      .from('test_cases')
      .select('id, key, title, suite:test_suites(name), test_runs:test_runs(status, created_at, run_number)')
      .eq('project_id', resolvedId)
      .order('created_at', { ascending: false })
      .limit(6),

    // Total cases count
    supabase
      .from('test_cases')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', resolvedId),

    // Total runs count
    supabase
      .from('test_runs')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', resolvedId),

    // Pass runs count
    supabase
      .from('test_runs')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', resolvedId)
      .eq('status', 'pass'),

    // Fail runs count
    supabase
      .from('test_runs')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', resolvedId)
      .eq('status', 'fail'),

    // Blocked runs count
    supabase
      .from('test_runs')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', resolvedId)
      .eq('status', 'blocked'),

    // Open issues list
    supabase
      .from('issues')
      .select('id, issue_key, title, severity, status, created_at')
      .eq('project_id', resolvedId)
      .in('status', ['open', 'investigating', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(5),

    // Open issues count
    supabase
      .from('issues')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', resolvedId)
      .in('status', ['open', 'investigating', 'in_progress']),

    // Recent runs trend
    supabase
      .from('test_runs')
      .select('status, created_at')
      .eq('project_id', resolvedId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: true }),
  ]);

  const recentCases = recentCasesRes.data || [];
  const totalCases = totalCasesRes.count || 0;
  const totalRuns = totalRunsRes.count || 0;
  const passRuns = passRunsRes.count || 0;
  const failRuns = failRunsRes.count || 0;
  const blockedRuns = blockedRunsRes.count || 0;
  const openIssuesList = openIssuesListRes.data || [];
  const totalOpenIssues = totalOpenIssuesRes.count || 0;
  const recentRuns = recentRunsRes.data || [];

  // Build 7-day trend
  const trendDays: { date: string; label: string; pass: number; fail: number; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    trendDays.push({ date: dateStr, label, pass: 0, fail: 0, total: 0 });
  }
  (recentRuns || []).forEach((r) => {
    const day = r.created_at.split('T')[0];
    const slot = trendDays.find((d) => d.date === day);
    if (slot) {
      slot.total++;
      if (r.status === 'pass') slot.pass++;
      else if (r.status === 'fail' || r.status === 'blocked') slot.fail++;
    }
  });

  const cases = recentCases || [];
  const openIssues = openIssuesList || [];
  const pass = passRuns || 0;
  const fail = failRuns || 0;
  const blocked = blockedRuns || 0;
  const skipped = (totalRuns || 0) - pass - fail - blocked;
  const passRate = (totalRuns || 0) > 0 ? Math.round((pass / (totalRuns || 1)) * 100) : 0;

  // Donut chart math
  const total = (totalRuns || 0) || 1;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const passArc = (pass / total) * circ;
  const failArc = (fail / total) * circ;
  const blockedArc = (blocked / total) * circ;
  const skippedArc = (skipped / total) * circ;

  // Bar chart max
  const maxDayTotal = Math.max(...trendDays.map((d) => d.total), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{projectName}</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Overview — test results, open bugs, and trends for your project
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

      {/* Empty state */}
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
              <Button size="xs" variant="primary" className="gap-1"><Plus className="h-3 w-3" />Add Test Case</Button>
            </Link>
            <Link href={`/projects/${resolvedId}/import`}>
              <Button size="xs" variant="outline" className="gap-1"><FileCode className="h-3 w-3" />AI Agent Guide</Button>
            </Link>
          </div>
        </div>
      )}

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Test Cases"
          value={totalCases || 0}
          description={`${totalRuns || 0} total runs recorded`}
          icon={<CheckSquare className="h-4 w-4 text-blue-500" />}
        />
        <MetricCard
          title="Pass Rate"
          value={`${passRate}%`}
          description={`${pass} passed · ${fail} failed · ${blocked} blocked`}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        />
        <MetricCard
          title="Open Bugs"
          value={totalOpenIssues || 0}
          description="Issues currently open or in progress"
          icon={<Bug className="h-4 w-4 text-rose-500" />}
        />
      </div>

      {/* Charts row */}
      {(totalRuns || 0) > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Donut chart: Run status breakdown */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Test Run Status Breakdown
            </h2>
            <div className="flex items-center gap-8">
              <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
                {/* Background */}
                <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" strokeWidth="14" />
                {/* Pass arc */}
                {pass > 0 && (
                  <circle cx="50" cy="50" r={r} fill="none" stroke="#22c55e" strokeWidth="14"
                    strokeDasharray={`${passArc} ${circ - passArc}`}
                    strokeDashoffset={circ * 0.25} strokeLinecap="butt" />
                )}
                {/* Fail arc */}
                {fail > 0 && (
                  <circle cx="50" cy="50" r={r} fill="none" stroke="#ef4444" strokeWidth="14"
                    strokeDasharray={`${failArc} ${circ - failArc}`}
                    strokeDashoffset={circ * 0.25 - passArc} strokeLinecap="butt" />
                )}
                {/* Blocked arc */}
                {blocked > 0 && (
                  <circle cx="50" cy="50" r={r} fill="none" stroke="#f59e0b" strokeWidth="14"
                    strokeDasharray={`${blockedArc} ${circ - blockedArc}`}
                    strokeDashoffset={circ * 0.25 - passArc - failArc} strokeLinecap="butt" />
                )}
                {/* Skipped arc */}
                {skipped > 0 && (
                  <circle cx="50" cy="50" r={r} fill="none" stroke="#94a3b8" strokeWidth="14"
                    strokeDasharray={`${skippedArc} ${circ - skippedArc}`}
                    strokeDashoffset={circ * 0.25 - passArc - failArc - blockedArc} strokeLinecap="butt" />
                )}
                <text x="50" y="46" textAnchor="middle" className="fill-zinc-900 dark:fill-zinc-100" fontSize="14" fontWeight="bold">{passRate}%</text>
                <text x="50" y="59" textAnchor="middle" className="fill-zinc-500" fontSize="7">pass rate</text>
              </svg>
              <div className="space-y-2 text-xs">
                {[
                  { label: 'Passed', count: pass, color: 'bg-emerald-500' },
                  { label: 'Failed', count: fail, color: 'bg-rose-500' },
                  { label: 'Blocked', count: blocked, color: 'bg-amber-500' },
                  { label: 'Skipped', count: skipped, color: 'bg-slate-400' },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${color}`} />
                    <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 ml-auto tabular-nums">{count}</span>
                  </div>
                ))}
                <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-zinc-500">Total runs</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">{totalRuns || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bar chart: 7-day trend */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-500" />
              Last 7 Days — Test Runs
            </h2>
            <div className="flex items-end gap-2 h-24">
              {trendDays.map((day) => {
                const passH = day.total > 0 ? Math.round((day.pass / maxDayTotal) * 80) : 0;
                const failH = day.total > 0 ? Math.round((day.fail / maxDayTotal) * 80) : 0;
                const otherH = day.total > 0 ? Math.round(((day.total - day.pass - day.fail) / maxDayTotal) * 80) : 0;
                return (
                  <div key={day.date} className="flex flex-col items-center gap-1 flex-1">
                    <div className="flex flex-col-reverse items-center w-full" style={{ height: 88 }}>
                      {day.total === 0 ? (
                        <div className="w-full rounded-sm bg-zinc-100 dark:bg-zinc-800/60" style={{ height: 4 }} />
                      ) : (
                        <div className="flex flex-col-reverse w-full rounded-sm overflow-hidden" style={{ height: passH + failH + otherH || 4 }}>
                          {otherH > 0 && <div className="w-full bg-slate-400" style={{ height: otherH }} />}
                          {failH > 0 && <div className="w-full bg-rose-500" style={{ height: failH }} />}
                          {passH > 0 && <div className="w-full bg-emerald-500" style={{ height: passH }} />}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">{day.label}</span>
                    {day.total > 0 && <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">{day.total}</span>}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500 inline-block" /> Pass</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-rose-500 inline-block" /> Fail</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-slate-400 inline-block" /> Other</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent test cases + open bugs */}
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
              No test cases yet.{' '}
              <Link href={`/projects/${resolvedId}/tests/new`} className="text-blue-500 hover:underline">Add one →</Link>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {cases.map((tc: any) => {
                const latestRun = (tc.test_runs || []).slice().sort(
                  (a: any, b: any) =>
                    (b.run_number || 0) - (a.run_number || 0) ||
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )[0];
                return (
                  <Link key={tc.id} href={`/projects/${resolvedId}/tests/${tc.id}`}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 font-bold shrink-0">{tc.key}</span>
                        <span className="text-xs text-zinc-800 dark:text-zinc-200 font-medium truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {tc.title}
                        </span>
                      </div>
                      {tc.suite && <span className="text-[11px] text-zinc-400 font-mono">📁 {tc.suite.name}</span>}
                    </div>
                    <div className="shrink-0 ml-3">
                      {latestRun ? (
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={latestRun.status} />
                          {latestRun.run_number && (
                            <span className="text-[10px] font-mono text-zinc-400">
                              #{latestRun.run_number}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">Not run</span>
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
            <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">🎉 No open bugs right now.</div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {openIssues.map((issue: any) => (
                <Link key={issue.id} href={`/projects/${resolvedId}/issues`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group">
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
