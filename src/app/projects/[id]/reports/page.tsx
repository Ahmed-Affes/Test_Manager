'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
  FileCheck2,
  ShieldCheck,
  Download,
  Printer,
  History,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { ReportGenerator } from '@/components/reports/ReportGenerator';
import { SignoffCard } from '@/components/reports/SignoffCard';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import { logAuditEvent } from '@/lib/audit';

export default function ReportsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [project, setProject] = React.useState<any>(null);
  const [testCases, setTestCases] = React.useState<any[]>([]);
  const [testRuns, setTestRuns] = React.useState<any[]>([]);
  const [issues, setIssues] = React.useState<any[]>([]);
  const [environments, setEnvironments] = React.useState<any[]>([]);
  const [signoffs, setSignoffs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch project info
      const { data: proj } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      // 2. Fetch test cases with suite
      const { data: cases } = await supabase
        .from('test_cases')
        .select('*, suite:test_suites(name)')
        .eq('project_id', projectId);

      // 3. Fetch test runs
      const { data: runs } = await supabase
        .from('test_runs')
        .select('*, environment:environments(name)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      // 4. Fetch issues
      const { data: iss } = await supabase
        .from('issues')
        .select('*')
        .eq('project_id', projectId);

      // 5. Fetch environments
      const { data: envs } = await supabase
        .from('environments')
        .select('*')
        .eq('project_id', projectId);

      // 6. Fetch signoff history
      const { data: signs } = await supabase
        .from('report_signoffs')
        .select('*')
        .eq('project_id', projectId)
        .order('signed_at', { ascending: false });

      setProject(proj);
      setTestCases(cases || []);
      setTestRuns(runs || []);
      setIssues(iss || []);
      setEnvironments(envs || []);
      setSignoffs(signs || []);
    } catch (err) {
      console.error('Fetch reports data error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  React.useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId, fetchData]);

  const handleSignoffSubmitted = async () => {
    await fetchData();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
        <div className="h-64 bg-zinc-900 rounded-xl border border-zinc-800 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-emerald-500" />
          Verification Reports & Release Sign-Off
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Generate comprehensive verification audit dossiers, evaluate gating constraints, and submit formal QA sign-offs
        </p>
      </div>

      {/* Release Sign-off Gating Card */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <ShieldCheck className="h-4 w-4 text-blue-400" />
          <span>Release Gate Quality Assessment</span>
        </div>
        <SignoffCard
          projectId={projectId}
          testCases={testCases}
          testRuns={testRuns}
          issues={issues}
          onSignoffComplete={handleSignoffSubmitted}
        />
      </div>

      {/* Historical Sign-offs Audit Trail */}
      {signoffs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <History className="h-4 w-4 text-zinc-400" />
            <span>Recorded Release Gate Decisions</span>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-medium">
                <tr>
                  <th className="p-3 w-32">Decision</th>
                  <th className="p-3 w-32">Role</th>
                  <th className="p-3">Sign-off Notes / Gating Comments</th>
                  <th className="p-3 w-40">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {signoffs.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-800/30">
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          s.decision === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {s.decision}
                      </span>
                    </td>
                    <td className="p-3 text-zinc-300 capitalize">{s.role}</td>
                    <td className="p-3 font-sans text-zinc-300">
                      {s.notes || <span className="text-zinc-500 italic">No notes provided</span>}
                    </td>
                    <td className="p-3 text-zinc-400 text-[11px]">{formatDate(s.signed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Structured Report Generator */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <FileCheck2 className="h-4 w-4 text-indigo-400" />
          <span>Verification Audit Dossier Generator</span>
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
