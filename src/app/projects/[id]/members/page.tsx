'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Users, UserPlus, Shield, Mail, CheckCircle2, Copy, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { ProjectMember, ProjectRole } from '@/lib/types';

export default function MembersPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [members, setMembers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<ProjectRole>('tester');
  const [inviteSuccess, setInviteSuccess] = React.useState<string | null>(null);

  const fetchMembers = React.useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
      let pId = projectId;
      if (!isUuid) {
        const { data: p } = await supabase.from('projects').select('id').ilike('key', projectId).single();
        if (p) pId = p.id;
      }

      const { data, error } = await supabase
        .from('project_members')
        .select(`
          id,
          role,
          created_at,
          user:users (
            id,
            email,
            full_name,
            avatar_url
          )
        `)
        .eq('project_id', pId);

      if (!error && data) {
        setMembers(data);
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  React.useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
      let pId = projectId;
      if (!isUuid) {
        const { data: p } = await supabase.from('projects').select('id').ilike('key', projectId).single();
        if (p) pId = p.id;
      }

      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await supabase.from('project_invitations').insert({
        project_id: pId,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        token,
        expires_at: expiresAt,
      });

      setInviteSuccess(`Invitation token generated for ${inviteEmail}!`);
      setInviteEmail('');
      setTimeout(() => {
        setIsInviteOpen(false);
        setInviteSuccess(null);
      }, 2000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Users className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">
              MorphFS Co-Op Engineering Team & Academic Jury
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Collaborative systems engineering roles, live test execution permissions, and formal PFE defense sign-off authorities.
          </p>
        </div>

        <Button size="sm" variant="primary" onClick={() => setIsInviteOpen(true)} className="bg-purple-600 hover:bg-purple-500 text-white">
          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
          Invite Contributor
        </Button>
      </div>

      {/* Core PFE Co-Op Roles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-purple-600/30 text-purple-400 font-bold flex items-center justify-center font-mono border border-purple-500/40">
              AA
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300">
              LEAD AUTHOR
            </span>
          </div>
          <div>
            <div className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
              <span>Ahmed Affes</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" title="Online" />
            </div>
            <div className="text-[11px] text-purple-400 font-mono">Lead Systems Architect</div>
            <div className="text-xs text-zinc-400 mt-1">
              Core storage engine, copy-on-write, circular journal, crash recovery & invariant fuzzing suites.
            </div>
          </div>
          <div className="text-[10px] font-mono text-zinc-500 pt-2 border-t border-purple-500/20 flex items-center justify-between">
            <span>Privileges: Full Admin / Commits</span>
            <span className="text-emerald-400">ACTIVE</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center font-mono border border-blue-500/40">
              CO
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300">
              CO-AUTHOR
            </span>
          </div>
          <div>
            <div className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
              <span>Engineering Co-Author</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" title="Online" />
            </div>
            <div className="text-[11px] text-blue-400 font-mono">Systems Co-Developer</div>
            <div className="text-xs text-zinc-400 mt-1">
              MFP sync protocol, Windows Explorer shell context menus, Control Center & benchmarking.
            </div>
          </div>
          <div className="text-[10px] font-mono text-zinc-500 pt-2 border-t border-blue-500/20 flex items-center justify-between">
            <span>Privileges: Test Execution & Retests</span>
            <span className="text-emerald-400">ACTIVE</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-emerald-600/30 text-emerald-400 font-bold flex items-center justify-center font-mono border border-emerald-500/40">
              PR
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300">
              ACADEMIC JURY
            </span>
          </div>
          <div>
            <div className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
              <span>Prof. Academic Advisor</span>
              <span className="h-2 w-2 rounded-full bg-purple-400" title="Reviewing" />
            </div>
            <div className="text-[11px] text-emerald-400 font-mono">PFE Jury President & Evaluator</div>
            <div className="text-xs text-zinc-400 mt-1">
              Verification audit dossier review, reference model inspection & formal graduation release gate sign-off.
            </div>
          </div>
          <div className="text-[10px] font-mono text-zinc-500 pt-2 border-t border-emerald-500/20 flex items-center justify-between">
            <span>Privileges: Gating Authority & Audit</span>
            <span className="text-purple-400">REVIEWING</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
          Workspace Registered Accounts
        </h3>
        <div className="grid gap-3">
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-500 font-mono">
            Loading team roster...
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 border border-dashed border-zinc-800 rounded-lg text-center text-xs text-zinc-500">
            No team members listed yet.
          </div>
        ) : (
          members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900/60 transition"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-xs uppercase font-mono">
                  {m.user?.full_name?.charAt(0) || m.user?.email?.charAt(0) || 'U'}
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-100 flex items-center gap-2">
                    {m.user?.full_name || 'QA Engineer'}
                    <span className="text-[10px] font-normal text-zinc-500 font-mono">
                      Joined {formatDate(m.created_at)}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono">{m.user?.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge
                  variant={
                    m.role === 'owner'
                      ? 'destructive'
                      : m.role === 'admin'
                        ? 'secondary'
                        : 'outline'
                  }
                  className="uppercase text-[10px] tracking-wider font-semibold"
                >
                  <Shield className="h-2.5 w-2.5 mr-1" />
                  {m.role}
                </Badge>
              </div>
            </div>
          ))
        )}
        </div>
      </div>

      <Modal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invite Team Member"
      >
        <form onSubmit={handleInvite} className="space-y-4">
          {inviteSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{inviteSuccess}</span>
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
              Corporate Email Address
            </label>
            <Input
              type="email"
              placeholder="engineer@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              className="text-xs bg-zinc-950 border-zinc-800"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
              Role & Permissions
            </label>
            <Select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as ProjectRole)}
              className="text-xs bg-zinc-950 border-zinc-800"
            >
              <option value="tester">Tester (Execute runs, log defects, view tests)</option>
              <option value="admin">Admin (Manage suites, assign sign-offs, edit project)</option>
              <option value="viewer">Viewer (Read-only access to tests and reports)</option>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="xs" variant="ghost" type="button" onClick={() => setIsInviteOpen(false)}>
              Cancel
            </Button>
            <Button size="xs" variant="primary" type="submit">
              Send Invitation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
