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
  Camera,
  Server,
  CalendarRange,
  FileText,
  DownloadCloud,
  FileCode,
  Users,
  History,
  Settings,
  ChevronDown,
  Plus,
  ChevronsLeft,
  ChevronsRight,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Project, ProjectRole } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  currentProject?: Project;
  projects?: Project[];
  userRole?: ProjectRole;
}

export function Sidebar({ currentProject, projects = [], userRole = 'tester' }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = React.useState(false);

  const projectId = currentProject?.id || 'demo-project';

  const navItems = [
    {
      title: 'Architecture & Overview',
      href: `/projects/${projectId}`,
      icon: LayoutDashboard,
      exact: true,
    },
    {
      title: 'Verification Suites',
      href: `/projects/${projectId}/suites`,
      icon: FolderKanban,
    },
    {
      title: 'Filesystem Test Cases',
      href: `/projects/${projectId}/tests`,
      icon: CheckSquare,
    },
    {
      title: 'Execution History',
      href: `/projects/${projectId}/runs`,
      icon: PlaySquare,
    },
    {
      title: 'Crash & Defect Issues',
      href: `/projects/${projectId}/issues`,
      icon: Bug,
    },
    {
      title: 'Evidence Vault (fsck/Dumps)',
      href: `/projects/${projectId}/evidence`,
      icon: Camera,
    },
    {
      title: 'Target Environments',
      href: `/projects/${projectId}/environments`,
      icon: Server,
    },
    {
      title: 'PFE Milestones',
      href: `/projects/${projectId}/plans`,
      icon: CalendarRange,
    },
    {
      title: 'Release Gates & Sign-Off',
      href: `/projects/${projectId}/reports`,
      icon: FileText,
    },
    {
      title: 'Snapshots & Backup',
      href: `/projects/${projectId}/backup`,
      icon: DownloadCloud,
    },
    {
      title: 'AI Agent & CI Import',
      href: `/projects/${projectId}/import`,
      icon: FileCode,
    },
    {
      title: 'Co-Op Team & Roles',
      href: `/projects/${projectId}/members`,
      icon: Users,
    },
    {
      title: 'Invariant Audit Trail',
      href: `/projects/${projectId}/activity`,
      icon: History,
    },
    {
      title: 'Engine Settings',
      href: `/projects/${projectId}/settings`,
      icon: Settings,
    },
  ];

  return (
    <aside
      className={cn(
        'relative flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950 transition-all duration-200 select-none z-30 shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Top Project Selector Header */}
      <div className="h-14 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between px-3">
        {!collapsed ? (
          <div className="relative w-full">
            <button
              onClick={() => setProjectMenuOpen(!projectMenuOpen)}
              className="flex w-full items-center justify-between gap-2 rounded-md p-1.5 text-left hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded font-mono text-xs font-bold text-white shadow-sm bg-purple-600"
                >
                  M
                </div>
                <div className="min-w-0 truncate">
                  <div className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                    <span>{currentProject?.name || 'MorphFS'}</span>
                  </div>
                  <div className="truncate font-mono text-[10px] text-purple-400">
                    Windows Edition • PFE
                  </div>
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            </button>

            {/* Project Switcher Dropdown */}
            {projectMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProjectMenuOpen(false)}
                />
                <div className="absolute left-0 top-12 z-50 w-64 rounded-md border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in-50 zoom-in-95">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Your Projects
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-0.5">
                    {projects.map((p) => (
                      <Link
                        key={p.id}
                        href={`/projects/${p.id}`}
                        onClick={() => setProjectMenuOpen(false)}
                        className={cn(
                          'flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors',
                          p.id === currentProject?.id
                            ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                            : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50'
                        )}
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: p.accent_color }}
                        />
                        <span className="truncate">{p.name}</span>
                        <span className="ml-auto font-mono text-[10px] text-zinc-400">
                          {p.key}
                        </span>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-1 border-t border-zinc-100 pt-1 dark:border-zinc-800">
                    <Link
                      href="/projects/new"
                      onClick={() => setProjectMenuOpen(false)}
                      className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
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
            className="mx-auto flex h-7 w-7 items-center justify-center rounded font-mono text-xs font-bold text-white shadow-sm"
            style={{ backgroundColor: currentProject?.accent_color || '#2563eb' }}
            title={currentProject?.name}
          >
            {currentProject?.key ? currentProject.key.slice(0, 3) : 'TM'}
          </div>
        )}
      </div>

      {/* Navigation Items List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
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
                'group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors',
                isActive
                  ? 'bg-zinc-200/70 font-semibold text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50'
                  : 'text-zinc-600 hover:bg-zinc-200/40 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  isActive
                    ? 'text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300'
                )}
              />
              {!collapsed && <span className="truncate">{item.title}</span>}
            </Link>
          );
        })}
      </div>

      {/* Bottom Controls / Collapse */}
      <div className="border-t border-zinc-200/80 dark:border-zinc-800 p-2 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-1.5 px-1.5 text-[11px] text-zinc-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-500" />
            <span>MorphFS v2.4 (Win11)</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronsRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronsLeft className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </aside>
  );
}
