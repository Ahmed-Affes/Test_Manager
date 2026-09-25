'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FolderKanban,
  ShieldCheck,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function NewProjectPage() {
  const router = useRouter();
  const supabase = createClient();

  const [key, setKey] = React.useState('');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const formattedKey = key.trim().toUpperCase();
    if (!formattedKey) {
      setError('Project Key is required (e.g. TM-101, CORE, AUTH).');
      return;
    }
    if (!name.trim()) {
      setError('Project Name is required.');
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: project, error: insertError } = await supabase
        .from('projects')
        .insert({
          key: formattedKey,
          name: name.trim(),
          description: description.trim() || null,
          owner_id: user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Add user as admin member
      if (user?.id && project?.id) {
        await supabase.from('project_members').insert({
          project_id: project.id,
          user_id: user.id,
          role: 'admin',
        });
      }

      router.push(`/projects/${project.id}`);
    } catch (err: any) {
      console.error('Create project error:', err);
      setError(err.message || 'Failed to create project container');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Navbar */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/projects">
            <Button size="xs" variant="ghost" className="gap-1.5 text-zinc-400 hover:text-zinc-100">
              <ArrowLeft className="h-3.5 w-3.5" />
              All Projects
            </Button>
          </Link>
          <div className="h-4 w-px bg-zinc-800" />
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600/10 border border-blue-500/30 text-blue-500">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-bold tracking-tight text-zinc-100 uppercase font-mono">
              Test Manager
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl">
          <Card className="border-zinc-800 bg-zinc-900/80 shadow-2xl">
            <CardHeader className="border-b border-zinc-800/80 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <FolderKanban className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-zinc-100">
                    Create Testing Project
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-400">
                    Establish an immutable quality verification container for test cases, executions, and releases.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {error && (
                <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Project Key <span className="text-rose-400">*</span>
                  </label>
                  <Input
                    placeholder="e.g. TM-101, MORPH, CORE"
                    value={key}
                    onChange={(e) => setKey(e.target.value.toUpperCase())}
                    className="font-mono uppercase bg-zinc-950/70 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500"
                    required
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Used as the prefix identifier for all automated and manual test cases (e.g. {key || 'TM-101'}-001).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Project Name <span className="text-rose-400">*</span>
                  </label>
                  <Input
                    placeholder="e.g. morphFS Linux Kernel Filesystem"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-zinc-950/70 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Description <span className="text-zinc-500 font-normal">(optional)</span>
                  </label>
                  <Textarea
                    placeholder="e.g. Linux filesystem advanced crash consistency, POSIX semantics, and VFS test suites."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="bg-zinc-950/70 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500"
                  />
                </div>

                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-end gap-3">
                  <Link href="/projects">
                    <Button type="button" variant="outline" size="sm">
                      Cancel
                    </Button>
                  </Link>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={loading || !key || !name}
                    className="gap-1.5"
                  >
                    {loading ? 'Creating Project...' : 'Initialize Project'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
