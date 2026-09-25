'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatusDistributionProps {
  pass: number;
  fail: number;
  blocked: number;
  skipped: number;
  inProgress?: number;
}

export function StatusDistributionChart({
  pass = 0,
  fail = 0,
  blocked = 0,
  skipped = 0,
  inProgress = 0,
}: StatusDistributionProps) {
  const total = pass + fail + blocked + skipped + inProgress;

  const data = [
    { label: 'Passed', count: pass, color: '#10b981', darkColor: '#34d399', bgClass: 'bg-emerald-500' },
    { label: 'Failed', count: fail, color: '#f43f5e', darkColor: '#fb7185', bgClass: 'bg-rose-500' },
    { label: 'Blocked', count: blocked, color: '#f59e0b', darkColor: '#fbbf24', bgClass: 'bg-amber-500' },
    { label: 'Skipped', count: skipped, color: '#64748b', darkColor: '#94a3b8', bgClass: 'bg-slate-500' },
    { label: 'In Progress', count: inProgress, color: '#0ea5e9', darkColor: '#38bdf8', bgClass: 'bg-sky-500' },
  ].filter((d) => d.count > 0);

  // SVG Donut calculation
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
          <span>Execution Distribution</span>
          <span className="text-xs font-mono font-normal text-zinc-400">
            {total} total runs
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="h-44 flex items-center justify-center text-xs text-zinc-400">
            No execution data recorded yet
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 pt-2">
            {/* Donut Chart SVG */}
            <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  className="stroke-zinc-100 dark:stroke-zinc-800"
                  strokeWidth="14"
                  fill="transparent"
                />
                {data.map((item) => {
                  const percent = item.count / total;
                  const strokeDasharray = `${percent * circumference} ${circumference}`;
                  const strokeDashoffset = -(accumulatedPercent * circumference);
                  accumulatedPercent += percent;

                  return (
                    <circle
                      key={item.label}
                      cx="50"
                      cy="50"
                      r={radius}
                      stroke={item.color}
                      strokeWidth="14"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      fill="transparent"
                      className="transition-all duration-500 hover:opacity-80"
                    />
                  );
                })}
              </svg>

              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                  {total > 0 ? `${Math.round((pass / total) * 100)}%` : '0%'}
                </span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                  Pass Rate
                </span>
              </div>
            </div>

            {/* Breakdown Legend */}
            <div className="flex flex-col gap-2 w-full max-w-xs text-xs">
              {data.map((item) => {
                const percent = Math.round((item.count / total) * 100);
                return (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${item.bgClass}`} />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <div className="font-mono text-xs">
                        <span className="font-semibold">{item.count}</span>
                        <span className="text-zinc-400 ml-1">({percent}%)</span>
                      </div>
                    </div>
                    {/* Linear bar representation */}
                    <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.bgClass}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
