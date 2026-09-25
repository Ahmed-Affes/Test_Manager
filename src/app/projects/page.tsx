'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  FolderKanban,
  Plus,
  Search,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Bug,
  Clock,
  ArrowRight,
  LogOut,
  FolderGit2,
} from 'lucide-react';
import { Project } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function ProjectsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [projects, setProjects] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  // New project form state
  const [newKey, setNewKey] = React.useState('');
  const [newName, setNewName] = React.useState('');
  const [newDesc, setNewDesc] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const fetchProjects = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          test_cases:test_cases(count),
          issues:issues(count),
          test_runs:test_runs(status)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch projects error:', error);
      } else {
        setProjects(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const keyFormatted = newKey.trim().toUpperCase();
      const { data, error } = await supabase
        .from('projects')
        .insert({
          key: keyFormatted,
          name: newName.trim(),
          description: newDesc.trim() || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      setIsCreateOpen(false);
      setNewKey('');
      setNewName('');
      setNewDesc('');
      router.push(`/projects/${data.id}`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Navbar */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/10 border border-blue-500/30 text-blue-500">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-zinc-100">TEST MANAGER</h1>
            <p className="text-[10px] text-zinc-500 font-mono -mt-0.5">Verification Workspace</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="xs"
            variant="ghost"
            onClick={handleSignOut}
            className="text-zinc-400 hover:text-zinc-100 gap-1.5"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-100">
              Software Verification Projects
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Select a project workspace to inspect test suites, execution history, and release sign-offs
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="gap-1.5 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects by key or name..."
              className="pl-9 h-9 text-xs bg-zinc-900/60 border-zinc-800"
            />
          </div>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 rounded-xl border border-zinc-800 bg-zinc-900/40 animate-pulse"
              />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-12 text-center border border-dashed rounded-xl border-zinc-800 bg-zinc-900/20 space-y-3">
            <FolderGit2 className="h-10 w-10 text-zinc-600 mx-auto" />
            <h3 className="text-sm font-semibold text-zinc-300">No Projects Found</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Get started by creating your first software testing project to track tests, runs, and defect history.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="gap-1.5 mt-2"
            >
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => {
              const testCaseCount = project.test_cases?.[0]?.count || 0;
              const issueCount = project.issues?.[0]?.count || 0;
              const runs = project.test_runs || [];
              const passCount = runs.filter((r: any) => r.status === 'pass').length;
              const passRate = runs.length > 0 ? Math.round((passCount / runs.length) * 100) : 0;

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="group relative flex flex-col justify-between p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-zinc-700 transition-all shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold">
                        {project.key}
                      </span>
                      <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-zinc-200 group-hover:translate-x-0.5 transition-all" />
                    </div>

                    <div>
                      <h3 className="font-bold text-sm text-zinc-100 group-hover:text-white transition-colors">
                        {project.name}
                      </h3>
                      {project.description && (
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs font-mono text-zinc-400">
                    <div className="flex items-center gap-3">
                      <span>{testCaseCount} tests</span>
                      <span>•</span>
                      <span className={issueCount > 0 ? 'text-amber-400 font-semibold' : ''}>
                        {issueCount} issues
                      </span>
                    </div>

                    {runs.length > 0 && (
                      <span className="text-emerald-400 font-semibold">
                        {passRate}% pass
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* New Project Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        size="md"
        title="Create Testing Project"
        description="Establish a new verified project container for test cases, executions, and releases"
      >
        <form onSubmit={handleCreateProject} className="space-y-4 text-xs">
          {formError && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono">
              {formError}
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
              Project Key * (e.g. AUTH, BILLING, CORE)
            </label>
            <Input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value.toUpperCase())}
              placeholder="e.g. TM"
              maxLength={10}
              required
              className="font-mono uppercase bg-zinc-950 border-zinc-800"
            />
            <p className="text-[10px] text-zinc-500 mt-1">
              Used as the prefix for all test cases and issue identifiers (e.g. TM-101)
            </p>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
              Project Name *
            </label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Payment Gateway Engine"
              required
              className="bg-zinc-950 border-zinc-800"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
              Description
            </label>
            <Textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Purpose, target architecture, or scope of verification..."
              rows={3}
              className="bg-zinc-950 border-zinc-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Establish Project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
