'use client';

import * as React from 'react';
import { RotateCcw } from 'lucide-react';
import { Issue, TestCase } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface RetestButtonProps {
  issue: Issue;
  testCase?: TestCase;
  onTriggerRetest: (issue: Issue, testCase?: TestCase) => void;
  className?: string;
  size?: 'xs' | 'sm' | 'default';
}

export function RetestButton({
  issue,
  testCase,
  onTriggerRetest,
  className,
  size = 'sm',
}: RetestButtonProps) {
  // Show retest for any bug that isn't already resolved or closed
  const isRetestable = !['resolved', 'closed', 'fixed', 'rejected', 'wont_fix'].includes(issue.status as string);

  if (!isRetestable) return null;

  return (
    <Button
      variant="outline"
      size={size}
      onClick={() => onTriggerRetest(issue, testCase)}
      className={`border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 gap-1.5 ${className}`}
      title="Launch 1-click verification retest for this issue"
    >
      <RotateCcw className="h-3.5 w-3.5" />
      <span>Retest Fix</span>
    </Button>
  );
}
