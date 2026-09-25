'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { History, Search, Filter, Shield, Clock } from 'lucide-react';
import { AuditLog } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';

export default function ActivityAuditPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState('');
  const [entityFilter, setEntityFilter] = React.useState('all');

  const fetchLogs = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) console.error('Fetch audit logs error:', error);
      setLogs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  React.useEffect(() => {
    if (projectId) {
      fetchLogs();
    }
  }, [projectId, fetchLogs]);

  const filteredLogs = logs.filter((log) => {
    const action = log.action || '';
    const entityType = log.entity_type || '';
    const detailsStr = JSON.stringify(log.details || {});

    const matchesSearch =
      action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      detailsStr.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesEntity = entityFilter === 'all' || entityType === entityFilter;

    return matchesSearch && matchesEntity;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <History className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
          Audit Trail & Activity Log
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Tamper-evident chronological audit history of all test modifications, executions, defect lifecycles, and gating decisions
        </p>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit trail by action or detail..."
            className="pl-9 h-8 text-xs bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <Select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="w-40 h-8 text-xs bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
        >
          <option value="all">All Entities</option>
          <option value="test_case">Test Cases</option>
          <option value="test_run">Test Executions</option>
          <option value="issue">Defects</option>
          <option value="test_suite">Suites</option>
          <option value="environment">Environments</option>
          <option value="report_signoff">Release Sign-offs</option>
        </Select>

        <span className="text-xs text-zinc-500 font-mono ml-auto">
          {filteredLogs.length} audit records
        </span>
      </div>

      {/* Audit Log Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-zinc-100 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-xl border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/20 text-xs text-zinc-500">
          No audit logs recorded matching this filter.
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
              <tr>
                <th className="p-3 w-40">Timestamp</th>
                <th className="p-3 w-32">Action</th>
                <th className="p-3 w-28">Entity</th>
                <th className="p-3">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-mono">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                  <td className="p-3 text-zinc-500 dark:text-zinc-400 text-[11px]">
                    {formatDate(log.created_at)}
                  </td>

                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      {log.action}
                    </span>
                  </td>

                  <td className="p-3 text-zinc-600 dark:text-zinc-400 uppercase text-[10px]">
                    {log.entity_type}
                  </td>

                  <td className="p-3 font-sans text-zinc-700 dark:text-zinc-300 text-[11px]">
                    {log.details ? (
                      <span className="font-mono text-zinc-600 dark:text-zinc-400">
                        {JSON.stringify(log.details)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
