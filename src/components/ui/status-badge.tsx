import * as React from 'react';
import { cn, getStatusBadgeClasses, getPriorityBadgeClasses, getSeverityBadgeClasses, getIssueStatusClasses } from '@/lib/utils';
import { TestRunStatus, StepStatus, IssueStatus, TestPriority, TestSeverity } from '@/lib/types';

interface StatusBadgeProps {
  status: TestRunStatus | StepStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const styles = getStatusBadgeClasses(status);
  const labels: Record<string, string> = {
    pass: 'PASS',
    fail: 'FAIL',
    blocked: 'BLOCKED',
    skipped: 'SKIPPED',
    in_progress: 'IN PROGRESS',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase border',
        styles.bg,
        styles.text,
        styles.border,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', styles.dot)} />
      {labels[status] || status}
    </span>
  );
}

interface IssueBadgeProps {
  status: IssueStatus;
  className?: string;
}

export function IssueBadge({ status, className }: IssueBadgeProps) {
  const styles = getIssueStatusClasses(status);
  const formatted = status.replace('_', ' ').toUpperCase();

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase border',
        styles.bg,
        styles.text,
        styles.border,
        className
      )}
    >
      {formatted}
    </span>
  );
}

interface PriorityBadgeProps {
  priority: TestPriority;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const styles = getPriorityBadgeClasses(priority);
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-tight uppercase border',
        styles.bg,
        styles.text,
        styles.border,
        className
      )}
    >
      {priority}
    </span>
  );
}

interface SeverityBadgeProps {
  severity: TestSeverity;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const styles = getSeverityBadgeClasses(severity);
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-tight uppercase border',
        styles.bg,
        styles.text,
        styles.border,
        className
      )}
    >
      {severity}
    </span>
  );
}
