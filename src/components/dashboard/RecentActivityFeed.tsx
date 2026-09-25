'use client';

import * as React from 'react';
import Link from 'next/link';
import { Activity, Clock, ShieldCheck, CheckCircle2, XCircle, Bug, FileCode } from 'lucide-react';
import { AuditLog } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';

interface RecentActivityFeedProps {
  projectId: string;
  auditLogs: AuditLog[];
}

export function RecentActivityFeed({ projectId, auditLogs }: RecentActivityFeedProps) {
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create_test_run':
        return <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />;
      case 'create_issue':
        return <Bug className="h-3.5 w-3.5 text-rose-500" />;
      case 'update_issue':
        return <Activity className="h-3.5 w-3.5 text-amber-500" />;
      case 'create_test_case':
      case 'update_test_case':
        return <FileCode className="h-3.5 w-3.5 text-emerald-500" />;
      default:
        return <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />;
    }
  };

  const formatActionTitle = (log: AuditLog) => {
    const details = (log.details || log.metadata) as Record<string, any> | undefined;
    switch (log.action) {
      case 'create_test_run':
        return `Recorded Test Run (${details?.status?.toUpperCase() || 'RUN'})`;
      case 'create_issue':
        return `Reported Defect ${details?.issue_key || ''}: ${details?.title || ''}`;
      case 'update_issue':
        return `Updated Defect status to ${details?.status || 'updated'}`;
      case 'create_test_case':
        return `Created Test Case ${details?.key || ''}: ${details?.title || ''}`;
      case 'import_junit':
        return `Imported Automated CI Run (${details?.total_imported || 0} tests)`;
      default:
        return `${log.action.replace(/_/g, ' ')}`;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-zinc-400" />
            <span>Audit & Verification Activity</span>
          </div>
          <span className="text-xs font-mono font-normal text-zinc-400">
            Immutable Audit Trail
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {auditLogs.length === 0 ? (
          <div className="py-6 text-center text-xs text-zinc-500">
            No audit log records found for this project.
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
            {auditLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="relative text-xs">
                <span className="absolute -left-[29px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                  {getActionIcon(log.action)}
                </span>
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {formatActionTitle(log)}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono mt-0.5">
                    <span>{(log.actor || log.user)?.full_name || (log.actor || log.user)?.email || 'System'}</span>
                    <span>•</span>
                    <span>{formatDate(log.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
