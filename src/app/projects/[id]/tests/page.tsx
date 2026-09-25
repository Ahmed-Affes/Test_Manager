'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Play,
  ArrowRight,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { TestCase, TestSuite, Environment, StepStatus, TestRunStatus } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { TestCaseModal } from '@/components/cases/TestCaseModal';
import { TestRunnerModal } from '@/components/execution/TestRunnerModal';
import { formatDate } from '@/lib/utils';
import { logAuditEvent } from '@/lib/audit';

export default function TestCasesPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const supabase = createClient();

  const [testCases, setTestCases] = React.useState<any[]>([]);
  const [suites, setSuites] = React.useState<TestSuite[]>([]);
  const [environments, setEnvironments] = React.useState<Environment[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedSuite, setSelectedSuite] = React.useState<string>('all');
  const [selectedType, setSelectedType] = React.useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = React.useState<string>('all');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [activeRunningCase, setActiveRunningCase] = React.useState<TestCase | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
      let pId = projectId;
      if (!isUuid) {
        const { data: p } = await supabase.from('projects').select('id').ilike('key', projectId).single();
        if (p) pId = p.id;
      }

      // 1. Fetch test cases with their steps, suite, and latest run
      const { data: casesData, error: casesErr } = await supabase
        .from('test_cases')
        .select(`
          *,
          suite:test_suites(id, name),
          steps:test_steps(*),
          test_runs:test_runs(id, run_number, status, duration_ms, created_at)
        `)
        .eq('project_id', pId)
        .order('created_at', { ascending: false });

      if (casesErr) console.error('Fetch cases error:', casesErr);

      // 2. Fetch suites
      const { data: suitesData } = await supabase
        .from('test_suites')
        .select('*')
        .eq('project_id', pId)
        .order('name');

      // 3. Fetch environments
      const { data: envsData } = await supabase
        .from('environments')
        .select('*')
        .eq('project_id', pId)
        .order('name');

      setTestCases(casesData || []);
      setSuites(suitesData || []);
      setEnvironments(envsData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  React.useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId, fetchData]);

  // Handle saving new test case
  const handleSaveTestCase = async (caseData: any) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
    let resolvedProjectId = projectId;
    let projectKey = 'TEST';

    if (!isUuid) {
      const { data: proj } = await supabase
        .from('projects')
        .select('id, key')
        .ilike('key', projectId)
        .single();
      if (proj) {
        resolvedProjectId = proj.id;
        projectKey = proj.key;
      }
    } else {
      const { data: proj } = await supabase
        .from('projects')
        .select('key')
        .eq('id', projectId)
        .single();
      if (proj) projectKey = proj.key;
    }

    // Count existing test cases to assign next key
    const { count } = await supabase
      .from('test_cases')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', resolvedProjectId);

    const nextNumber = (count || 0) + 1;
    const testKey = `${projectKey}-${nextNumber}`;

    const overallExpected =
      caseData.expected_result ||
      caseData.steps?.[0]?.expected_result ||
      'All execution steps pass with zero defects';

    // 1. Insert test case
    const { data: newCase, error: caseErr } = await supabase
      .from('test_cases')
      .insert({
        project_id: resolvedProjectId,
        suite_id: caseData.suite_id || null,
        key: testKey,
        title: caseData.title,
        description: caseData.description || null,
        type: caseData.type,
        priority: caseData.priority,
        severity: caseData.severity,
        status: caseData.status,
        preconditions: caseData.preconditions || null,
        test_data: caseData.test_data || null,
        expected_result: overallExpected,
        created_by: user?.id,
      })
      .select()
      .single();

    if (caseErr) throw caseErr;

    // 2. Insert steps if any
    if (caseData.steps && caseData.steps.length > 0) {
      const stepsToInsert = caseData.steps.map((s: any, idx: number) => ({
        test_case_id: newCase.id,
        step_number: idx + 1,
        action: s.action,
        expected_result: s.expected_result || null,
      }));

      const { error: stepsErr } = await supabase
        .from('test_steps')
        .insert(stepsToInsert);

      if (stepsErr) console.error('Insert steps error:', stepsErr);
    }

    // 3. Log audit event
    await logAuditEvent({
      projectId,
      action: 'create_test_case',
      entityType: 'test_case',
      entityId: newCase.id,
      details: { key: testKey, title: caseData.title },
    });

    await fetchData();
  };

  // Handle saving execution run
  const handleSaveRun = async (runData: any) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 1. Count previous runs for this test case
    const { count } = await supabase
      .from('test_runs')
      .select('*', { count: 'exact', head: true })
      .eq('test_case_id', runData.test_case_id);

    const runNumber = (count || 0) + 1;

    // 2. Insert test run
    const { data: newRun, error: runErr } = await supabase
      .from('test_runs')
      .insert({
        project_id: projectId,
        test_case_id: runData.test_case_id,
        run_number: runNumber,
        status: runData.status,
        duration_ms: runData.duration_ms,
        environment_id: runData.environment_id || null,
        application_version: runData.application_version || null,
        build_number: runData.build_number || null,
        branch: runData.branch || null,
        commit_sha: runData.commit_sha || null,
        actual_result: runData.actual_result || null,
        notes: runData.notes || null,
        executed_by: user?.id,
      })
      .select()
      .single();

    if (runErr) throw runErr;

    // 3. Insert step results
    if (runData.step_results && runData.step_results.length > 0) {
      const stepResultsToInsert = runData.step_results.map((sr: any) => ({
        test_run_id: newRun.id,
        step_id: sr.step_id || null,
        step_number: sr.step_number,
        status: sr.status,
        actual_result: sr.actual_result || null,
        notes: sr.notes || null,
      }));

      await supabase.from('test_step_results').insert(stepResultsToInsert);
    }

    // 4. Log audit event
    await logAuditEvent({
      projectId,
      action: 'create_test_run',
      entityType: 'test_run',
      entityId: newRun.id,
      details: {
        test_case_id: runData.test_case_id,
        status: runData.status,
        run_number: runNumber,
      },
    });

    await fetchData();
  };

  // Filter test cases
  const filteredCases = testCases.filter((tc) => {
    const matchesSearch =
      tc.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tc.description && tc.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSuite = selectedSuite === 'all' || tc.suite_id === selectedSuite;
    const matchesType = selectedType === 'all' || tc.type === selectedType;
    const matchesSeverity = selectedSeverity === 'all' || tc.severity === selectedSeverity;

    return matchesSearch && matchesSuite && matchesType && matchesSeverity;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-blue-500" />
            Test Cases Repository
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Structured test definitions, preconditions, execution procedures, and historical runs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/projects/${projectId}/import`}>
            <Button variant="outline" size="sm" className="gap-1.5 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
              <Sparkles className="h-3.5 w-3.5 text-purple-500" />
              AI Agent & CI Sync
            </Button>
          </Link>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="gap-1.5 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Create Test Case
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cases by key, title, action..."
            className="pl-9 h-8 text-xs"
          />
        </div>

        <Select
          value={selectedSuite}
          onChange={(e) => setSelectedSuite(e.target.value)}
          className="w-36 h-8 text-xs"
        >
          <option value="all">All Suites</option>
          {suites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>

        <Select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="w-32 h-8 text-xs"
        >
          <option value="all">All Types</option>
          <option value="manual">Manual</option>
          <option value="automated">Automated</option>
          <option value="exploratory">Exploratory</option>
        </Select>

        <Select
          value={selectedSeverity}
          onChange={(e) => setSelectedSeverity(e.target.value)}
          className="w-32 h-8 text-xs"
        >
          <option value="all">All Severities</option>
          <option value="blocker">Blocker</option>
          <option value="critical">Critical</option>
          <option value="major">Major</option>
          <option value="minor">Minor</option>
          <option value="trivial">Trivial</option>
        </Select>

        <span className="text-xs text-zinc-500 font-mono ml-auto">
          {filteredCases.length} of {testCases.length} cases
        </span>
      </div>

      {/* Test Cases Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-zinc-100 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-xl border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/20 space-y-3">
          <CheckSquare className="h-10 w-10 text-zinc-400 dark:text-zinc-600 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-300">
            {testCases.length === 0 ? 'Clean Slate: Zero Test Cases' : 'No Test Cases Found'}
          </h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            {testCases.length === 0
              ? 'Ready for MorphFS development! As you build the filesystem components, add your manual verification procedures here or connect your AI Agent / CI to auto-create tests.'
              : 'No test cases match your search and filter criteria.'}
          </p>
          {testCases.length === 0 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Create Manual Test Case
              </Button>
              <Link href={`/projects/${projectId}/import`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                  Connect AI Agent / CI
                </Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
              <tr>
                <th className="p-3 w-28">Key</th>
                <th className="p-3">Title & Suite</th>
                <th className="p-3 w-24">Type</th>
                <th className="p-3 w-24">Severity</th>
                <th className="p-3 w-28">Latest Run</th>
                <th className="p-3 w-36 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
              {filteredCases.map((tc) => {
                const latestRun = tc.test_runs?.[0];
                return (
                  <tr
                    key={tc.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors group"
                  >
                    <td className="p-3">
                      <Link
                        href={`/projects/${projectId}/tests/${tc.id}`}
                        className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {tc.key}
                      </Link>
                    </td>

                    <td className="p-3">
                      <div className="space-y-0.5">
                        <Link
                          href={`/projects/${projectId}/tests/${tc.id}`}
                          className="font-medium text-zinc-900 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-white transition-colors block"
                        >
                          {tc.title}
                        </Link>
                        {tc.suite && (
                          <span className="text-[11px] text-zinc-500 font-mono">
                            📁 {tc.suite.name}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {tc.type}
                      </span>
                    </td>

                    <td className="p-3">
                      <span className="capitalize text-zinc-600 dark:text-zinc-400 font-medium">
                        {tc.severity}
                      </span>
                    </td>

                    <td className="p-3">
                      {latestRun ? (
                        <StatusBadge status={latestRun.status} />
                      ) : (
                        <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                          Unexecuted
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => setActiveRunningCase(tc)}
                          className="gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          title="Execute test run"
                        >
                          <Play className="h-3 w-3 fill-emerald-400" />
                          Run
                        </Button>

                        <Link href={`/projects/${projectId}/tests/${tc.id}`}>
                          <Button size="xs" variant="ghost" className="text-zinc-400 hover:text-zinc-200">
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Test Case Modal */}
      <TestCaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        projectId={projectId}
        suites={suites}
        onSaveTestCase={handleSaveTestCase}
      />

      {/* Manual Execution Runner Modal */}
      {activeRunningCase && (
        <TestRunnerModal
          isOpen={!!activeRunningCase}
          onClose={() => setActiveRunningCase(null)}
          testCase={activeRunningCase}
          environments={environments}
          onSaveRun={handleSaveRun}
        />
      )}
    </div>
  );
}
