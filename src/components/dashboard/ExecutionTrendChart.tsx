'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TrendDay {
  date: string;
  pass: number;
  fail: number;
  other: number;
}

interface ExecutionTrendChartProps {
  data: TrendDay[];
}

export function ExecutionTrendChart({ data }: ExecutionTrendChartProps) {
  const maxTotal = Math.max(...data.map((d) => d.pass + d.fail + d.other), 5);

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
          <span>Execution Volume & Trend</span>
          <span className="text-xs font-mono font-normal text-zinc-400">
            Last {data.length} periods
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-xs text-zinc-400">
            No temporal execution data available
          </div>
        ) : (
          <div className="pt-4">
            <div className="h-40 flex items-end justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
              {data.map((day, idx) => {
                const total = day.pass + day.fail + day.other;
                const passHeight = (day.pass / maxTotal) * 100;
                const failHeight = (day.fail / maxTotal) * 100;
                const otherHeight = (day.other / maxTotal) * 100;

                return (
                  <div
                    key={day.date || idx}
                    className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end"
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                      <div className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] rounded px-2 py-1 shadow-lg whitespace-nowrap font-mono">
                        <p className="font-semibold">{day.date}</p>
                        <p className="text-emerald-400 dark:text-emerald-600">Pass: {day.pass}</p>
                        <p className="text-rose-400 dark:text-rose-600">Fail: {day.fail}</p>
                        <p className="text-zinc-400">Other: {day.other}</p>
                      </div>
                      <div className="w-2 h-2 bg-zinc-900 dark:bg-zinc-100 rotate-45 -mt-1" />
                    </div>

                    {/* Stacked bar */}
                    <div className="w-full max-w-[28px] flex flex-col justify-end rounded-t overflow-hidden bg-zinc-100 dark:bg-zinc-800/60 h-full">
                      {total > 0 && (
                        <>
                          <div
                            style={{ height: `${otherHeight}%` }}
                            className="w-full bg-slate-400 hover:opacity-90 transition-all"
                            title={`Other: ${day.other}`}
                          />
                          <div
                            style={{ height: `${failHeight}%` }}
                            className="w-full bg-rose-500 hover:opacity-90 transition-all"
                            title={`Fail: ${day.fail}`}
                          />
                          <div
                            style={{ height: `${passHeight}%` }}
                            className="w-full bg-emerald-500 hover:opacity-90 transition-all"
                            title={`Pass: ${day.pass}`}
                          />
                        </>
                      )}
                    </div>

                    <span className="text-[10px] font-mono text-zinc-400 truncate max-w-full">
                      {day.date.split('-').slice(1).join('/')}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-4 pt-3 text-[11px] text-zinc-500">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                <span>Passed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
                <span>Failed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />
                <span>Blocked/Skipped</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
