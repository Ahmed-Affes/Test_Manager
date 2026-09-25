'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
  Server,
  Plus,
  Laptop,
  Globe,
  Smartphone,
  Cpu,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Environment } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { formatDate } from '@/lib/utils';
import { logAuditEvent } from '@/lib/audit';

export default function EnvironmentsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [environments, setEnvironments] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Form fields
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState('staging');
  const [os, setOs] = React.useState('');
  const [browser, setBrowser] = React.useState('');
  const [device, setDevice] = React.useState('');
  const [baseUrl, setBaseUrl] = React.useState('');

  const fetchEnvironments = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('environments')
        .select(`
          *,
          test_runs:test_runs(id, status, created_at)
        `)
        .eq('project_id', projectId)
        .order('name');

      if (error) console.error('Fetch environments error:', error);
      setEnvironments(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  React.useEffect(() => {
    if (projectId) {
      fetchEnvironments();
    }
  }, [projectId, fetchEnvironments]);

  const handleCreateEnvironment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const { data: newEnv, error } = await supabase
        .from('environments')
        .insert({
          project_id: projectId,
          name: name.trim(),
          type,
          os: os.trim() || null,
          browser: browser.trim() || null,
          device: device.trim() || null,
          base_url: baseUrl.trim() || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      await logAuditEvent({
        projectId,
        action: 'create_environment',
        entityType: 'environment',
        entityId: newEnv.id,
        details: { name: newEnv.name, type: newEnv.type },
      });

      setName('');
      setOs('');
      setBrowser('');
      setDevice('');
      setBaseUrl('');
      setIsModalOpen(false);
      await fetchEnvironments();
    } catch (err) {
      console.error('Create environment error:', err);
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
            <Server className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            Test Environments & Device Matrix
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Configured execution targets, staging endpoints, browser topologies, and OS profiles
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          className="gap-1.5 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Add Environment
        </Button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-xl bg-zinc-100 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : environments.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-xl border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/20 space-y-3">
          <Server className="h-10 w-10 text-zinc-400 dark:text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-300">No Environments Configured</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Define target environments (e.g., Windows 11 Co-Op Dev, NTFS Comparison Bench, WSL2 Ubuntu) to track executions accurately.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="gap-1.5 mt-2"
          >
            <Plus className="h-4 w-4" />
            Add First Environment
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {environments.map((env) => {
            const runCount = env.test_runs?.length || 0;
            return (
              <div
                key={env.id}
                className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 font-bold">
                      {env.type}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                      Active
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{env.name}</h3>
                    {env.base_url && (
                      <a
                        href={env.base_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-mono mt-0.5 truncate"
                      >
                        <Globe className="h-3 w-3" />
                        {env.base_url}
                      </a>
                    )}
                  </div>

                  {/* Environment Hardware/Browser Specs */}
                  <div className="space-y-1 pt-1 text-xs text-zinc-600 dark:text-zinc-400 font-mono">
                    {env.os && (
                      <div className="flex items-center gap-2">
                        <Laptop className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                        <span>{env.os}</span>
                      </div>
                    )}
                    {env.browser && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                        <span>{env.browser}</span>
                      </div>
                    )}
                    {env.device && (
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                        <span>{env.device}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800 text-[11px] font-mono text-zinc-500 flex items-center justify-between">
                  <span>{runCount} test runs recorded</span>
                  <span className="text-zinc-700 dark:text-zinc-400 font-medium">{formatDate(env.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Environment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Test Environment"
      >
        <form onSubmit={handleCreateEnvironment} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Environment Name *
              </label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Windows 11 Pro (WSL2), QEMU Raw Disk"
                className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Environment Type
              </label>
              <Select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
              >
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
                <option value="uat">UAT / Beta</option>
                <option value="sandbox">Sandbox / Benchmark</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
              Base URL / Host Endpoint (Optional)
            </label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="e.g. \\.\PhysicalDrive1 or http://localhost:8080"
              className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                OS & Version
              </label>
              <Input
                value={os}
                onChange={(e) => setOs(e.target.value)}
                placeholder="Windows 11 23H2"
                className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Browser & Version / Tool
              </label>
              <Input
                value={browser}
                onChange={(e) => setBrowser(e.target.value)}
                placeholder="PowerShell 7 / FIO"
                className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Device / Arch
              </label>
              <Input
                value={device}
                onChange={(e) => setDevice(e.target.value)}
                placeholder="NVMe PCIe 4.0 / x86_64"
                className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={submitting || !name.trim()}
            >
              {submitting ? 'Adding...' : 'Add Environment'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
