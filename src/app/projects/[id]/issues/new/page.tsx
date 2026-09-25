'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bug,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { logAuditEvent } from '@/lib/audit';

export default function NewIssuePage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.id as string;
  const supabase = createClient();

  const [projectId, setProjectId] = React.useState<string>(rawId);
  const [projectKey, setProjectKey] = React.useState<string>('TM');
  const [testCases, setTestCases] = React.useState<any[]>([]);

  // Form states
  const [issueKey, setIssueKey] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [severity, setSeverity] = React.useState('major');
  const [priority, setPriority] = React.useState('high');
  const [status, setStatus] = React.useState('open');
  const [selectedCaseId, setSelectedCaseId] = React.useState<string>('');

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadData() {
      if (!rawId) return;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);
      let pId = rawId;

      if (!isUuid) {
        const { data: p } = await supabase.from('projects').select('id, key').ilike('key', rawId).maybeSingle();
        if (p) {
          pId = p.id;
          setProjectKey(p.key);
        }
      } else {
        const { data: p } = await supabase.from('projects').select('id, key').eq('id', rawId).maybeSingle();
        if (p) setProjectKey(p.key);
      }
      setProjectId(pId);

      // Fetch test cases for linking
      const { data: casesData } = await supabase
        .from('test_cases')
        .select('id, key, title')
        .eq('project_id', pId)
        .order('key');

      if (casesData) setTestCases(casesData);

      // Auto issue key
      const { count } = await supabase
        .from('issues')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', pId);

      const nextNum = (count || 0) + 1;
      setIssueKey(`BUG-${projectKey}-${String(nextNum).padStart(3, '0')}`);
    }

    loadData();
  }, [rawId, supabase, projectKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Issue title is required.');
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: newIssue, error: insertError } = await supabase
        .from('issues')
        .insert({
          project_id: projectId,
          issue_key: issueKey.trim().toUpperCase(),
          title: title.trim(),
          description: description.trim() || null,
          severity,
          priority,
          status,
          test_case_id: selectedCaseId || null,
          reporter_id: user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Log audit
      await logAuditEvent({
        projectId,
        action: 'create',
        entityType: 'issue',
        entityId: newIssue.id,
        metadata: { title: newIssue.title, issue_key: newIssue.issue_key, severity, priority },
      });

      router.push(`/projects/${projectId}/issues`);
    } catch (err: any) {
      console.error('Create issue error:', err);
      setError(err.message || 'Failed to create defect ticket.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${projectId}/issues`}>
            <Button size="xs" variant="ghost" className="gap-1.5 text-zinc-400 hover:text-zinc-100">
              <ArrowLeft className="h-3.5 w-3.5" />
              All Issues
            </Button>
          </Link>
          <div className="h-4 w-px bg-zinc-800" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <Bug className="h-5 w-5 text-rose-500" />
              Report Verification Defect
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Log an actionable defect with reproduction details, root cause context, and severity.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold text-zinc-200">
              Issue Identification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Issue Key <span className="text-rose-400">*</span>
                </label>
                <Input
                  value={issueKey}
                  onChange={(e) => setIssueKey(e.target.value.toUpperCase())}
                  placeholder="BUG-001"
                  className="font-mono uppercase bg-zinc-950/70 border-zinc-800 text-zinc-100"
                  required
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Issue Title <span className="text-rose-400">*</span>
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Inode allocation leaks under stress load"
                  className="bg-zinc-950/70 border-zinc-800 text-zinc-100"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Reproduction Steps & Observed Behavior
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="1. Mount filesystem with ordered mode...&#10;2. Spawn 100 threads...&#10;3. Observed kernel panic or memory spike..."
                rows={4}
                className="bg-zinc-950/70 border-zinc-800 text-zinc-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Severity
                </label>
                <Select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="bg-zinc-950/70 border-zinc-800 text-zinc-100"
                >
                  <option value="critical">Critical / Blocker</option>
                  <option value="major">Major</option>
                  <option value="minor">Minor</option>
                  <option value="trivial">Trivial</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Priority
                </label>
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="bg-zinc-950/70 border-zinc-800 text-zinc-100"
                >
                  <option value="p0">P0 - Immediate</option>
                  <option value="p1">P1 - High</option>
                  <option value="p2">P2 - Medium</option>
                  <option value="p3">P3 - Low</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Initial Status
                </label>
                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="bg-zinc-950/70 border-zinc-800 text-zinc-100"
                >
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Linked Test Case (optional)
              </label>
              <Select
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                className="bg-zinc-950/70 border-zinc-800 text-zinc-100"
              >
                <option value="">-- No Test Case Linked --</option>
                {testCases.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    [{tc.key}] {tc.title}
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={`/projects/${projectId}/issues`}>
            <Button type="button" variant="outline" size="sm">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={loading || !title.trim()}
            className="gap-1.5"
          >
            {loading ? 'Submitting...' : 'Log Defect'}
          </Button>
        </div>
      </form>
    </div>
  );
}
