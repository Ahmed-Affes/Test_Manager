'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';

export interface FlakyTestItem {
  id: string;
  key: string;
  title: string;
  flakinessRate: number; // 0 to 100
  recentResults: ('pass' | 'fail' | 'blocked' | 'skipped')[];
  totalRuns: number;
}

interface FlakyTestsTableProps {
  projectId: string;
  flakyTests: FlakyTestItem[];
  onExecuteTest?: (testCaseId: string) => void;
}

export function FlakyTestsTable({
  projectId,
  flakyTests,
  onExecuteTest,
}: FlakyTestsTableProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>Flaky Tests Detection</span>
          </div>
          <span className="text-xs font-mono font-normal text-zinc-400">
            {flakyTests.length} unstable cases detected
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {flakyTests.length === 0 ? (
          <div className="py-6 text-center text-xs text-zinc-500">
            No flaky test cases identified in recent execution history. All test results are deterministic.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-medium">
                <tr>
                  <th className="pb-2">Test Case</th>
                  <th className="pb-2">Recent Streak</th>
                  <th className="pb-2">Instability Index</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {flakyTests.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                    <td className="py-2.5 pr-2">
                      <Link
                        href={`/projects/${projectId}/tests/${t.id}`}
                        className="font-mono text-blue-600 dark:text-blue-400 hover:underline font-semibold block"
                      >
                        {t.key}
                      </Link>
                      <span className="text-zinc-700 dark:text-zinc-300 truncate max-w-xs block font-medium">
                        {t.title}
                      </span>
                    </td>

                    <td className="py-2.5 pr-2">
                      <div className="flex items-center gap-1">
                        {t.recentResults.slice(0, 5).map((res, i) => (
                          <span
                            key={i}
                            className={`h-4 w-4 rounded-sm flex items-center justify-center font-mono text-[9px] font-bold text-white ${
                              res === 'pass'
                                ? 'bg-emerald-500'
                                : res === 'fail'
                                ? 'bg-rose-500'
                                : res === 'blocked'
                                ? 'bg-amber-500'
                                : 'bg-zinc-400'
                            }`}
                            title={`Run -${i + 1}: ${res}`}
                          >
                            {res[0].toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-2.5 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                          {t.flakinessRate}%
                        </span>
                        <div className="h-1.5 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500"
                            style={{ width: `${t.flakinessRate}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 text-right">
                      <Link href={`/projects/${projectId}/tests/${t.id}`}>
                        <Button size="xs" variant="ghost" className="gap-1">
                          Inspect
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
