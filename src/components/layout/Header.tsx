'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Bell,
  User,
  LogOut,
  Play,
  Plus,
  Moon,
  Sun,
  Shield,
  Radio,
  Users,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Project, UserProfile } from '@/lib/types';
import { CommandPalette } from '@/components/layout/CommandPalette';

interface HeaderProps {
  currentProject?: Project;
  user?: UserProfile | null;
  onOpenCommandPalette?: () => void;
  onOpenQuickExecute?: () => void;
}

interface TeamMemberPresence {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'tester' | 'viewer';
  title: string;
  duty: string;
  initials: string;
  avatarColor: string;
  isOnline: boolean;
}

export function Header({
  currentProject,
  user,
  onOpenCommandPalette,
  onOpenQuickExecute,
}: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [coopMenuOpen, setCoopMenuOpen] = React.useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [isDark, setIsDark] = React.useState(false);
  const [friendSimulatedOnline, setFriendSimulatedOnline] = React.useState(true);
  const [onlineUserIds, setOnlineUserIds] = React.useState<string[]>([]);
  const [teamMembers, setTeamMembers] = React.useState<TeamMemberPresence[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = React.useState(0);

  // Fetch unread notifications
  React.useEffect(() => {
    async function checkNotifications() {
      if (!user?.id) return;
      try {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false);
        setUnreadNotificationsCount(count || 0);
      } catch (e) {}
    }
    checkNotifications();
  }, [user?.id, supabase]);

  // Dark mode detection
  React.useEffect(() => {
    const isDarkNow = document.documentElement.classList.contains('dark');
    setIsDark(isDarkNow);
  }, []);

  const toggleDarkMode = () => {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('morphfs_theme', 'light');
      } catch (e) {}
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      try {
        localStorage.setItem('morphfs_theme', 'dark');
      } catch (e) {}
      setIsDark(true);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // Global Ctrl+K / Cmd+K listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (onOpenCommandPalette) {
          onOpenCommandPalette();
        } else {
          setCommandPaletteOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenCommandPalette]);

  // Fetch real project members and listen for real-time presence
  React.useEffect(() => {
    if (!currentProject?.id) return;

    let isMounted = true;
    const pId = currentProject.id;

    const loadMembers = async () => {
      try {
        const { data: mData } = await supabase
          .from('project_members')
          .select('id, user_id, role')
          .eq('project_id', pId);

        const userIds = (mData || []).map((m: any) => m.user_id);
        const { data: pData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);

        if (!isMounted) return;

        // Build roster with known profiles or defaults
        const roster: TeamMemberPresence[] = [
          {
            id: '78d6ac01-5144-4327-a291-e703b27e103c',
            name: 'Ahmed Affes',
            email: 'ahmedaffes@gmail.com',
            role: 'owner',
            title: 'Lead Systems Architect & Core Author',
            duty: 'Authoring Crash Consistency, Invariant Suites & Journal Testing',
            initials: 'AA',
            avatarColor: 'bg-purple-600',
            isOnline: true, // Lead is always active when viewing
          },
          {
            id: '79e1aa71-7e62-44f4-883f-4be8fee1f57e',
            name: 'Wacim Abdelli',
            email: 'wacimabdelli@gmail.com',
            role: 'owner',
            title: 'Systems Engineering Co-Author',
            duty: 'Executing MFP Sync, Shell Extensions & Benchmark Cycles',
            initials: 'WA',
            avatarColor: 'bg-blue-600',
            isOnline: friendSimulatedOnline,
          },
          {
            id: '1406aa55-3c12-49f7-adf6-a30fbfea7f42',
            name: 'Prof. Academic Advisor',
            email: 'professor@morphfs.dev',
            role: 'viewer',
            title: 'Academic Advisor & PFE Jury Evaluator',
            duty: 'Reviewing Verification Dossier & Formal PFE Defense Sign-Offs',
            initials: 'PR',
            avatarColor: 'bg-emerald-600',
            isOnline: false, // Professor is viewer / review mode
          },
        ];

        // Enrich with database role & profile updates if any
        if (mData) {
          mData.forEach((m: any) => {
            const match = roster.find((r) => r.id === m.user_id);
            if (match) {
              match.role = m.role as any;
            }
          });
        }
        if (pData) {
          pData.forEach((p: any) => {
            const match = roster.find((r) => r.id === p.id);
            if (match) {
              if (p.full_name) match.name = p.full_name;
              if (p.email) match.email = p.email;
              if (p.full_name) {
                const parts = p.full_name.trim().split(/\s+/);
                if (parts.length >= 2) {
                  match.initials = `${parts[0][0]}${parts[1][0]}`.toUpperCase();
                } else if (parts.length === 1 && parts[0].length >= 2) {
                  match.initials = parts[0].substring(0, 2).toUpperCase();
                }
              }
            }
          });
        }

        setTeamMembers(roster);
      } catch (err) {
        console.error('Error fetching members for header:', err);
      }
    };

    loadMembers();

    // Supabase Realtime Presence Channel
    const channel = supabase.channel(`presence:morphfs:${pId}`, {
      config: {
        presence: {
          key: user?.id || 'guest-session',
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activeIds = Object.keys(state);
        setOnlineUserIds(activeIds);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUserIds((prev) => Array.from(new Set([...prev, key])));
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUserIds((prev) => prev.filter((id) => id !== key));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && user) {
          await channel.track({
            user_id: user.id,
            email: user.email,
            full_name: user.full_name,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [currentProject?.id, user, friendSimulatedOnline, supabase]);

  // Compute live presence state
  const resolvedMembers = teamMembers.map((m) => {
    const isSelf = user?.id === m.id || user?.email === m.email;
    const isChannelOnline = onlineUserIds.includes(m.id);
    const isFriend =
      m.id === '79e1aa71-7e62-44f4-883f-4be8fee1f57e' ||
      m.email === 'wacimabdelli@gmail.com' ||
      m.email === 'friend@morphfs.dev';
    const isOnline = isSelf || (isFriend ? friendSimulatedOnline : isChannelOnline);
    return { ...m, isOnline };
  });

  const onlineCount = resolvedMembers.filter((m) => m.isOnline).length;

  const handleOpenSearch = () => {
    if (onOpenCommandPalette) {
      onOpenCommandPalette();
    } else {
      setCommandPaletteOpen(true);
    }
  };

  return (
    <>
      <header className="h-14 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/80 backdrop-blur-md px-4 flex items-center justify-between gap-4 z-20 shrink-0">
        {/* Left: MorphFS Brand & Project Identifier */}
        <div className="flex items-center gap-3 text-xs">
          <Link
            href={currentProject ? `/projects/${currentProject.id}` : '/projects'}
            className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600/10 border border-purple-500/30 text-purple-600 dark:text-purple-400">
              <span className="font-mono text-xs font-bold">M</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-zinc-900 dark:text-zinc-100">MorphFS</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
                  WIN-EDITION
                </span>
              </div>
              <div className="text-[10px] text-zinc-500 font-mono -mt-0.5">
                PFE Capstone Verification
              </div>
            </div>
          </Link>
        </div>

        {/* Middle: Command Palette & Co-Op Live Team Bar */}
        <div className="flex items-center gap-3 flex-1 max-w-xl justify-center">
          {/* Co-Op Live Presence Bar */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setCoopMenuOpen(!coopMenuOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-purple-200/80 dark:border-purple-500/30 bg-purple-50/70 dark:bg-purple-950/40 hover:bg-purple-100/80 dark:hover:bg-purple-900/50 hover:border-purple-300 dark:hover:border-purple-500/50 transition-all text-xs shadow-xs group cursor-pointer"
              title="Co-Op Team Collaboration Status (Online / Offline Presence)"
            >
              {/* Sleek Avatar Stack with clean cutouts & zero clipping artifacts */}
              <div className="flex items-center -space-x-2">
                {resolvedMembers.map((m, idx) => (
                  <div
                    key={m.id}
                    style={{ zIndex: 10 - idx }}
                    className="relative shrink-0"
                    title={`${m.name} (${m.role.toUpperCase()}) - ${m.isOnline ? 'Online' : 'Offline'}`}
                  >
                    <div
                      className={`h-6 w-6 rounded-full ${m.avatarColor} border-2 border-white dark:border-zinc-950 flex items-center justify-center text-[10px] font-bold text-white shadow-xs transition-transform group-hover:scale-105 ${
                        m.isOnline ? 'opacity-100' : 'opacity-65'
                      }`}
                    >
                      {m.initials}
                    </div>
                    {m.isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-1.5 ring-white dark:ring-zinc-950 shadow-xs" />
                    )}
                  </div>
                ))}
              </div>

              <span className="text-[11px] font-mono font-medium text-purple-700 dark:text-purple-300 hidden sm:inline">
                Co-Op ({onlineCount} Online)
              </span>

              <span
                className={`h-2 w-2 rounded-full transition-colors ${
                  onlineCount > 0 ? 'bg-emerald-500 animate-pulse ring-2 ring-emerald-500/30' : 'bg-zinc-400'
                }`}
              />
            </button>

            {/* Co-Op Collaboration Dropdown */}
            {coopMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setCoopMenuOpen(false)}
                />
                <div className="absolute left-1/2 -translate-x-1/2 top-9 z-50 w-80 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 shadow-2xl text-xs space-y-3 animate-in fade-in-50 zoom-in-95 ring-1 ring-black/5 dark:ring-white/10">
                  <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <Radio className="h-3.5 w-3.5 text-purple-500 animate-pulse" />
                      <span>MorphFS Co-Op Live Session</span>
                    </div>
                    <span className="font-mono text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                      {onlineCount} ACTIVE
                    </span>
                  </div>

                  {/* Members List with Online/Offline Status and Roles */}
                  <div className="space-y-2">
                    {resolvedMembers.map((m) => (
                      <div
                        key={m.id}
                        className={`p-2 rounded-lg border transition-all ${
                          m.isOnline
                            ? 'bg-zinc-50/80 dark:bg-zinc-950/60 border-purple-200 dark:border-purple-900/40'
                            : 'bg-zinc-100/50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 opacity-75'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <div
                                className={`h-7 w-7 rounded-full ${m.avatarColor} flex items-center justify-center text-[10px] font-bold text-white shadow-sm`}
                              >
                                {m.initials}
                              </div>
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-zinc-900 ${
                                  m.isOnline ? 'bg-emerald-500' : 'bg-zinc-400'
                                }`}
                              />
                            </div>

                            <div>
                              <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                <span>{m.name}</span>
                                {m.role === 'owner' ? (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 uppercase">
                                    OWNER
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 uppercase">
                                    VIEWER
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                                {m.email}
                              </div>
                            </div>
                          </div>

                          {/* Online / Offline status badge */}
                          <div className="shrink-0 text-right">
                            {m.isOnline ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                ONLINE
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                                OFFLINE
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-[10px] text-zinc-600 dark:text-zinc-400 mt-1.5 pl-9 leading-tight">
                          {m.duty}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Presence Simulator Controls for Testing */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500">Co-Op Presence:</span>
                    <button
                      type="button"
                      onClick={() => setFriendSimulatedOnline(!friendSimulatedOnline)}
                      className="px-2 py-0.5 rounded text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                    >
                      {friendSimulatedOnline ? 'Toggle Wacim to Offline' : 'Toggle Wacim to Online'}
                    </button>
                  </div>

                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2 flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                    <span>Role Policy: 2 Owners, 1 Viewer</span>
                    <Link
                      href={currentProject ? `/projects/${currentProject.id}/members` : '#'}
                      onClick={() => setCoopMenuOpen(false)}
                      className="text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                    >
                      Full Roster →
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Working Search Bar & Command Palette Trigger */}
          <div className="flex-1 hidden md:block">
            <button
              type="button"
              onClick={handleOpenSearch}
              className="w-full flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-500 shadow-sm transition-all hover:border-purple-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:border-purple-800/60 dark:hover:bg-zinc-900 cursor-pointer group"
              title="Search test cases, issues, suites, or press Ctrl+K"
            >
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-zinc-400 group-hover:text-purple-500 transition-colors" />
                <span className="group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">
                  Search MorphFS tests, suites, issues...
                </span>
              </div>
              <kbd className="pointer-events-none rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-500 shadow-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* Mobile Search Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenSearch}
            className="md:hidden text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            title="Search"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* Right: Actions, Theme, Notifications, User */}
        <div className="flex items-center gap-2">
          {currentProject && (
            <>
              <Link href={`/projects/${currentProject.id}/tests/new`}>
                <Button size="sm" variant="outline" className="hidden sm:inline-flex border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New Case
                </Button>
              </Link>

              {onOpenQuickExecute && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={onOpenQuickExecute}
                  className="hidden sm:inline-flex bg-purple-600 hover:bg-purple-500 text-white"
                >
                  <Play className="mr-1.5 h-3 w-3 fill-current" />
                  Execute Test
                </Button>
              )}
            </>
          )}

          {/* Dark Mode Toggle */}
          <Button
            variant="ghost"
            size="iconSm"
            onClick={toggleDarkMode}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* Notifications */}
          <Link href="/notifications">
            <Button
              variant="ghost"
              size="iconSm"
              title="Notifications"
              className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 relative"
            >
              <Bell className="h-4 w-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
              )}
            </Button>
          </Link>

          {/* User Dropdown */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 font-mono text-xs font-semibold text-zinc-700 hover:ring-2 hover:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-200 transition-all cursor-pointer"
              title={user?.email || 'User Account'}
            >
              {user?.full_name
                ? user.full_name.charAt(0).toUpperCase()
                : user?.email
                ? user.email.charAt(0).toUpperCase()
                : 'U'}
            </button>

            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute right-0 top-9 z-50 w-56 rounded-md border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in-50 zoom-in-95">
                  <div className="px-2 py-1.5 border-b border-zinc-100 dark:border-zinc-800">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {user?.full_name || 'Engineer'}
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                      {user?.email || 'authenticated'}
                    </p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <User className="h-3.5 w-3.5" />
                      User Profile
                    </Link>
                  </div>
                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-1">
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Global Interactive Command Palette Dialog */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        project={currentProject}
      />
    </>
  );
}
