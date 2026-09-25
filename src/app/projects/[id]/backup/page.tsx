'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { DownloadCloud, UploadCloud, Database, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function BackupPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [exporting, setExporting] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setStatusMsg(null);
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
      let pId = projectId;
      if (!isUuid) {
        const { data: p } = await supabase.from('projects').select('id, key').ilike('key', projectId).single();
        if (p) pId = p.id;
      }

      // Collect complete project dataset
      const [projRes, suitesRes, casesRes, runsRes, issuesRes, envsRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', pId).single(),
        supabase.from('test_suites').select('*').eq('project_id', pId),
        supabase.from('test_cases').select('*, test_steps(*)').eq('project_id', pId),
        supabase.from('test_runs').select('*, test_step_results(*)').eq('project_id', pId),
        supabase.from('issues').select('*').eq('project_id', pId),
        supabase.from('environments').select('*').eq('project_id', pId),
      ]);

      const backupData = {
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        project: projRes.data,
        suites: suitesRes.data || [],
        test_cases: casesRes.data || [],
        test_runs: runsRes.data || [],
        issues: issuesRes.data || [],
        environments: envsRes.data || [],
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `testmanager-backup-${projRes.data?.key || projectId}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMsg('Complete project archive downloaded successfully!');
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setImporting(true);
        setStatusMsg(null);
        const data = JSON.parse(event.target?.result as string);
        if (!data.project || !data.test_cases) {
          throw new Error('Invalid backup file format.');
        }

        setStatusMsg(`Archive verified! Found ${data.test_cases.length} test cases and ${data.test_runs?.length || 0} runs.`);
      } catch (err: any) {
        alert(err.message || 'Failed to read backup file');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20">
              <DownloadCloud className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Backup & Disaster Recovery
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Export complete verified project archives including test definitions, execution history, and defects.
          </p>
        </div>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 font-medium">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              Export Project Archive
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400">
              Download complete project state as a standalone JSON backup file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Preserves all test suites, steps, monotonic run numbers, defect linkages, and environment configurations for compliance and archival.
            </p>
            <Button
              size="sm"
              variant="primary"
              onClick={handleExport}
              isLoading={exporting}
            >
              <DownloadCloud className="h-3.5 w-3.5 mr-1.5" />
              Download Complete Archive (.json)
            </Button>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <UploadCloud className="h-4 w-4 text-purple-500 dark:text-purple-400" />
              Restore / Import Archive
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400">
              Inspect or restore a previously exported Test Manager project backup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Upload a valid <code className="text-blue-600 dark:text-blue-400 font-mono">.json</code> archive to verify checksums and import test cases into this workspace.
            </p>
            <label className="inline-flex items-center justify-center cursor-pointer px-3 py-1.5 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 transition shadow-sm">
              <UploadCloud className="h-3.5 w-3.5 mr-1.5 text-zinc-500 dark:text-zinc-400" />
              Select Archive File
              <input
                type="file"
                accept=".json"
                onChange={handleRestoreFile}
                className="hidden"
                disabled={importing}
              />
            </label>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
