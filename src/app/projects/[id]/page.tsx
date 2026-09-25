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

  // 1. Fetch test cases count and cases
  const { data: testCases } = await supabase
    .from('test_cases')
    .select('id, key, title, status, severity, created_at')
    .eq('project_id', id);

  // 2. Fetch test runs
  const { data: testRuns } = await supabase
    .from('test_runs')
    .select('id, test_case_id, status, duration_ms, created_at, run_number')
    .eq('project_id', id)
    .order('created_at', { ascending: false });

  // 3. Fetch open issues
  const { data: issues } = await supabase
    .from('issues')
    .select('id, issue_key, title, severity, priority, status, created_at')
    .eq('project_id', id);

  // 4. Fetch audit logs
  const { data: rawAuditLogs } = await supabase
    .from('audit_logs')
    .select('*, actor:users(id, email, full_name)')
    .eq('project_id', id)
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            Project Verification Overview
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time quality intelligence, execution fidelity, and release sign-off gating
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/projects/${id}/tests`}>
            <Button size="xs" variant="outline" className="gap-1.5">
              <CheckSquare className="h-3.5 w-3.5" />
              Manage Tests
            </Button>
          </Link>

          <Link href={`/projects/${id}/import`}>
            <Button size="xs" variant="outline" className="gap-1.5">
              <FileCode className="h-3.5 w-3.5" />
              CI Import
            </Button>
          </Link>

          <Link href={`/projects/${id}/reports`}>
            <Button size="xs" variant="primary" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Verification Report
            </Button>
          </Link>
        </div>
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
        <FlakyTestsTable projectId={id} flakyTests={flakyList} />
        <RecentActivityFeed projectId={id} auditLogs={auditLogs} />
      </div>
    </div>
  );
}
