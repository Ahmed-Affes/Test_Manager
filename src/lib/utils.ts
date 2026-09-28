import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { StepStatus, TestRunStatus, TestPriority, TestSeverity, IssueStatus } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null | undefined, formatStr = 'yyyy-MM-dd HH:mm'): string {
  if (!dateString) return '—';
  try {
    const d = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
    if (!isValid(d)) return '—';
    return format(d, formatStr);
  } catch {
    return '—';
  }
}

export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const d = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
    if (!isValid(d)) return '—';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '—';
  }
}

export function formatDuration(durationMs: number | null | undefined): string {
  if (!durationMs || durationMs <= 0) return '0s';
  if (durationMs < 1000) return `${durationMs}ms`;
  const seconds = Math.floor(durationMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  return `${minutes}m ${remainingSecs}s`;
}

/**
 * Calculates overall test run status from ordered step results.
 * Logic:
 * 1. If any step is FAIL -> FAIL
 * 2. Else if any step is BLOCKED -> BLOCKED
 * 3. Else if all steps are PASS -> PASS
 * 4. Else if all steps are SKIPPED -> SKIPPED
 * 5. Default -> PASS
 */
export function calculateOverallResult(stepResults: Array<{ status: StepStatus }>): TestRunStatus {
  if (!stepResults || stepResults.length === 0) return 'pass';

  const statuses = stepResults.map((s) => s.status);
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('blocked')) return 'blocked';
  if (statuses.every((s) => s === 'skipped')) return 'skipped';
  return 'pass';
}

export function getStatusBadgeClasses(status: TestRunStatus | StepStatus): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (status) {
    case 'pass':
      return {
        bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
        text: 'text-emerald-700 dark:text-emerald-400',
        border: 'border-emerald-500/20 dark:border-emerald-500/30',
        dot: 'bg-emerald-500',
      };
    case 'fail':
      return {
        bg: 'bg-rose-500/10 dark:bg-rose-500/15',
        text: 'text-rose-700 dark:text-rose-400',
        border: 'border-rose-500/20 dark:border-rose-500/30',
        dot: 'bg-rose-500',
      };
    case 'blocked':
      return {
        bg: 'bg-amber-500/10 dark:bg-amber-500/15',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-500/20 dark:border-amber-500/30',
        dot: 'bg-amber-500',
      };
    case 'skipped':
      return {
        bg: 'bg-zinc-500/10 dark:bg-zinc-500/15',
        text: 'text-zinc-700 dark:text-zinc-400',
        border: 'border-zinc-500/20 dark:border-zinc-500/30',
        dot: 'bg-zinc-400',
      };
    case 'in_progress':
      return {
        bg: 'bg-sky-500/10 dark:bg-sky-500/15',
        text: 'text-sky-700 dark:text-sky-400',
        border: 'border-sky-500/20 dark:border-sky-500/30',
        dot: 'bg-sky-500 animate-pulse',
      };
    default:
      return {
        bg: 'bg-zinc-500/10',
        text: 'text-zinc-600 dark:text-zinc-400',
        border: 'border-zinc-500/20',
        dot: 'bg-zinc-400',
      };
  }
}

export function getPriorityBadgeClasses(priority: TestPriority): {
  bg: string;
  text: string;
  border: string;
} {
  switch (priority) {
    case 'critical':
      return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-700 dark:text-rose-400',
        border: 'border-rose-500/30',
      };
    case 'high':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-500/30',
      };
    case 'medium':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-500/30',
      };
    case 'low':
      return {
        bg: 'bg-zinc-500/10',
        text: 'text-zinc-600 dark:text-zinc-400',
        border: 'border-zinc-500/30',
      };
  }
}

export function getSeverityBadgeClasses(severity: TestSeverity): {
  bg: string;
  text: string;
  border: string;
} {
  switch (severity) {
    case 'blocker':
      return {
        bg: 'bg-red-600/15',
        text: 'text-red-700 dark:text-red-400 font-semibold',
        border: 'border-red-600/40',
      };
    case 'critical':
      return {
        bg: 'bg-rose-500/15',
        text: 'text-rose-700 dark:text-rose-400',
        border: 'border-rose-500/30',
      };
    case 'major':
      return {
        bg: 'bg-orange-500/10',
        text: 'text-orange-700 dark:text-orange-400',
        border: 'border-orange-500/30',
      };
    case 'minor':
      return {
        bg: 'bg-zinc-500/10',
        text: 'text-zinc-700 dark:text-zinc-400',
        border: 'border-zinc-500/30',
      };
    case 'trivial':
      return {
        bg: 'bg-zinc-500/5',
        text: 'text-zinc-500 dark:text-zinc-500',
        border: 'border-zinc-500/20',
      };
  }
}

export function getIssueStatusClasses(status: IssueStatus): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'open':
      return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-700 dark:text-rose-400',
        border: 'border-rose-500/30',
      };
    case 'investigating':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-500/30',
      };
    case 'in_progress':
      return {
        bg: 'bg-sky-500/10',
        text: 'text-sky-700 dark:text-sky-400',
        border: 'border-sky-500/30',
      };
    case 'fixed':
      return {
        bg: 'bg-purple-500/10',
        text: 'text-purple-700 dark:text-purple-400',
        border: 'border-purple-500/30',
      };
    case 'retesting':
      return {
        bg: 'bg-indigo-500/10',
        text: 'text-indigo-700 dark:text-indigo-400',
        border: 'border-indigo-500/30',
      };
    case 'closed':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-700 dark:text-emerald-400',
        border: 'border-emerald-500/30',
      };
    case 'rejected':
    case 'wont_fix':
      return {
        bg: 'bg-zinc-500/10',
        text: 'text-zinc-600 dark:text-zinc-400',
        border: 'border-zinc-500/30',
      };
  }
}

const projectResolutionCache = new Map<string, string>();

/**
 * Resolves a project identifier that may be either a UUID or a Project Key (e.g. 'MORPH')
 * into the canonical project UUID with in-memory caching.
 */
export async function resolveProjectId(supabase: any, projectIdOrKey: string): Promise<string> {
  if (!projectIdOrKey) return projectIdOrKey;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectIdOrKey);
  if (isUuid) return projectIdOrKey;

  const normalized = projectIdOrKey.trim().toUpperCase();
  if (projectResolutionCache.has(normalized)) {
    return projectResolutionCache.get(normalized)!;
  }

  try {
    const { data: p } = await supabase.from('projects').select('id').ilike('key', projectIdOrKey).maybeSingle();
    if (p?.id) {
      projectResolutionCache.set(normalized, p.id);
      return p.id;
    }
  } catch (e) {
    console.error('Error resolving project id:', e);
  }
  return projectIdOrKey;
}

