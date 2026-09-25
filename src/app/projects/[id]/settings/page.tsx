'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Settings,
  Save,
  ShieldAlert,
  Key,
  Terminal,
  Copy,
  Check,
  Trash2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { logAuditEvent } from '@/lib/audit';

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const supabase = createClient();

  const [project, setProject] = React.useState<any>(null);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [minPassRate, setMinPassRate] = React.useState('90');
  const [zeroBlockers, setZeroBlockers] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [copiedCurl, setCopiedCurl] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const fetchProject = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      setProject(data);
      setName(data.name);
      setDescription(data.description || '');
    } catch (err) {
      console.error('Fetch project error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  React.useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId, fetchProject]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: name.trim(),
          description: description.trim() || null,
        })
        .eq('id', projectId);

      if (error) throw error;

      await logAuditEvent({
        projectId,
        action: 'update_project_settings',
        entityType: 'project',
        entityId: projectId,
        details: { name: name.trim() },
      });

      setMessage('Project settings saved successfully.');
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const curlExample = `curl -X POST "${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/projects/${projectId}/import-junit" \\
  -H "Content-Type: application/xml" \\
  -H "x-api-key: YOUR_PROJECT_API_KEY" \\
  --data-binary @test-results.xml`;

  const copyCurlToClipboard = () => {
    navigator.clipboard.writeText(curlExample);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        <div className="h-64 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Settings className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
          Project Configuration & CI/CD Integration
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          General project settings, quality gating rules, and automated pipeline integration endpoints
        </p>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-xs font-mono border ${
            message.startsWith('Error')
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {message}
        </div>
      )}

      {/* General Settings */}
      <form onSubmit={handleSave} className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-200">General Information</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
              Project Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
              Project Key (Immutable Prefix)
            </label>
            <Input
              value={project?.key || ''}
              disabled
              className="bg-zinc-100 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-500 cursor-not-allowed"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
            Description
          </label>
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={saving}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>

      {/* CI/CD Ingestion Endpoint */}
      <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-200 flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              Automated CI/CD Test Results Ingestion
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Integrate GitHub Actions, GitLab CI, or Jenkins to automatically post JUnit XML reports
            </p>
          </div>
          <Button
            size="xs"
            variant="outline"
            onClick={copyCurlToClipboard}
            className="gap-1 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
          >
            {copiedCurl ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy cURL
              </>
            )}
          </Button>
        </div>

        <div className="relative">
          <pre className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 text-emerald-400 font-mono text-xs overflow-x-auto">
            {curlExample}
          </pre>
        </div>
      </div>

      {/* Quality Gating Policies */}
      <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm space-y-4">
        <div className="space-y-0.5">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-200 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            Release Quality Gating Rules
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Define programmatic criteria required to approve release sign-offs
          </p>
        </div>

        <div className="space-y-3 pt-2 text-xs">
          <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
            <div>
              <span className="font-semibold text-zinc-900 dark:text-zinc-200 block">
                Zero Open Blocker / Critical Defects
              </span>
              <span className="text-zinc-500 text-[11px]">
                Block release sign-off if any unresolved blocker defects exist
              </span>
            </div>
            <input
              type="checkbox"
              checked={zeroBlockers}
              onChange={(e) => setZeroBlockers(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-blue-600 focus:ring-0"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
            <div>
              <span className="font-semibold text-zinc-900 dark:text-zinc-200 block">
                Minimum Verification Pass Rate
              </span>
              <span className="text-zinc-500 text-[11px]">
                Requires at least this percentage of passing test executions
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono">
              <Input
                type="number"
                min="50"
                max="100"
                value={minPassRate}
                onChange={(e) => setMinPassRate(e.target.value)}
                className="w-16 h-7 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
              <span className="text-zinc-500 dark:text-zinc-400">%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
