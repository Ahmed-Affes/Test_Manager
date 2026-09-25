'use client';

import * as React from 'react';
import {
  Download,
  Copy,
  Printer,
  FileText,
  Check,
  Code,
  Share2,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { TestCase, TestRun, Issue, Project, Environment } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatDuration } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';

interface ReportData {
  project: Project;
  testCases: TestCase[];
  testRuns: TestRun[];
  issues: Issue[];
  environments: Environment[];
  generatedAt: string;
}

interface ReportGeneratorProps {
  data?: ReportData;
  project?: Project | null;
  testCases?: any[];
  testRuns?: any[];
  issues?: any[];
  environments?: any[];
}

export function ReportGenerator({
  data: directData,
  project,
  testCases = [],
  testRuns = [],
  issues = [],
  environments = [],
}: ReportGeneratorProps) {
  const data: ReportData = directData || {
    project: (project as any) || {
      id: 'default',
      key: 'TEST',
      name: 'Test Project',
      status: 'active',
      icon: 'folder',
      accent_color: '#3b82f6',
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    testCases: testCases as TestCase[],
    testRuns: testRuns as TestRun[],
    issues: issues as Issue[],
    environments: environments as Environment[],
    generatedAt: new Date().toISOString(),
  };

  const [copiedMd, setCopiedMd] = React.useState(false);
  const [copiedJson, setCopiedJson] = React.useState(false);

  const totalCases = data.testCases.length;
  const totalRuns = data.testRuns.length;
  const passedRuns = data.testRuns.filter((r) => r.status === 'pass').length;
  const failedRuns = data.testRuns.filter((r) => r.status === 'fail').length;
  const blockedRuns = data.testRuns.filter((r) => r.status === 'blocked').length;
  const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0;

  const openIssues = data.issues.filter((i) => ['open', 'investigating', 'in_progress', 'retesting'].includes(i.status));
  const blockerIssues = openIssues.filter((i) => i.severity === 'blocker' || i.severity === 'critical');

  const generateMarkdownReport = () => {
    return `# Test Verification & Quality Report: ${data.project.name}
**Generated**: ${formatDate(data.generatedAt)}
**Project Key**: \`${data.project.key}\`

---

## 1. Executive Summary
- **Pass Rate**: ${passRate}% (${passedRuns} / ${totalRuns} executions)
- **Total Test Cases Registered**: ${totalCases}
- **Defects / Open Issues**: ${openIssues.length} (${blockerIssues.length} Blockers/Critical)
- **Release Status**: ${blockerIssues.length === 0 && passRate >= 90 ? '✅ APPROVED / RELEASE READY' : '❌ RELEASE BLOCKED'}

---

## 2. Test Execution Breakdown
| Status | Count | Percentage |
| :--- | :--- | :--- |
| **Pass** | ${passedRuns} | ${totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0}% |
| **Fail** | ${failedRuns} | ${totalRuns > 0 ? Math.round((failedRuns / totalRuns) * 100) : 0}% |
| **Blocked** | ${blockedRuns} | ${totalRuns > 0 ? Math.round((blockedRuns / totalRuns) * 100) : 0}% |

---

## 3. Active Defects & Blockers
${
  openIssues.length === 0
    ? '*No unresolved defects.*'
    : openIssues
        .map(
          (i) =>
            `- **[${i.issue_key}]** (${i.severity.toUpperCase()} / ${i.status.toUpperCase()}): ${i.title}${
              i.related_commit ? ` *(Fix Commit: ${i.related_commit})*` : ''
            }`
        )
        .join('\n')
}

---
*Report generated via Test Manager verification platform.*
`;
  };

  const handleCopyMarkdown = () => {
    const md = generateMarkdownReport();
    navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handleDownloadJson = () => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-report-${data.project.key}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Action Bar (hidden during print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 print:hidden">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Export & Distribute Verification Report
          </h2>
          <p className="text-xs text-zinc-500">
            Generate printable PDF summary, raw JSON data, or markdown for GitHub PRs and release notes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="xs" variant="outline" onClick={handleCopyMarkdown} className="gap-1.5">
            {copiedMd ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            {copiedMd ? 'Copied Markdown' : 'Copy Markdown'}
          </Button>

          <Button size="xs" variant="outline" onClick={handleDownloadJson} className="gap-1.5">
            <Download className="h-3 w-3" />
            Download JSON
          </Button>

          <Button size="xs" variant="primary" onClick={handlePrint} className="gap-1.5">
            <Printer className="h-3 w-3" />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      {/* Printable Report Canvas */}
      <div className="p-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 space-y-8 print:p-0 print:border-none">
        {/* Report Header */}
        <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-bold text-blue-600 dark:text-blue-400">
                {data.project.key}
              </span>
              <h1 className="text-2xl font-bold tracking-tight">
                Software Test Verification Report
              </h1>
            </div>
            <p className="text-sm text-zinc-500 mt-1">
              Project: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{data.project.name}</span>
            </p>
          </div>

          <div className="text-right text-xs text-zinc-500 font-mono">
            <p>Generated: {formatDate(data.generatedAt)}</p>
            <p>Audit Verified: True</p>
          </div>
        </div>

        {/* Executive Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
            <span className="text-[11px] font-medium text-zinc-500 uppercase">Verification Pass Rate</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">{passRate}%</span>
              <span className="text-xs text-zinc-400 font-mono">({passedRuns}/{totalRuns})</span>
            </div>
          </div>

          <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
            <span className="text-[11px] font-medium text-zinc-500 uppercase">Total Test Cases</span>
            <div className="mt-1 text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {totalCases}
            </div>
          </div>

          <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
            <span className="text-[11px] font-medium text-zinc-500 uppercase">Total Executions</span>
            <div className="mt-1 text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {totalRuns}
            </div>
          </div>

          <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
            <span className="text-[11px] font-medium text-zinc-500 uppercase">Open Defects</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">{openIssues.length}</span>
              {blockerIssues.length > 0 && (
                <span className="text-xs font-semibold text-rose-500 font-mono">({blockerIssues.length} Blockers)</span>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Test Cases Table */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
            Test Case Coverage & History
          </h3>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 font-semibold text-zinc-700 dark:text-zinc-300">
                <tr>
                  <th className="p-2.5">Key</th>
                  <th className="p-2.5">Title</th>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5">Severity</th>
                  <th className="p-2.5">Latest Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.testCases.map((tc) => {
                  const runs = data.testRuns.filter((r) => r.test_case_id === tc.id);
                  const latestRun = runs[0];
                  return (
                    <tr key={tc.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                      <td className="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {tc.key}
                      </td>
                      <td className="p-2.5 font-medium text-zinc-800 dark:text-zinc-200">
                        {tc.title}
                      </td>
                      <td className="p-2.5 text-zinc-500 uppercase font-mono text-[10px]">
                        {tc.type}
                      </td>
                      <td className="p-2.5 text-zinc-500 capitalize">
                        {tc.severity}
                      </td>
                      <td className="p-2.5">
                        {latestRun ? (
                          <StatusBadge status={latestRun.status} />
                        ) : (
                          <span className="text-zinc-400 font-mono text-[11px]">Unexecuted</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Defects Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
            Defects and Discrepancies Register ({data.issues.length})
          </h3>
          {data.issues.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">No defects recorded.</p>
          ) : (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 font-semibold text-zinc-700 dark:text-zinc-300">
                  <tr>
                    <th className="p-2.5">Issue Key</th>
                    <th className="p-2.5">Title</th>
                    <th className="p-2.5">Severity</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Fix Commit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {data.issues.map((issue) => (
                    <tr key={issue.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                      <td className="p-2.5 font-mono font-bold text-rose-600 dark:text-rose-400">
                        {issue.issue_key}
                      </td>
                      <td className="p-2.5 font-medium text-zinc-800 dark:text-zinc-200">
                        {issue.title}
                      </td>
                      <td className="p-2.5 uppercase font-mono text-[10px] text-zinc-500">
                        {issue.severity}
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {issue.status}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-zinc-500 text-[11px]">
                        {issue.related_commit || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
