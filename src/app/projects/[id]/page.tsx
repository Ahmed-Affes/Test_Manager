import * as React from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  PlaySquare,
  Bug,
  Activity,
  Plus,
  Play,
  FileCode,
  FileText,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { MetricCard } from '@/components/ui/metric-card';
import { Button } from '@/components/ui/button';
import { StatusDistributionChart } from '@/components/dashboard/StatusDistributionChart';
import { ExecutionTrendChart } from '@/components/dashboard/ExecutionTrendChart';
import { FlakyTestsTable, FlakyTestItem } from '@/components/dashboard/FlakyTestsTable';
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';
import { formatDate } from '@/lib/utils';
import { AuditLog } from '@/lib/types';

interface ProjectOverviewProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectOverviewPage({ params }: ProjectOverviewProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Resolve project id if a key was provided
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  let resolvedId = id;
  if (!isUuid) {
    const { data: proj } = await supabase.from('projects').select('id').ilike('key', id).maybeSingle();
    if (proj?.id) resolvedId = proj.id;
  }

  // 1. Fetch test cases count and cases
  const { data: testCases } = await supabase
    .from('test_cases')
    .select('id, key, title, status, severity, created_at')
    .eq('project_id', resolvedId);

  // 2. Fetch test runs
  const { data: testRuns } = await supabase
    .from('test_runs')
    .select('id, test_case_id, status, duration_ms, created_at, run_number')
    .eq('project_id', resolvedId)
    .order('created_at', { ascending: false });

  // 3. Fetch open issues
  const { data: issues } = await supabase
    .from('issues')
    .select('id, issue_key, title, severity, priority, status, created_at')
    .eq('project_id', resolvedId);

  // 4. Fetch audit logs
  const { data: rawAuditLogs } = await supabase
    .from('audit_logs')
    .select('*, actor:users(id, email, full_name)')
    .eq('project_id', resolvedId)
    .order('created_at', { ascending: false })
    .limit(10);

  const cases = testCases || [];
  const runs = testRuns || [];
  const allIssues = issues || [];
  const auditLogs = (rawAuditLogs || []) as AuditLog[];

  // Compute metrics
  const totalCases = cases.length;
  const activeCases = cases.filter((c) => c.status === 'active').length;

  const totalRuns = runs.length;
  const passRuns = runs.filter((r) => r.status === 'pass').length;
  const failRuns = runs.filter((r) => r.status === 'fail').length;
  const blockedRuns = runs.filter((r) => r.status === 'blocked').length;
  const skippedRuns = runs.filter((r) => r.status === 'skipped').length;
  const passRate = totalRuns > 0 ? Math.round((passRuns / totalRuns) * 100) : 0;

  const openIssues = allIssues.filter((i) =>
    ['open', 'investigating', 'in_progress', 'retesting'].includes(i.status)
  );
  const blockerIssues = openIssues.filter(
    (i) => i.severity === 'blocker' || i.severity === 'critical'
  );

  // Compute Trend data (last 7 days)
  const trendMap: Record<string, { date: string; pass: number; fail: number; other: number }> = {};
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    trendMap[dateStr] = { date: dateStr, pass: 0, fail: 0, other: 0 };
  }

  runs.forEach((r) => {
    const d = r.created_at.split('T')[0];
    if (trendMap[d]) {
      if (r.status === 'pass') trendMap[d].pass++;
      else if (r.status === 'fail') trendMap[d].fail++;
      else trendMap[d].other++;
    }
  });
  const trendData = Object.values(trendMap);

  // Compute Flaky tests: test cases with both pass and fail in their recent runs
  const flakyList: FlakyTestItem[] = [];
  cases.forEach((tc) => {
    const caseRuns = runs.filter((r) => r.test_case_id === tc.id).slice(0, 8);
    if (caseRuns.length >= 2) {
      const hasPass = caseRuns.some((r) => r.status === 'pass');
      const hasFail = caseRuns.some((r) => r.status === 'fail' || r.status === 'blocked');
      if (hasPass && hasFail) {
        const failCount = caseRuns.filter(
          (r) => r.status === 'fail' || r.status === 'blocked'
        ).length;
        const rate = Math.round((failCount / caseRuns.length) * 100);
        flakyList.push({
          id: tc.id,
          key: tc.key,
          title: tc.title,
          flakinessRate: rate,
          recentResults: caseRuns.map((r) => r.status as any),
          totalRuns: caseRuns.length,
        });
      }
    }
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
              WINDOWS EDITION • PFE CAPSTONE
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              COW STORAGE ENGINE
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>MorphFS Verification & Quality Platform</span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Real-time quality intelligence, circular journal replay verification, and academic jury release gating
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/projects/${resolvedId}/tests`}>
            <Button size="xs" variant="outline" className="gap-1.5 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900">
              <CheckSquare className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              Filesystem Tests
            </Button>
          </Link>

          <Link href={`/projects/${resolvedId}/import`}>
            <Button size="xs" variant="outline" className="gap-1.5 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900">
              <FileCode className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              AI Agent & CI Import
            </Button>
          </Link>

          <Link href={`/projects/${resolvedId}/reports`}>
            <Button size="xs" variant="primary" className="gap-1.5 bg-purple-600 hover:bg-purple-500 text-white">
              <FileText className="h-3.5 w-3.5" />
              Release Gates & Sign-Off
            </Button>
          </Link>
        </div>
      </div>

      {/* Co-Op Team Collaboration Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-500/30 bg-purple-50/70 dark:bg-purple-950/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-purple-600/20 dark:bg-purple-600/30 text-purple-700 dark:text-purple-400 font-bold flex items-center justify-center text-xs font-mono border border-purple-300 dark:border-purple-500/40">
              AA
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>Ahmed Affes</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="text-[10px] text-purple-700 dark:text-purple-400 font-mono font-medium">Lead Systems Architect</div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Crash Replay & COW Engine</div>
            </div>
          </div>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-purple-200 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300">
            Author
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/70 dark:bg-blue-950/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-600/20 dark:bg-blue-600/30 text-blue-700 dark:text-blue-400 font-bold flex items-center justify-center text-xs font-mono border border-blue-300 dark:border-blue-500/40">
              CO
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>Engineering Co-Author</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="text-[10px] text-blue-700 dark:text-blue-400 font-mono font-medium">Systems Co-Developer</div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400">MFP Sync & Windows Shell</div>
            </div>
          </div>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-200 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300">
            Co-Op
          </span>
        </div>

        <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-600/20 dark:bg-emerald-600/30 text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center text-xs font-mono border border-emerald-300 dark:border-emerald-500/40">
              PR
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <span>Prof. Academic Advisor</span>
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
              </div>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono font-medium">PFE Jury Evaluator</div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Formal Defense Sign-Off</div>
            </div>
          </div>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-200 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
            Jury
          </span>
        </div>
      </div>

      {/* 10 PFE Release Gates Tracker */}
      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
              MorphFS Verification Gates (PFE Defense Progression)
            </span>
          </div>
          <Link
            href={`/projects/${resolvedId}/reports`}
            className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-mono"
          >
            Open Evaluation Dossier →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
          {[
            { id: 'GATE 0', name: 'Disk Layout' },
            { id: 'GATE 1', name: 'Object IDs' },
            { id: 'GATE 2', name: 'Version Tree' },
            { id: 'GATE 3', name: 'Crash Replay' },
            { id: 'GATE 4', name: 'GC Reclaim' },
            { id: 'GATE 5', name: 'MFP Sync' },
            { id: 'GATE 6', name: 'Win Shell' },
            { id: 'GATE 7', name: 'INV Fuzzing' },
            { id: 'GATE 8', name: 'Benchmarks' },
            { id: 'GATE 9', name: 'Jury Defense' },
          ].map((gate) => {
            const isVerified = totalRuns > 0 && passRate >= 90;
            return (
              <div
                key={gate.id}
                className={`p-2 rounded-lg border text-center space-y-1 ${
                  isVerified
                    ? 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40'
                }`}
              >
                <div className={`font-mono text-[10px] font-bold ${
                  isVerified ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-400'
                }`}>
                  {gate.id}
                </div>
                <div className="text-[10px] text-zinc-700 dark:text-zinc-300 font-medium truncate">
                  {gate.name}
                </div>
                <div className={`text-[9px] font-mono flex items-center justify-center gap-1 ${
                  isVerified ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'
                }`}>
                  {isVerified ? (
                    <>
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      VERIFIED
                    </>
                  ) : (
                    <>
                      <Clock className="h-2.5 w-2.5" />
                      PENDING
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {totalCases === 0 && (
          <div className="p-3 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 text-xs text-zinc-500 dark:text-zinc-400 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              🌱 <strong>Ready for MorphFS Build:</strong> Clean slate. As you build MorphFS, your AI agent can automatically create suites, tests, runs, crash evidence, environments, and milestones, or you can add them manually.
            </span>
            <Link href={`/projects/${resolvedId}/tests/new`}>
              <Button size="xs" variant="outline" className="gap-1 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300">
                <Plus className="h-3 w-3" />
                Add First Test Case
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Test Cases"
          value={totalCases}
          description={`${activeCases} active • ${totalCases - activeCases} draft/review`}
          icon={<CheckSquare className="h-4 w-4 text-blue-500" />}
        />

        <MetricCard
          title="Verification Pass Rate"
          value={`${passRate}%`}
          description={`${passRuns} passed / ${totalRuns} total runs`}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        />

        <MetricCard
          title="Open Defects"
          value={openIssues.length}
          description={
            blockerIssues.length > 0
              ? `${blockerIssues.length} critical / blocker issues`
              : 'Zero release-blocking defects'
          }
          icon={<Bug className="h-4 w-4 text-rose-500" />}
        />

        <MetricCard
          title="Historical Executions"
          value={totalRuns}
          description="Immutable recorded runs in database"
          icon={<PlaySquare className="h-4 w-4 text-purple-500" />}
        />
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatusDistributionChart
          pass={passRuns}
          fail={failRuns}
          blocked={blockedRuns}
          skipped={skippedRuns}
        />

        <ExecutionTrendChart data={trendData} />
      </div>

      {/* Bottom Section: Flaky Tests Detection & Live Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FlakyTestsTable projectId={resolvedId} flakyTests={flakyList} />
        <RecentActivityFeed projectId={resolvedId} auditLogs={auditLogs} />
      </div>
    </div>
  );
}
