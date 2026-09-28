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
import { useProjectPresence, formatActivityText } from '@/lib/hooks/useProjectPresence';

export default function MembersPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [currentUser, setCurrentUser] = React.useState<any>(null);
  const [members, setMembers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<ProjectRole>('tester');
  const [inviteSuccess, setInviteSuccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUser({
          id: data.user.id,
          email: data.user.email || '',
          full_name: data.user.user_metadata?.full_name || null,
          avatar_url: null,
          created_at: new Date().toISOString(),
        });
      }
    });
  }, [supabase]);

  const { members: presenceMembers, isConnected } = useProjectPresence(projectId, currentUser);

  const ahmedPresence = presenceMembers.find(
    (m) => m.id === '78d6ac01-5144-4327-a291-e703b27e103c' || m.email === 'ahmedaffes@gmail.com'
  );
  const wacimPresence = presenceMembers.find(
    (m) => m.id === '79e1aa71-7e62-44f4-883f-4be8fee1f57e' || m.email === 'wacimabdelli@gmail.com'
  );
  const profPresence = presenceMembers.find(
    (m) => m.id === '1406aa55-3c12-49f7-adf6-a30fbfea7f42' || m.email === 'professor@morphfs.dev'
  );

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

      const { data: mData, error: mErr } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', pId);

      if (mErr) throw mErr;

      const userIds = (mData || []).map((m: any) => m.user_id);
      const { data: pData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      const combined = (mData || []).map((m: any) => ({
        ...m,
        user: pData?.find((p: any) => p.id === m.user_id),
      }));

      setMembers(combined);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Users className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              MorphFS Co-Op Engineering Team & Academic Jury
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
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
        {/* Ahmed Affes */}
        <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 dark:bg-purple-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-purple-600/30 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center font-mono border border-purple-500/40">
              AA
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-700 dark:text-purple-300">
              OWNER (LEAD)
            </span>
          </div>
          <div>
            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>Ahmed Affes</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  ahmedPresence?.status === 'online'
                    ? 'bg-emerald-500 animate-pulse'
                    : ahmedPresence?.status === 'away'
                      ? 'bg-amber-500'
                      : 'bg-zinc-400'
                }`}
                title={
                  ahmedPresence?.status === 'online'
                    ? 'Active Now'
                    : ahmedPresence?.status === 'away'
                      ? 'Away'
                      : 'Offline'
                }
              />
            </div>
            <div className="text-[11px] text-purple-600 dark:text-purple-400 font-mono">Lead Systems Architect & Core Author</div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
              Core storage engine, copy-on-write, circular journal, crash recovery & invariant fuzzing suites.
            </div>
          </div>
          <div className="text-[10px] font-mono text-zinc-500 pt-2 border-t border-purple-500/20 flex items-center justify-between">
            <span>Privileges: Full Owner / Commits & Admin</span>
            {ahmedPresence?.status === 'online' ? (
              <span className="text-emerald-500 font-semibold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ACTIVE NOW
              </span>
            ) : ahmedPresence?.status === 'away' ? (
              <span className="text-amber-500 font-semibold">AWAY</span>
            ) : (
              <span className="text-zinc-400 font-semibold">
                {ahmedPresence?.lastSeenAt ? formatActivityText(ahmedPresence) : 'OFFLINE'}
              </span>
            )}
          </div>
        </div>

        {/* Wacim Abdelli */}
        <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-blue-600/30 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center font-mono border border-blue-500/40">
              WA
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-700 dark:text-blue-300">
              OWNER (CO-AUTHOR)
            </span>
          </div>
          <div>
            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>Wacim Abdelli</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  wacimPresence?.status === 'online'
                    ? 'bg-emerald-500 animate-pulse'
                    : wacimPresence?.status === 'away'
                      ? 'bg-amber-500'
                      : 'bg-zinc-400'
                }`}
                title={
                  wacimPresence?.status === 'online'
                    ? 'Active Now'
                    : wacimPresence?.status === 'away'
                      ? 'Away'
                      : 'Offline'
                }
              />
            </div>
            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-mono">Systems Engineering Co-Author</div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
              MFP sync protocol, Windows Explorer shell context menus, Control Center & benchmarking.
            </div>
          </div>
          <div className="text-[10px] font-mono text-zinc-500 pt-2 border-t border-blue-500/20 flex items-center justify-between">
            <span>Privileges: Full Owner / Test Execution & Commits</span>
            {wacimPresence?.status === 'online' ? (
              <span className="text-emerald-500 font-semibold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ACTIVE NOW
              </span>
            ) : wacimPresence?.status === 'away' ? (
              <span className="text-amber-500 font-semibold">AWAY</span>
            ) : (
              <span className="text-zinc-400 font-semibold">
                {wacimPresence?.lastSeenAt ? formatActivityText(wacimPresence) : 'OFFLINE'}
              </span>
            )}
          </div>
        </div>

        {/* Prof. Academic Advisor */}
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-emerald-600/30 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center font-mono border border-emerald-500/40">
              PR
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              VIEWER (JURY)
            </span>
          </div>
          <div>
            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <span>Prof. Academic Advisor</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  profPresence?.status === 'online'
                    ? 'bg-emerald-500 animate-pulse'
                    : profPresence?.status === 'away'
                      ? 'bg-amber-500'
                      : 'bg-zinc-400'
                }`}
                title={profPresence?.status === 'online' ? 'Active Now' : 'Offline / Read-Only Review'}
              />
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">PFE Jury President & Evaluator</div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
              Verification audit dossier review, reference model inspection & formal release sign-off.
            </div>
          </div>
          <div className="text-[10px] font-mono text-zinc-500 pt-2 border-t border-emerald-500/20 flex items-center justify-between">
            <span>Privileges: Read-Only Audit & Evaluation Sign-Off</span>
            {profPresence?.status === 'online' ? (
              <span className="text-emerald-500 font-semibold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ACTIVE NOW
              </span>
            ) : (
              <span className="text-zinc-400 font-semibold">VIEWER</span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
          Workspace Registered Accounts
        </h3>
        <div className="grid gap-3">
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-500 font-mono">
            Loading team roster...
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-center text-xs text-zinc-500">
            No team members listed yet.
          </div>
        ) : (
          members.map((m) => {
            const memberPresence = presenceMembers.find(
              (pm) =>
                pm.id === m.user_id ||
                (m.user?.email && pm.email?.toLowerCase() === m.user.email.toLowerCase())
            );
            return (
              <div
                key={m.id}
                className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 shadow-sm transition"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-9 w-9 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-xs uppercase font-mono">
                      {m.user?.full_name?.charAt(0) || m.user?.email?.charAt(0) || 'U'}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-zinc-900 ${
                        memberPresence?.status === 'online'
                          ? 'bg-emerald-500 animate-pulse'
                          : memberPresence?.status === 'away'
                            ? 'bg-amber-500'
                            : 'bg-zinc-400'
                      }`}
                      title={
                        memberPresence?.status === 'online'
                          ? 'Active Now'
                          : memberPresence?.status === 'away'
                            ? 'Away'
                            : 'Offline'
                      }
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      {m.user?.full_name || 'QA Engineer'}
                      <span className="text-[10px] font-normal text-zinc-400 dark:text-zinc-500 font-mono">
                        Joined {formatDate(m.created_at)}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                      {m.user?.email}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {memberPresence?.status === 'online' ? (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800/80">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      ACTIVE
                    </span>
                  ) : memberPresence?.status === 'away' ? (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800/80">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      AWAY
                    </span>
                  ) : (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">
                      OFFLINE
                    </span>
                  )}

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
            );
          })
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
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{inviteSuccess}</span>
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
              Corporate Email Address
            </label>
            <Input
              type="email"
              placeholder="engineer@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              className="text-xs"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
              Role & Permissions
            </label>
            <Select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as ProjectRole)}
              className="text-xs"
            >
              <option value="tester">Tester (Execute runs, log defects, view tests)</option>
              <option value="admin">Admin (Manage suites, assign sign-offs, edit project)</option>
              <option value="viewer">Viewer (Read-only access to tests and reports)</option>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <Button size="xs" variant="ghost" type="button" onClick={() => setIsInviteOpen(false)} className="text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200">
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
