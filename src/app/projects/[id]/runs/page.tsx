'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Play,
  FileCode,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Laptop,
  ArrowRight,
  GitBranch,
} from 'lucide-react';
import { TestRun, Environment } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { JunitImportModal } from '@/components/automated/JunitImportModal';
import { formatDate, formatDuration } from '@/lib/utils';

export default function RunsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [runs, setRuns] = React.useState<any[]>([]);
  const [environments, setEnvironments] = React.useState<Environment[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [envFilter, setEnvFilter] = React.useState('all');

  // Modal
  const [isJunitModalOpen, setIsJunitModalOpen] = React.useState(false);

  const fetchRuns = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data: runsData, error } = await supabase
        .from('test_runs')
        .select(`
          *,
          test_case:test_cases(id, key, title, type),
          environment:environments(id, name, type)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) console.error('Fetch runs error:', error);

      const { data: envsData } = await supabase
        .from('environments')
        .select('*')
        .eq('project_id', projectId);

      setRuns(runsData || []);
      setEnvironments(envsData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  React.useEffect(() => {
    if (projectId) {
      fetchRuns();
    }
  }, [projectId, fetchRuns]);

  // Statistics calculation
  const totalRuns = runs.length;
  const passedRuns = runs.filter((r) => r.status === 'passed').length;
  const failedRuns = runs.filter((r) => r.status === 'failed').length;
  const blockedRuns = runs.filter((r) => r.status === 'blocked').length;
  const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0;
  const avgDuration =
    totalRuns > 0
      ? Math.round(runs.reduce((acc, r) => acc + (r.duration_ms || 0), 0) / totalRuns)
      : 0;

  // Filtered runs
  const filteredRuns = runs.filter((r) => {
    const caseKey = r.test_case?.key || '';
    const caseTitle = r.test_case?.title || '';
    const build = r.build_number || '';
    const commit = r.commit_sha || '';

    const matchesSearch =
      caseKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
      caseTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      build.toLowerCase().includes(searchQuery.toLowerCase()) ||
      commit.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesEnv = envFilter === 'all' || r.environment_id === envFilter;

    return matchesSearch && matchesStatus && matchesEnv;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Play className="h-5 w-5 text-emerald-500 fill-emerald-500" />
            Execution Runs
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Immutable log of all manual verifications, automated CI/CD runs, and retests
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsJunitModalOpen(true)}
          className="gap-1.5 self-start sm:self-auto border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
        >
          <FileCode className="h-4 w-4" />
          Import JUnit XML
        </Button>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm">
          <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase">Total Executions</span>
          <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">{totalRuns}</div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm">
          <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase">Pass Rate</span>
          <div className="text-2xl font-bold font-mono text-emerald-500 dark:text-emerald-400 mt-1">{passRate}%</div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm">
          <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase">Failures & Blocked</span>
          <div className="text-2xl font-bold font-mono text-rose-500 dark:text-rose-400 mt-1">
            {failedRuns + blockedRuns}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm">
          <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase">Avg Duration</span>
          <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
            {formatDuration(avgDuration)}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by case key, build, commit..."
            className="pl-9 h-8 text-xs"
          />
        </div>

        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-36 h-8 text-xs"
        >
          <option value="all">All Statuses</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="blocked">Blocked</option>
          <option value="skipped">Skipped</option>
          <option value="flaky">Flaky</option>
        </Select>

        <Select
          value={envFilter}
          onChange={(e) => setEnvFilter(e.target.value)}
          className="w-36 h-8 text-xs"
        >
          <option value="all">All Environments</option>
          {environments.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>

        <span className="text-xs text-zinc-500 font-mono ml-auto">
          {filteredRuns.length} recorded runs
        </span>
      </div>

      {/* Runs Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-zinc-100 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : filteredRuns.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-xl border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/20 space-y-2">
          <Play className="h-8 w-8 text-zinc-400 dark:text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-300">No Execution Runs Yet</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Execute a test case from the Test Cases Repository or stream live test results via the MorphFS AI Agent API.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
              <tr>
                <th className="p-3 w-28">Run #</th>
                <th className="p-3">Test Case</th>
                <th className="p-3 w-28">Status</th>
                <th className="p-3 w-24">Duration</th>
                <th className="p-3 w-32">Environment</th>
                <th className="p-3 w-32">Build / Commit</th>
                <th className="p-3 w-36">Timestamp</th>
                <th className="p-3 w-16 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-mono">
              {filteredRuns.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className="p-3 font-bold text-zinc-800 dark:text-zinc-300">
                    Run #{r.run_number}
                  </td>

                  <td className="p-3 font-sans">
                    {r.test_case ? (
                      <Link
                        href={`/projects/${projectId}/tests/${r.test_case.id}`}
                        className="hover:underline"
                      >
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 mr-2">
                          {r.test_case.key}
                        </span>
                        <span className="text-zinc-800 dark:text-zinc-200">{r.test_case.title}</span>
                      </Link>
                    ) : (
                      <span className="text-zinc-500">Unknown Test Case</span>
                    )}
                  </td>

                  <td className="p-3">
                    <StatusBadge status={r.status} />
                  </td>

                  <td className="p-3 text-zinc-400">
                    {formatDuration(r.duration_ms)}
                  </td>

                  <td className="p-3 text-zinc-400 truncate">
                    {r.environment?.name || '—'}
                  </td>

                  <td className="p-3 text-zinc-500 text-[11px]">
                    {r.build_number ? `b${r.build_number}` : r.commit_sha ? r.commit_sha.slice(0, 7) : '—'}
                  </td>

                  <td className="p-3 text-zinc-500 text-[11px]">
                    {formatDate(r.created_at)}
                  </td>

                  <td className="p-3 text-right">
                    {r.test_case && (
                      <Link href={`/projects/${projectId}/tests/${r.test_case.id}`}>
                        <Button size="xs" variant="ghost" className="text-zinc-400 hover:text-zinc-200">
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* JUnit XML Import Modal */}
      <JunitImportModal
        isOpen={isJunitModalOpen}
        onClose={() => setIsJunitModalOpen(false)}
        projectId={projectId}
        environments={environments}
        onImportComplete={() => fetchRuns()}
      />
    </div>
  );
}
