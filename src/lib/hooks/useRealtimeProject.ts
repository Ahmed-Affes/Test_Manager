'use client';

/**
 * useRealtimeProject
 * ------------------
 * Subscribes to Supabase Realtime postgres_changes for all key project
 * tables and calls `onRefresh` whenever any row is inserted, updated,
 * or deleted. Drop-in replacement for setInterval polling.
 *
 * Tables watched: test_cases, test_runs, issues, issue_history,
 *                 test_suites, test_steps, environments, report_signoffs
 *
 * Usage:
 *   useRealtimeProject(resolvedProjectId, fetchData);
 *
 * The hook is a no-op until `projectId` is a valid UUID — safe to call
 * before the project ID has been resolved from a slug.
 */

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const WATCHED_TABLES = [
  'test_cases',
  'test_runs',
  'issues',
  'issue_history',
  'test_suites',
  'test_steps',
  'environments',
  'report_signoffs',
];

export function useRealtimeProject(projectId: string, onRefresh: () => void) {
  const supabase = createClient();

  React.useEffect(() => {
    // Wait until we have a real UUID — slugs like "MORPH" are not filterable
    if (!projectId || !UUID_RE.test(projectId)) return;

    const channelName = `project-realtime-${projectId}`;
    let channel = supabase.channel(channelName);

    for (const table of WATCHED_TABLES) {
      channel = channel.on(
        'postgres_changes' as any,
        {
          event: '*', // INSERT | UPDATE | DELETE
          schema: 'public',
          table,
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          onRefresh();
        }
      );
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Connected — initial data already loaded by the page
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, onRefresh, supabase]);
}
