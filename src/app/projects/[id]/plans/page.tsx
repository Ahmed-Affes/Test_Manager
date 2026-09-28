'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { CalendarRange, Plus, CheckCircle2, Clock, Layers } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { useRealtimeProject } from '@/lib/hooks/useRealtimeProject';

export default function PlansPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [plans, setPlans] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [planName, setPlanName] = React.useState('');
  const [planDesc, setPlanDesc] = React.useState('');
  const [resolvedProjectId, setResolvedProjectId] = React.useState<string>('');

  const fetchPlans = React.useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
      let pId = projectId;
      if (!isUuid) {
        const { data: p } = await supabase.from('projects').select('id').ilike('key', projectId).single();
        if (p) pId = p.id;
      }
      setResolvedProjectId(pId);

      const { data, error } = await supabase
        .from('test_plans')
        .select('*')
        .eq('project_id', pId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setPlans(data);
      }
    } catch (err) {
      console.error('Failed to load plans:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  React.useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Realtime subscription — updates when AI agent creates plans/milestones
  useRealtimeProject(resolvedProjectId, fetchPlans);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim()) return;

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
      let pId = projectId;
      if (!isUuid) {
        const { data: p } = await supabase.from('projects').select('id').ilike('key', projectId).single();
        if (p) pId = p.id;
      }

      await supabase.from('test_plans').insert({
        project_id: pId,
        name: planName.trim(),
        description: planDesc.trim() || null,
        status: 'in_progress',
      });

      setIsCreateOpen(false);
      setPlanName('');
      setPlanDesc('');
      fetchPlans();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <CalendarRange className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              MorphFS PFE Milestones & Verification Cycles
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Group test suites into release cycles, regression runs, and sprint verification plans.
          </p>
        </div>

        <Button size="sm" variant="primary" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Create Milestone Plan
        </Button>
      </div>

      <div className="grid gap-3">
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-500 font-mono">
            Loading test plans...
          </div>
        ) : plans.length === 0 ? (
          <div className="p-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-center text-xs text-zinc-500">
            No test plans created yet. Group test cases to plan releases and sprint verification cycles.
          </div>
        ) : (
          plans.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 shadow-sm transition"
            >
              <div>
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  {p.name}
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono font-normal">
                    Created {formatDate(p.created_at)}
                  </span>
                </div>
                {p.description && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{p.description}</p>
                )}
              </div>

              <Badge variant="outline" className="uppercase text-[10px] tracking-wider">
                <Clock className="h-2.5 w-2.5 mr-1 text-blue-500 dark:text-blue-400" />
                {p.status}
              </Badge>
            </div>
          ))
        )}
      </div>

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Milestone Plan"
      >
        <form onSubmit={handleCreatePlan} className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
              Plan Title *
            </label>
            <Input
              placeholder="e.g. Milestone 1: Physical Disk Layout & Superblock"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              required
              className="text-xs"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
              Description / Scope
            </label>
            <Textarea
              placeholder="Scope and goals for this testing cycle..."
              value={planDesc}
              onChange={(e) => setPlanDesc(e.target.value)}
              className="text-xs min-h-[80px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <Button size="xs" variant="ghost" type="button" onClick={() => setIsCreateOpen(false)} className="text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200">
              Cancel
            </Button>
            <Button size="xs" variant="primary" type="submit">
              Create Plan
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
