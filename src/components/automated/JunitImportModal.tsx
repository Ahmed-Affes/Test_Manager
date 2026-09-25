'use client';

import * as React from 'react';
import { Upload, FileCode, CheckCircle2, XCircle, AlertTriangle, Save } from 'lucide-react';
import { Environment, TestRunStatus } from '@/lib/types';
import { parseJUnitXml, ParsedSuite, ParsedTestCase } from '@/lib/junit-parser';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { StatusBadge } from '@/components/ui/status-badge';
import { logAuditEvent } from '@/lib/audit';

interface JunitImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  environments?: Environment[];
  onImportRun?: (data: {
    environment_id: string | null;
    application_version: string | null;
    build_number: string | null;
    branch: string | null;
    commit_sha: string | null;
    suites: ParsedSuite[];
    autoCreateCases: boolean;
  }) => Promise<void>;
  onImportComplete?: () => Promise<void> | void;
}

export function JunitImportModal({
  isOpen,
  onClose,
  projectId,
  environments = [],
  onImportRun,
  onImportComplete,
}: JunitImportModalProps) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = React.useState<'upload' | 'paste'>('paste');
  const [xmlContent, setXmlContent] = React.useState('');
  const [parsedSuites, setParsedSuites] = React.useState<ParsedSuite[] | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);

  // Metadata
  const [environmentId, setEnvironmentId] = React.useState<string>(environments[0]?.id || '');
  const [appVersion, setAppVersion] = React.useState('ci-build');
  const [buildNumber, setBuildNumber] = React.useState('');
  const [branch, setBranch] = React.useState('main');
  const [commitSha, setCommitSha] = React.useState('');
  const [autoCreateCases, setAutoCreateCases] = React.useState(true);
  const [isImporting, setIsImporting] = React.useState(false);

  // Sample JUnit XML template for testing convenience
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="Authentication & API Suite" tests="4" failures="1" errors="0" skipped="1" time="2.45">
  <testcase classname="AuthService" name="should generate JWT token on valid credentials" time="0.32" />
  <testcase classname="AuthService" name="should reject expired token with 401 Unauthorized" time="0.18" />
  <testcase classname="BillingService" name="should process stripe webhook idempotent charge" time="1.45">
    <failure message="Expected status 200 but received 500" type="AssertionError">
      AssertionError: Expected status 200 but received 500
      at BillingService.processWebhook (billing.test.ts:42)
    </failure>
  </testcase>
  <testcase classname="NotificationService" name="should send SMS alerts" time="0.0">
    <skipped message="SMS provider gateway offline in CI sandbox" />
  </testcase>
</testsuite>`;

  const handleParse = (text: string) => {
    setXmlContent(text);
    if (!text.trim()) {
      setParsedSuites(null);
      setParseError(null);
      return;
    }
    try {
      const result = parseJUnitXml(text);
      if (result.suites.length === 0) {
        setParseError('No <testsuite> or <testcase> elements found in XML.');
        setParsedSuites(null);
      } else {
        setParsedSuites(result.suites);
        setParseError(null);
      }
    } catch (err: any) {
      setParseError(err.message || 'Invalid XML syntax');
      setParsedSuites(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleParse(content);
    };
    reader.readAsText(file);
  };

  const totalTests = parsedSuites?.reduce((acc, s) => acc + s.tests, 0) || 0;
  const totalFailures = parsedSuites?.reduce((acc, s) => acc + s.failures + s.errors, 0) || 0;
  const totalSkipped = parsedSuites?.reduce((acc, s) => acc + s.skipped, 0) || 0;
  const totalPassed = totalTests - totalFailures - totalSkipped;

  const handleSubmit = async () => {
    if (!parsedSuites || parsedSuites.length === 0) return;

    setIsImporting(true);
    try {
      if (onImportRun) {
        await onImportRun({
          environment_id: environmentId || null,
          application_version: appVersion || null,
          build_number: buildNumber || null,
          branch: branch || null,
          commit_sha: commitSha || null,
          suites: parsedSuites,
          autoCreateCases,
        });
      } else {
        // Direct Supabase execution import
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const { data: proj } = await supabase
          .from('projects')
          .select('key')
          .eq('id', projectId)
          .single();

        const projectKey = proj?.key || 'TEST';

        // Fetch existing test cases to match or create
        // Fetch existing suites
        const { data: existingSuites } = await supabase
          .from('suites')
          .select('id, name')
          .eq('project_id', projectId);

        const suiteMap = new Map<string, string>();
        existingSuites?.forEach((s) => {
          suiteMap.set(s.name.toLowerCase().trim(), s.id);
        });

        // Fetch existing test cases to match or create
        const { data: existingCases } = await supabase
          .from('test_cases')
          .select('id, key, title')
          .eq('project_id', projectId);

        const caseMap = new Map<string, string>();
        existingCases?.forEach((c) => {
          caseMap.set(c.title.toLowerCase().trim(), c.id);
        });

        // Fetch existing run numbers to maintain immutable history
        const { data: existingRuns } = await supabase
          .from('test_runs')
          .select('test_case_id, run_number')
          .eq('project_id', projectId);

        const runCountMap = new Map<string, number>();
        existingRuns?.forEach((r) => {
          const current = runCountMap.get(r.test_case_id) || 0;
          if (r.run_number > current) {
            runCountMap.set(r.test_case_id, r.run_number);
          }
        });

        let caseCounter = (existingCases?.length || 0) + 1;

        for (const suite of parsedSuites) {
          const suiteNameTrimmed = suite.name.trim();
          let suiteId = suiteMap.get(suiteNameTrimmed.toLowerCase());

          if (!suiteId && autoCreateCases) {
            const { data: newSuite } = await supabase
              .from('suites')
              .insert({
                project_id: projectId,
                name: suiteNameTrimmed,
                description: `Automated test suite: ${suiteNameTrimmed}`,
                status: 'active',
                created_by: user?.id,
              })
              .select('id')
              .single();

            if (newSuite) {
              suiteId = newSuite.id;
              suiteMap.set(suiteNameTrimmed.toLowerCase(), newSuite.id);
            }
          }

          for (const tc of suite.cases) {
            let testCaseId = caseMap.get(tc.name.toLowerCase().trim());

            if (!testCaseId && autoCreateCases) {
              const testKey = `${projectKey}-${caseCounter++}`;
              const { data: newCase } = await supabase
                .from('test_cases')
                .insert({
                  project_id: projectId,
                  suite_id: suiteId || null,
                  key: testKey,
                  title: tc.name,
                  description: `Automated test case from ${tc.className || suite.name}`,
                  type: 'automated',
                  priority: 'medium',
                  severity: 'major',
                  status: 'active',
                  created_by: user?.id,
                })
                .select('id')
                .single();

              if (newCase) {
                testCaseId = newCase.id;
                caseMap.set(tc.name.toLowerCase().trim(), newCase.id);
              }
            }

            if (testCaseId) {
              const runStatus: TestRunStatus =
                tc.status === 'pass'
                  ? 'pass'
                  : tc.status === 'fail'
                  ? 'fail'
                  : tc.status === 'skipped'
                  ? 'skipped'
                  : 'blocked';

              const nextRunNumber = (runCountMap.get(testCaseId) || 0) + 1;
              runCountMap.set(testCaseId, nextRunNumber);

              const { data: newRun } = await supabase
                .from('test_runs')
                .insert({
                  project_id: projectId,
                  test_case_id: testCaseId,
                  run_number: nextRunNumber,
                  status: runStatus,
                  duration_ms: tc.timeMs,
                  environment_id: environmentId || null,
                  application_version: appVersion || null,
                  build_number: buildNumber || null,
                  branch: branch || null,
                  commit_sha: commitSha || null,
                  actual_result: tc.failureMessage || tc.systemOut || null,
                  tester_id: user?.id || null,
                  executed_by: user?.id || null,
                })
                .select('id')
                .single();

              if (newRun && (tc.failureMessage || tc.systemOut)) {
                const logContent = [tc.failureMessage, tc.systemOut].filter(Boolean).join('\n\n--- Console Output ---\n\n');
                await supabase.from('evidence').insert({
                  project_id: projectId,
                  test_case_id: testCaseId,
                  test_run_id: newRun.id,
                  file_path: 'text-log',
                  original_file_name: 'test-log.txt',
                  file_name: 'test-log.txt',
                  file_type: 'text/plain',
                  file_size: logContent.length,
                  file_size_bytes: logContent.length,
                  description: tc.failureMessage ? 'Automated failure log' : 'Execution log',
                  caption: tc.failureMessage ? 'Test Failure Trace' : 'Execution Output',
                  uploaded_by: user?.id || null,
                });
              }
            }
          }
        }

        await logAuditEvent({
          projectId,
          action: 'import_junit_xml',
          entityType: 'test_run',
          entityId: projectId,
          details: {
            total_tests: totalTests,
            total_pass: totalPassed,
            total_fail: totalFailures,
            build_number: buildNumber,
          },
        });

        if (onImportComplete) {
          await onImportComplete();
        }
      }

      onClose();
    } catch (err) {
      console.error('Failed to import JUnit runs:', err);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-emerald-500" />
          <span>Import Automated CI Test Results (JUnit XML)</span>
        </div>
      }
      description="Upload or paste standard JUnit XML output from pytest, Vitest, Jest, Cypress, Playwright, or Maven"
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-xs">
        {/* Method Selector */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
          <div className="flex gap-2">
            <Button
              size="xs"
              variant={activeTab === 'paste' ? 'primary' : 'outline'}
              onClick={() => setActiveTab('paste')}
            >
              Paste XML Code
            </Button>
            <Button
              size="xs"
              variant={activeTab === 'upload' ? 'primary' : 'outline'}
              onClick={() => setActiveTab('upload')}
            >
              Upload .xml File
            </Button>
          </div>

          <Button
            size="xs"
            variant="ghost"
            onClick={() => handleParse(sampleXml)}
            className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-mono text-[10px]"
          >
            Load Sample XML
          </Button>
        </div>

        {/* Input Area */}
        {activeTab === 'paste' ? (
          <div>
            <Textarea
              value={xmlContent}
              onChange={(e) => handleParse(e.target.value)}
              placeholder="Paste JUnit XML report here..."
              rows={8}
              className="font-mono text-[11px] leading-relaxed"
            />
          </div>
        ) : (
          <div className="border-2 border-dashed rounded-lg p-6 text-center border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950">
            <Upload className="h-6 w-6 text-zinc-400 mx-auto mb-2" />
            <input
              type="file"
              accept=".xml"
              onChange={handleFileUpload}
              className="text-xs"
            />
          </div>
        )}

        {parseError && (
          <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400">
            <span className="font-semibold block mb-0.5">Parse Failure:</span>
            {parseError}
          </div>
        )}

        {/* Parsed Preview */}
        {parsedSuites && (
          <div className="space-y-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-[11px]">
                Import Preview
              </span>
              <div className="flex items-center gap-3 font-mono text-xs">
                <span className="text-zinc-700 dark:text-zinc-300 font-bold">{totalTests} Tests</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{totalPassed} Pass</span>
                <span className="text-rose-600 dark:text-rose-400 font-bold">{totalFailures} Fail</span>
                <span className="text-zinc-400 font-bold">{totalSkipped} Skip</span>
              </div>
            </div>

            {/* Metadata Configuration */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-medium">Environment</label>
                <select
                  value={environmentId}
                  onChange={(e) => setEnvironmentId(e.target.value)}
                  className="w-full h-7 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2"
                >
                  <option value="">CI Runner</option>
                  {environments.map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-medium">Version</label>
                <Input
                  value={appVersion}
                  onChange={(e) => setAppVersion(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-medium">Build / Run ID</label>
                <Input
                  value={buildNumber}
                  onChange={(e) => setBuildNumber(e.target.value)}
                  placeholder="CI #5821"
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-medium">Git Branch</label>
                <Input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="autoCreateCases"
                checked={autoCreateCases}
                onChange={(e) => setAutoCreateCases(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600"
              />
              <label htmlFor="autoCreateCases" className="text-zinc-700 dark:text-zinc-300 cursor-pointer">
                Automatically create new Test Case entries for tests not already in the repository
              </label>
            </div>

            {/* Test Case Breakdown List */}
            <div className="max-h-48 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 rounded border border-zinc-100 dark:border-zinc-800">
              {parsedSuites.map((suite, sIdx) =>
                suite.cases.map((tc, tcIdx) => (
                  <div
                    key={`${sIdx}-${tcIdx}`}
                    className="p-2 flex items-center justify-between text-[11px] hover:bg-zinc-50 dark:hover:bg-zinc-950"
                  >
                    <div className="truncate pr-2">
                      <span className="font-mono text-zinc-400 mr-2">{suite.name}</span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">{tc.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-zinc-400 text-[10px]">
                        {(tc.timeMs / 1000).toFixed(2)}s
                      </span>
                      <StatusBadge
                        status={
                          tc.status === 'pass'
                            ? 'pass'
                            : tc.status === 'fail'
                            ? 'fail'
                            : tc.status === 'skipped'
                            ? 'skipped'
                            : 'blocked'
                        }
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4">
        <Button variant="outline" size="sm" onClick={onClose} disabled={isImporting}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={!parsedSuites || parsedSuites.length === 0}
          isLoading={isImporting}
          className="gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          Commit Imported Execution ({totalTests} Tests)
        </Button>
      </div>
    </Modal>
  );
}
