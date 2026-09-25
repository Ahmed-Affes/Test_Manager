'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  Search,
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  PlaySquare,
  Bug,
  Camera,
  FileText,
  DownloadCloud,
  FileCode,
  Users,
  Settings,
  History,
  Play,
  Plus,
} from 'lucide-react';
import { Project, TestCase } from '@/lib/types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project;
  recentTestCases?: TestCase[];
}

export function CommandPalette({
  isOpen,
  onClose,
  project,
  recentTestCases = [],
}: CommandPaletteProps) {
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // toggle or open
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const navigate = (path: string) => {
    router.push(path);
    onClose();
  };

  const pId = project?.id || '';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Command Window */}
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
        <Command className="flex flex-col h-full w-full">
          <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 text-zinc-400" />
            <Command.Input
              autoFocus
              placeholder="Type a command, test key (e.g. TC-001), or search..."
              className="w-full bg-transparent text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
            />
            <kbd className="pointer-events-none rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2 text-xs">
            <Command.Empty className="py-6 text-center text-xs text-zinc-500">
              No matching results found.
            </Command.Empty>

            {project && (
              <>
                <Command.Group
                  heading={
                    <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Quick Actions
                    </span>
                  }
                >
                  <Command.Item
                    onSelect={() => navigate(`/projects/${pId}/tests/new`)}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <Plus className="h-3.5 w-3.5 text-blue-500" />
                    <span>Create New Test Case</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => navigate(`/projects/${pId}/issues/new`)}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <Bug className="h-3.5 w-3.5 text-rose-500" />
                    <span>Report New Issue</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => navigate(`/projects/${pId}/import`)}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <FileCode className="h-3.5 w-3.5 text-purple-500" />
                    <span>Import JUnit XML Test Results</span>
                  </Command.Item>
                </Command.Group>

                <Command.Group
                  heading={
                    <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Project Navigation
                    </span>
                  }
                >
                  <Command.Item
                    onSelect={() => navigate(`/projects/${pId}`)}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Overview Dashboard</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => navigate(`/projects/${pId}/suites`)}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <FolderKanban className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Test Suites</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => navigate(`/projects/${pId}/tests`)}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <CheckSquare className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Test Cases Repository</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => navigate(`/projects/${pId}/runs`)}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <PlaySquare className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Execution History (Runs)</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => navigate(`/projects/${pId}/issues`)}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <Bug className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Issues & Retest Queue</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => navigate(`/projects/${pId}/reports`)}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <FileText className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Verification Reports</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => navigate(`/projects/${pId}/backup`)}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <DownloadCloud className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Project Backup & Restore (.testmanager)</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => navigate(`/projects/${pId}/activity`)}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <History className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Audit Trail Log</span>
                  </Command.Item>
                </Command.Group>
              </>
            )}

            {recentTestCases.length > 0 && (
              <Command.Group
                heading={
                  <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    Recent Test Cases
                  </span>
                }
              >
                {recentTestCases.map((tc) => (
                  <Command.Item
                    key={tc.id}
                    onSelect={() => navigate(`/projects/${pId}/tests/${tc.id}`)}
                    className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono text-[10px] font-bold text-blue-500">
                        {tc.key}
                      </span>
                      <span className="truncate">{tc.title}</span>
                    </div>
                    <span className="font-mono text-[10px] text-zinc-400 uppercase">
                      {tc.priority}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
