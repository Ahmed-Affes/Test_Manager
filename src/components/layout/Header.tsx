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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Project, UserProfile } from '@/lib/types';

interface HeaderProps {
  currentProject?: Project;
  user?: UserProfile | null;
  onOpenCommandPalette?: () => void;
  onOpenQuickExecute?: () => void;
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
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    // Check initial dark mode
    if (document.documentElement.classList.contains('dark')) {
      setIsDark(true);
    }
  }, []);

  const toggleDarkMode = () => {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const [coopMenuOpen, setCoopMenuOpen] = React.useState(false);

  return (
    <header className="h-14 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md px-4 flex items-center justify-between gap-4 z-20 shrink-0">
      {/* Left: MorphFS Brand & Project Identifier */}
      <div className="flex items-center gap-3 text-xs">
        <Link
          href={currentProject ? `/projects/${currentProject.id}` : '/projects'}
          className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100 hover:text-purple-400 transition-colors"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600/10 border border-purple-500/30 text-purple-400">
            <span className="font-mono text-xs font-bold">M</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight">MorphFS</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
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
            className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-purple-500/20 bg-purple-950/20 hover:bg-purple-900/30 transition-all text-xs"
            title="Co-Op Team Collaboration Status"
          >
            <div className="flex -space-x-1.5">
              <div
                className="h-5 w-5 rounded-full bg-purple-600 border border-zinc-900 flex items-center justify-center text-[9px] font-bold text-white shadow-sm ring-1 ring-emerald-500"
                title="Ahmed Affes (Lead Architect) - Online"
              >
                AA
              </div>
              <div
                className="h-5 w-5 rounded-full bg-blue-600 border border-zinc-900 flex items-center justify-center text-[9px] font-bold text-white shadow-sm ring-1 ring-emerald-500"
                title="Co-Author (Systems Engineer) - Online"
              >
                CO
              </div>
              <div
                className="h-5 w-5 rounded-full bg-emerald-600 border border-zinc-900 flex items-center justify-center text-[9px] font-bold text-white shadow-sm ring-1 ring-purple-400"
                title="Prof. Academic Advisor (Jury) - Reviewing"
              >
                PR
              </div>
            </div>
            <span className="text-[11px] font-mono font-medium text-purple-300 hidden sm:inline">
              Co-Op Active (3)
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </button>

          {/* Co-Op Collaboration Dropdown */}
          {coopMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setCoopMenuOpen(false)}
              />
              <div className="absolute left-1/2 -translate-x-1/2 top-9 z-50 w-72 rounded-xl border border-zinc-800 bg-zinc-900 p-3 shadow-2xl text-xs space-y-3 animate-in fade-in-50 zoom-in-95">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>MorphFS Co-Op Session</span>
                  </div>
                  <span className="font-mono text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
                    LIVE SYNC
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-1.5 rounded bg-zinc-950/60 border border-zinc-800/80">
                    <div className="h-6 w-6 rounded-full bg-purple-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                      AA
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-200">Ahmed Affes</div>
                      <div className="text-[10px] text-purple-400 font-mono">
                        Lead Systems Architect & Core Author
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        Authoring Crash Consistency & Invariant Suites
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-1.5 rounded bg-zinc-950/60 border border-zinc-800/80">
                    <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                      CO
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-200">Engineering Co-Author</div>
                      <div className="text-[10px] text-blue-400 font-mono">
                        MFP Sync & Windows Shell Co-Engineer
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        Executing QEMU & Benchmark Test Cycles
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-1.5 rounded bg-zinc-950/60 border border-zinc-800/80">
                    <div className="h-6 w-6 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                      PR
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-200">Prof. Academic Advisor</div>
                      <div className="text-[10px] text-emerald-400 font-mono">
                        PFE Graduation Jury Evaluator
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        Reviewing Verification Dossier & Gate Sign-Offs
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-2 flex items-center justify-between text-[10px] text-zinc-400">
                  <span>Milestone 4: Capstone Defense</span>
                  <Link
                    href={currentProject ? `/projects/${currentProject.id}/members` : '#'}
                    onClick={() => setCoopMenuOpen(false)}
                    className="text-purple-400 hover:underline"
                  >
                    View Roster →
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Command Palette Trigger */}
        <div className="flex-1 hidden md:block">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="w-full flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-400 shadow-sm transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-zinc-400" />
              <span>Search MorphFS tests, suites, issues, or invariants...</span>
            </div>
            <kbd className="pointer-events-none rounded border border-zinc-200 bg-white px-1.5 font-mono text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              ⌘K
            </kbd>
          </button>
        </div>
      </div>

      {/* Right: Actions, Theme, Notifications, User */}
      <div className="flex items-center gap-2">
        {currentProject && (
          <>
            <Link href={`/projects/${currentProject.id}/tests/new`}>
              <Button size="sm" variant="outline" className="hidden sm:inline-flex border-zinc-800">
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
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
          </Button>
        </Link>

        {/* User Dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 font-mono text-xs font-semibold text-zinc-700 hover:ring-2 hover:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-200 transition-all"
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
  );
}
