'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FolderTree, Plus, CheckSquare, Layers, ArrowRight, Play } from 'lucide-react';
import { TestSuite } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { logAuditEvent } from '@/lib/audit';
import { resolveProjectId } from '@/lib/utils';

export default function SuitesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [suites, setSuites] = React.useState<any[]>([]);
  const [resolvedProjectId, setResolvedProjectId] = React.useState<string>(projectId);
  const [loading, setLoading] = React.useState(true);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // New suite form
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');

  const fetchSuites = React.useCallback(async () => {
    setLoading(true);
    try {
      const pId = await resolveProjectId(supabase, projectId);
      setResolvedProjectId(pId);

      const { data, error } = await supabase
        .from('test_suites')
        .select(`
          *,
          test_cases:test_cases(id, title, status, test_runs:test_runs(id, status, run_number, created_at))
        `)
        .eq('project_id', pId)
        .order('created_at', { ascending: false });

      if (error) console.error('Fetch suites error:', error);
      setSuites(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  React.useEffect(() => {
    if (projectId) {
      fetchSuites();
    }
  }, [projectId, fetchSuites]);

  const handleCreateSuite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const pId = await resolveProjectId(supabase, projectId);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: newSuite, error } = await supabase
        .from('test_suites')
        .insert({
          project_id: pId,
          name: name.trim(),
          description: description.trim() || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      await logAuditEvent({
        projectId: pId,
        action: 'create_suite',
        entityType: 'test_suite',
        entityId: newSuite.id,
        details: { name: newSuite.name },
      });

      setName('');
      setDescription('');
      setIsCreateOpen(false);
      await fetchSuites();
    } catch (err) {
      console.error('Create suite error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-blue-500" />
            Verification Suites
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Organize test procedures into structured suites, functional domains, and verification modules
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="gap-1.5 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Create Test Suite
        </Button>
      </div>

      {/* Suites Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-xl bg-zinc-100 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : suites.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-xl border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/20 space-y-3">
          <FolderTree className="h-10 w-10 text-zinc-400 dark:text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-300">No Test Suites Yet</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Group your test cases by feature area, release module, or integration surface.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="gap-1.5 mt-2"
          >
            <Plus className="h-4 w-4" />
            Create First Suite
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suites.map((suite) => {
            const caseCount = suite.test_cases?.length || 0;
            let passCount = 0;
            let failCount = 0;

            suite.test_cases?.forEach((tc: any) => {
              const latestRun = (tc.test_runs || []).slice().sort(
                (a: any, b: any) =>
                  (b.run_number || 0) - (a.run_number || 0) ||
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )[0];
              if (latestRun?.status === 'pass' || latestRun?.status === 'passed') passCount++;
              if (latestRun?.status === 'fail' || latestRun?.status === 'failed') failCount++;
            });

            const passPercent = caseCount > 0 ? Math.round((passCount / caseCount) * 100) : 0;

            return (
              <div
                key={suite.id}
                className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm transition-all flex flex-col justify-between group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      Suite
                    </span>
                    <span className="text-xs font-mono text-zinc-500">
                      {caseCount} Cases
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {suite.name}
                  </h3>

                  {suite.description && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                      {suite.description}
                    </p>
                  )}
                </div>

                {/* Mini progress bar if cases exist */}
                <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                    <span>Pass Coverage</span>
                    <span className="text-zinc-900 dark:text-zinc-200 font-bold">{passPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full"
                      style={{ width: `${passPercent}%` }}
                    />
                    <div
                      className="bg-rose-500 h-full"
                      style={{
                        width: `${caseCount > 0 ? Math.round((failCount / caseCount) * 100) : 0}%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Link
                      href={`/projects/${projectId}/tests`}
                      className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                    >
                      View Cases
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Suite Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Test Suite"
      >
        <form onSubmit={handleCreateSuite} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
              Suite Name *
            </label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Disk Layout & Superblock, COW B-Tree Index"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
              Description (Optional)
            </label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope, test objectives, and target subsystems..."
              className="text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={submitting || !name.trim()}
            >
              {submitting ? 'Creating...' : 'Create Suite'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
