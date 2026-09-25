'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  PlaySquare,
  Bug,
  FileText,
  Users,
  Bot,
  History,
  DownloadCloud,
  Settings,
  ChevronDown,
  Plus,
  ChevronsLeft,
  ChevronsRight,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Project, ProjectRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

interface NavItem {
  title: string;
  href: string;
  icon: any;
  exact?: boolean;
  badge?: string | number;
  badgeColor?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface SidebarProps {
  currentProject?: Project;
  projects?: Project[];
  userRole?: ProjectRole;
}

export function Sidebar({ currentProject, projects = [], userRole = 'tester' }: SidebarProps) {
  const pathname = usePathname();
  const supabase = createClient();
  const [collapsed, setCollapsed] = React.useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = React.useState(false);
  const [openIssuesCount, setOpenIssuesCount] = React.useState<number | null>(null);

  const projectId = currentProject?.id || 'demo-project';

  // Fetch active issues count for live badge with multi-layer real-time sync
  React.useEffect(() => {
    if (!currentProject?.id) return;
    let isMounted = true;

    const fetchIssueCount = async () => {
      try {
        const { count, error } = await supabase
          .from('issues')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', currentProject.id)
          .in('status', ['open', 'investigating', 'in_progress', 'retesting']);

        if (!error && isMounted) {
          setOpenIssuesCount(count ?? 0);
        }
      } catch (err) {
        // silent fail
      }
    };

    fetchIssueCount();

    // 1. Polling interval to guarantee live sync across retests and runs
    const interval = setInterval(fetchIssueCount, 3000);

    // 2. Window focus & custom event trigger
    const onFocus = () => fetchIssueCount();
    const onCustomUpdate = () => fetchIssueCount();
    window.addEventListener('focus', onFocus);
    window.addEventListener('issues-updated', onCustomUpdate);

    // 3. Supabase Realtime Channel
    const channel = supabase
      .channel(`sidebar-issues:${currentProject.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'issues', filter: `project_id=eq.${currentProject.id}` },
        () => {
          fetchIssueCount();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('issues-updated', onCustomUpdate);
      supabase.removeChannel(channel);
    };
  }, [currentProject?.id, pathname, supabase]);

  const navSections: NavSection[] = [
    {
      label: 'Testing & Quality',
      items: [
        {
          title: 'Overview',
          href: `/projects/${projectId}`,
          icon: LayoutDashboard,
          exact: true,
        },
        {
          title: 'Test Suites',
          href: `/projects/${projectId}/suites`,
          icon: FolderKanban,
        },
        {
          title: 'Test Cases',
          href: `/projects/${projectId}/tests`,
          icon: CheckSquare,
        },
      ],
    },
    {
      label: 'Defects & Sign-Off',
      items: [
        {
          title: 'Bugs & Retests',
          href: `/projects/${projectId}/issues`,
          icon: Bug,
          badge: openIssuesCount !== null && openIssuesCount > 0 ? openIssuesCount : undefined,
          badgeColor: 'bg-rose-500 text-white',
        },
        {
          title: 'Quality Reports',
          href: `/projects/${projectId}/reports`,
          icon: FileText,
          badge: 'PFE',
          badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
        },
      ],
    },
    {
      label: 'Collaboration & AI',
      items: [
        {
          title: 'Co-Op Team Roster',
          href: `/projects/${projectId}/members`,
          icon: Users,
          badge: 'Live',
          badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
        },
        {
          title: 'AI Agent Sync',
          href: `/projects/${projectId}/import`,
          icon: Bot,
          badge: 'CI/CD',
          badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
        },
      ],
    },
    {
      label: 'Workspace & Ops',
      items: [
        {
          title: 'Audit Trail',
          href: `/projects/${projectId}/activity`,
          icon: History,
        },
        {
          title: 'Project Backup',
          href: `/projects/${projectId}/backup`,
          icon: DownloadCloud,
        },
        {
          title: 'Project Settings',
          href: `/projects/${projectId}/settings`,
          icon: Settings,
        },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        'relative flex flex-col border-r border-zinc-200/90 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-950 backdrop-blur-md transition-all duration-200 select-none z-30 shrink-0 shadow-sm',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Top Project Selector Header */}
      <div className="h-14 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between px-3">
        {!collapsed ? (
          <div className="relative w-full">
            <button
              onClick={() => setProjectMenuOpen(!projectMenuOpen)}
              className="flex w-full items-center justify-between gap-2 rounded-lg p-1.5 text-left hover:bg-zinc-200/60 dark:hover:bg-zinc-900 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold text-white shadow-sm ring-1 ring-black/10 dark:ring-white/20 transition-transform group-hover:scale-105"
                  style={{ backgroundColor: currentProject?.accent_color || '#8b5cf6' }}
                >
                  {currentProject?.key ? currentProject.key.charAt(0) : 'M'}
                </div>
                <div className="min-w-0 truncate">
                  <div className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>{currentProject?.name || 'MorphFS'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                    <span className="text-purple-600 dark:text-purple-400 font-bold">{currentProject?.key || 'PROJECT'}</span>
                    <span>•</span>
                    <span className="uppercase text-[9px] px-1 py-0.2 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold">
                      {userRole}
                    </span>
                  </div>
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-colors" />
            </button>

            {/* Project Switcher Dropdown */}
            {projectMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProjectMenuOpen(false)}
                />
                <div className="absolute left-0 top-12 z-50 w-64 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in-50 zoom-in-95 ring-1 ring-black/5 dark:ring-white/10 text-xs">
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                    <span>Available Projects</span>
                    <span className="font-mono text-[9px]">{projects.length}</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-0.5 py-1">
                    {projects.map((p) => {
                      const isCurrent = p.id === currentProject?.id;
                      return (
                        <Link
                          key={p.id}
                          href={`/projects/${p.id}`}
                          onClick={() => setProjectMenuOpen(false)}
                          className={cn(
                            'flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors',
                            isCurrent
                              ? 'bg-purple-50 font-semibold text-purple-900 dark:bg-purple-950/40 dark:text-purple-200'
                              : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/60'
                          )}
                        >
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: p.accent_color || '#8b5cf6' }}
                          />
                          <span className="truncate">{p.name}</span>
                          <span className="ml-auto font-mono text-[10px] text-zinc-400">
                            {p.key}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                  <div className="mt-1 border-t border-zinc-100 pt-1 dark:border-zinc-800">
                    <Link
                      href="/projects/new"
                      onClick={() => setProjectMenuOpen(false)}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950/30 font-medium transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create New Project
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div
            className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-bold text-white shadow-sm ring-1 ring-black/10 dark:ring-white/20 cursor-pointer"
            style={{ backgroundColor: currentProject?.accent_color || '#8b5cf6' }}
            title={`${currentProject?.name} (${currentProject?.key})`}
            onClick={() => setCollapsed(false)}
          >
            {currentProject?.key ? currentProject.key.charAt(0) : 'M'}
          </div>
        )}
      </div>

      {/* Grouped Navigation List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 scrollbar-thin">
        {navSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {!collapsed && (
              <div className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-mono">
                {section.label}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.title : undefined}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-all duration-150',
                      isActive
                        ? 'bg-purple-50 text-purple-950 dark:bg-purple-950/40 dark:text-purple-100 font-semibold shadow-xs'
                        : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
                    )}
                  >
                    {/* Active Left Indicator Bar */}
                    {isActive && (
                      <span className="absolute left-0 top-1 bottom-1 w-1 bg-purple-600 rounded-r" />
                    )}

                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        isActive
                          ? 'text-purple-600 dark:text-purple-400'
                          : 'text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300'
                      )}
                    />

                    {!collapsed && (
                      <span className="truncate flex-1">{item.title}</span>
                    )}

                    {/* Badge */}
                    {!collapsed && item.badge && (
                      <span
                        className={cn(
                          'ml-auto px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold shrink-0',
                          item.badgeColor || 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}

                    {/* Collapsed dot indicator */}
                    {collapsed && item.badge && (
                      <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-950" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Footer & Collapse Toggle */}
      <div className="border-t border-zinc-200/80 dark:border-zinc-800 p-2 flex items-center justify-between text-xs bg-zinc-50/50 dark:bg-zinc-950/50">
        {!collapsed && (
          <div className="flex items-center gap-1.5 px-2 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="truncate">MorphFS Live</span>
          </div>
        )}

        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors',
            collapsed && 'mx-auto'
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <ChevronsLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}
