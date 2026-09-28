'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
  FileCheck2,
  Download,
  Printer,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  Clock,
} from 'lucide-react';
import { ReportGenerator } from '@/components/reports/ReportGenerator';
import { createClient } from '@/lib/supabase/client';
import { formatDate, resolveProjectId } from '@/lib/utils';
import { useRealtimeProject } from '@/lib/hooks/useRealtimeProject';

export default function ReportsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [project, setProject] = React.useState<any>(null);
  const [testCases, setTestCases] = React.useState<any[]>([]);
  const [testRuns, setTestRuns] = React.useState<any[]>([]);
  const [issues, setIssues] = React.useState<any[]>([]);
  const [environments, setEnvironments] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [resolvedProjectId, setResolvedProjectId] = React.useState<string>('');

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const pId = await resolveProjectId(supabase, projectId);
      setResolvedProjectId(pId);

      // Fetch all reports data concurrently
      const [projRes, casesRes, runsRes, issRes, envsRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', pId).maybeSingle(),
        supabase.from('test_cases').select('*, suite:test_suites(name)').eq('project_id', pId),
        supabase.from('test_runs').select('*, environment:environments(name)').eq('project_id', pId).order('created_at', { ascending: false }),
        supabase.from('issues').select('*').eq('project_id', pId),
        supabase.from('environments').select('*').eq('project_id', pId),
      ]);

      setProject(projRes.data);
      setTestCases(casesRes.data || []);
      setTestRuns(runsRes.data || []);
      setIssues(issRes.data || []);
      setEnvironments(envsRes.data || []);
    } catch (err) {
      console.error('Fetch reports data error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  React.useEffect(() => {
    if (projectId) fetchData();
  }, [projectId, fetchData]);

  // Realtime subscription — report refreshes live as AI agent records runs and bugs
  useRealtimeProject(resolvedProjectId, fetchData);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        <div className="h-64 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 animate-pulse" />
      </div>
    );
  }

  const hasRuns = testRuns.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-emerald-500" />
          Verification Reports & Audit Dossier
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Generate comprehensive verification audit dossiers, review quality metrics, and record formal QA sign-offs
        </p>
      </div>

      {/* Report Generator */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <FileCheck2 className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
          <span>Test Report Generator</span>
        </div>
        <ReportGenerator
          project={project}
          testCases={testCases}
          testRuns={testRuns}
          issues={issues}
          environments={environments}
        />
      </div>
    </div>
  );
}
