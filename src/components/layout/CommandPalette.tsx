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
  FileText,
  DownloadCloud,
  FileCode,
  Users,
  Settings,
  Plus,
  Play,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Project, TestCase } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project;
}

export function CommandPalette({
  isOpen,
  onClose,
  project,
}: CommandPaletteProps) {
  const router = useRouter();
  const supabase = createClient();

  const [testCases, setTestCases] = React.useState<any[]>([]);
  const [issues, setIssues] = React.useState<any[]>([]);
  const [suites, setSuites] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Fetch searchable items when opened
  React.useEffect(() => {
    if (!isOpen || !project?.id) return;

    let isMounted = true;
    setLoading(true);

    const fetchData = async () => {
      try {
        const [casesRes, issuesRes, suitesRes] = await Promise.all([
          supabase
            .from('test_cases')
            .select('id, key, title, type, severity')
            .eq('project_id', project.id)
            .order('created_at', { ascending: false })
            .limit(30),
          supabase
            .from('issues')
            .select('id, key, title, severity, status')
            .eq('project_id', project.id)
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('test_suites')
            .select('id, name')
            .eq('project_id', project.id)
            .order('name')
            .limit(20),
        ]);

        if (isMounted) {
          if (casesRes.data) setTestCases(casesRes.data);
          if (issuesRes.data) setIssues(issuesRes.data);
          if (suitesRes.data) setSuites(suitesRes.data);
        }
      } catch (err) {
        console.error('Failed to load command palette data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, project?.id, supabase]);

  // Handle ESC key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const navigate = (path: string) => {
    router.push(path);
    onClose();
  };

  const pId = project?.id || '';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 animate-in fade-in duration-150">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Command Dialog Window */}
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl text-zinc-900 dark:text-zinc-100 ring-1 ring-black/5 dark:ring-white/10">
        <Command className="flex flex-col h-full w-full">
          <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 px-3 py-2.5 bg-zinc-50/50 dark:bg-zinc-950/40">
            <Search className="mr-2.5 h-4 w-4 shrink-0 text-purple-500" />
            <Command.Input
              autoFocus
              placeholder="Search MorphFS test cases, issues, suites, or pages (e.g. search, logo, BUG-001)..."
              className="w-full bg-transparent text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
            />
            <button
              onClick={onClose}
              type="button"
              className="px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800"
            >
              ESC
            </button>
          </div>

          <Command.List className="max-h-96 overflow-y-auto p-2 text-xs divide-y divide-zinc-100 dark:divide-zinc-800/40">
            <Command.Empty className="py-8 text-center text-xs text-zinc-500">
              <p>No matching tests, issues, or navigation items found.</p>
              <span className="text-[11px] text-zinc-400 mt-1 block">Try searching by key like &quot;MORPH-SRCH&quot; or keyword like &quot;search&quot;</span>
            </Command.Empty>

            {/* Test Cases Group */}
            {testCases.length > 0 && (
              <Command.Group
                heading={
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center justify-between">
                    <span>Test Cases ({testCases.length})</span>
                    <span className="text-[9px] font-normal text-zinc-400 font-mono">Enter to view</span>
                  </div>
                }
              >
                {testCases.map((tc) => (
                  <Command.Item
                    key={tc.id}
                    value={`${tc.key} ${tc.title} ${tc.type} ${tc.severity} test case`}
                    onSelect={() => navigate(`/projects/${pId}/tests/${tc.id}`)}
                    className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 my-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 data-[selected=true]:bg-blue-500/10 data-[selected=true]:text-blue-600 dark:data-[selected=true]:text-blue-400 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <CheckSquare className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 shrink-0">
                        {tc.key}
                      </span>
                      <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                        {tc.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2 font-mono text-[10px]">
                      <span className="px-1.5 py-0.2 rounded uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {tc.type}
                      </span>
                      <span className="capitalize text-zinc-500">
                        {tc.severity}
                      </span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Defects & Issues Group */}
            {issues.length > 0 && (
              <Command.Group
                heading={
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center justify-between">
                    <span>Defects & Issues ({issues.length})</span>
                    <span className="text-[9px] font-normal text-zinc-400 font-mono">Enter to view</span>
                  </div>
                }
              >
                {issues.map((iss) => (
                  <Command.Item
                    key={iss.id}
                    value={`${iss.key} ${iss.title} ${iss.severity} ${iss.status} defect issue bug`}
                    onSelect={() => navigate(`/projects/${pId}/issues`)}
                    className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 my-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 data-[selected=true]:bg-rose-500/10 data-[selected=true]:text-rose-600 dark:data-[selected=true]:text-rose-400 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Bug className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                      <span className="font-mono text-[11px] font-bold text-rose-600 dark:text-rose-400 shrink-0">
                        {iss.key}
                      </span>
                      <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                        {iss.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2 font-mono text-[10px]">
                      <span className="px-1.5 py-0.2 rounded uppercase bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                        {iss.status}
                      </span>
                      <span className="capitalize text-zinc-500">
                        {iss.severity}
                      </span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Test Suites Group */}
            {suites.length > 0 && (
              <Command.Group
                heading={
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    <span>Test Suites ({suites.length})</span>
                  </div>
                }
              >
                {suites.map((st) => (
                  <Command.Item
                    key={st.id}
                    value={`${st.name} suite`}
                    onSelect={() => navigate(`/projects/${pId}/suites`)}
                    className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 my-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 data-[selected=true]:bg-purple-500/10 data-[selected=true]:text-purple-600 dark:data-[selected=true]:text-purple-400 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <FolderKanban className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {st.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">Suite →</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Quick Actions Group */}
            <Command.Group
              heading={
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  <span>Quick Actions</span>
                </div>
              }
            >
              <Command.Item
                value="create new test case add"
                onSelect={() => navigate(`/projects/${pId}/tests/new`)}
                className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 my-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 data-[selected=true]:bg-blue-500/10 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Plus className="h-3.5 w-3.5 text-blue-500" />
                  <span>Create New Test Case</span>
                </div>
                <kbd className="text-[10px] font-mono text-zinc-400">N</kbd>
              </Command.Item>

              <Command.Item
                value="report new issue bug defect"
                onSelect={() => navigate(`/projects/${pId}/issues/new`)}
                className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 my-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 data-[selected=true]:bg-rose-500/10 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Bug className="h-3.5 w-3.5 text-rose-500" />
                  <span>Report New Issue</span>
                </div>
                <kbd className="text-[10px] font-mono text-zinc-400">B</kbd>
              </Command.Item>

              <Command.Item
                value="import junit xml test results automated"
                onSelect={() => navigate(`/projects/${pId}/import`)}
                className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 my-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 data-[selected=true]:bg-purple-500/10 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <FileCode className="h-3.5 w-3.5 text-purple-500" />
                  <span>Import JUnit XML Test Results</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">CI/CD</span>
              </Command.Item>

              <Command.Item
                value="generate quality report sign-off jury"
                onSelect={() => navigate(`/projects/${pId}/reports`)}
                className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 my-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 data-[selected=true]:bg-emerald-500/10 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Generate PFE Verification Report</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-500">Sign-Off</span>
              </Command.Item>

              <Command.Item
                value="manage team coop members owners viewers roles"
                onSelect={() => navigate(`/projects/${pId}/members`)}
                className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 my-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 data-[selected=true]:bg-purple-500/10 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="h-3.5 w-3.5 text-purple-500" />
                  <span>Co-Op Team & Roles Roster (Owners & Jury)</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">Team</span>
              </Command.Item>
            </Command.Group>

            {/* Navigation Group */}
            <Command.Group
              heading={
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  <span>Navigation</span>
                </div>
              }
            >
              <Command.Item
                value="overview dashboard project home"
                onSelect={() => navigate(`/projects/${pId}`)}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 my-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-zinc-400" />
                <span>Overview Dashboard</span>
              </Command.Item>

              <Command.Item
                value="test cases repository tests list"
                onSelect={() => navigate(`/projects/${pId}/tests`)}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 my-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <CheckSquare className="h-3.5 w-3.5 text-zinc-400" />
                <span>Test Cases Repository</span>
              </Command.Item>


              <Command.Item
                value="issues defects retest queue"
                onSelect={() => navigate(`/projects/${pId}/issues`)}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 my-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Bug className="h-3.5 w-3.5 text-zinc-400" />
                <span>Issues & Defects Queue</span>
              </Command.Item>


              <Command.Item
                value="backup restore testmanager archive"
                onSelect={() => navigate(`/projects/${pId}/backup`)}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 my-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <DownloadCloud className="h-3.5 w-3.5 text-zinc-400" />
                <span>Backup & Archive (.testmanager)</span>
              </Command.Item>
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 px-3 py-2 text-[10px] text-zinc-400 bg-zinc-50/50 dark:bg-zinc-950/40">
            <span>Navigation: <kbd className="px-1 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">↑</kbd> <kbd className="px-1 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">↓</kbd> to select</span>
            <span>Open: <kbd className="px-1 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">↵</kbd></span>
          </div>
        </Command>
      </div>
    </div>
  );
}
