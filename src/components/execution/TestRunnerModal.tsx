'use client';

import * as React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  SkipForward,
  Upload,
  Paperclip,
  Clock,
  Laptop,
  GitBranch,
  Save,
} from 'lucide-react';
import { TestCase, Environment, StepStatus, TestRunStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { calculateOverallResult, formatDuration } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';

interface TestRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  testCase: TestCase;
  environments?: Environment[];
  onSaveRun: (runData: {
    test_case_id: string;
    environment_id: string | null;
    application_version: string | null;
    build_number: string | null;
    branch: string | null;
    commit_sha: string | null;
    status: TestRunStatus;
    duration_ms: number;
    actual_result: string | null;
    notes: string | null;
    step_results: Array<{
      step_id?: string;
      step_number: number;
      status: StepStatus;
      actual_result: string | null;
      notes: string | null;
    }>;
  }) => Promise<void>;
}

export function TestRunnerModal({
  isOpen,
  onClose,
  testCase,
  environments = [],
  onSaveRun,
}: TestRunnerModalProps) {
  // Timer state
  const [isRunning, setIsRunning] = React.useState(true);
  const [elapsedMs, setElapsedMs] = React.useState(0);

  // Metadata state
  const [environmentId, setEnvironmentId] = React.useState<string>(
    environments[0]?.id || ''
  );
  const [appVersion, setAppVersion] = React.useState('1.0.0');
  const [buildNumber, setBuildNumber] = React.useState('build-42');
  const [branch, setBranch] = React.useState('main');
  const [commitSha, setCommitSha] = React.useState('');
  const [overallNotes, setOverallNotes] = React.useState('');
  const [overallActual, setOverallActual] = React.useState('');
  const [manualOverrideStatus, setManualOverrideStatus] = React.useState<TestRunStatus | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // Step results state
  const [stepResults, setStepResults] = React.useState<
    Array<{
      step_id?: string;
      step_number: number;
      action: string;
      expected_result: string | null;
      status: StepStatus;
      actual_result: string;
      notes: string;
    }>
  >([]);

  // Initialize step results when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const initialSteps = (testCase.steps || []).map((s, idx) => ({
        step_id: s.id,
        step_number: s.step_number || idx + 1,
        action: s.action,
        expected_result: s.expected_result,
        status: 'pass' as StepStatus,
        actual_result: '',
        notes: '',
      }));
      setStepResults(initialSteps);
      setElapsedMs(0);
      setIsRunning(true);
      setManualOverrideStatus(null);
    }
  }, [isOpen, testCase]);

  // Stopwatch interval
  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isOpen && isRunning) {
      interval = setInterval(() => {
        setElapsedMs((prev) => prev + 1000);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, isRunning]);

  const handleStepStatusChange = (index: number, newStatus: StepStatus) => {
    setStepResults((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], status: newStatus };
      return updated;
    });
  };

  const handleStepActualChange = (index: number, val: string) => {
    setStepResults((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], actual_result: val };
      return updated;
    });
  };

  const computedOverallStatus = calculateOverallResult(stepResults);
  const effectiveStatus = manualOverrideStatus || computedOverallStatus;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveRun({
        test_case_id: testCase.id,
        environment_id: environmentId || null,
        application_version: appVersion || null,
        build_number: buildNumber || null,
        branch: branch || null,
        commit_sha: commitSha || null,
        status: effectiveStatus,
        duration_ms: elapsedMs,
        actual_result: overallActual || null,
        notes: overallNotes || null,
        step_results: stepResults.map((s) => ({
          step_id: s.step_id,
          step_number: s.step_number,
          status: s.status,
          actual_result: s.actual_result || null,
          notes: s.notes || null,
        })),
      });
      onClose();
    } catch (err) {
      console.error('Failed to save test execution:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-blue-500">{testCase.key}</span>
          <span className="text-zinc-400">/</span>
          <span>Execute Test Run</span>
        </div>
      }
      description={testCase.title}
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {/* Pre-conditions & Test Data bar */}
        {(testCase.preconditions || testCase.test_data) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs">
            {testCase.preconditions && (
              <div>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Pre-conditions:
                </span>
                <p className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap font-mono text-[11px]">
                  {testCase.preconditions}
                </p>
              </div>
            )}
            {testCase.test_data && (
              <div>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Test Data / Fixtures:
                </span>
                <p className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap font-mono text-[11px]">
                  {testCase.test_data}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Stopwatch & Environment Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-zinc-400" />
            <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {formatDuration(elapsedMs)}
            </span>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setIsRunning(!isRunning)}
              className="ml-2"
            >
              {isRunning ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
              {isRunning ? 'Pause' : 'Resume'}
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setElapsedMs(0)}
              title="Reset timer"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500 flex items-center gap-1">
              <Laptop className="h-3.5 w-3.5" /> Env:
            </span>
            <select
              value={environmentId}
              onChange={(e) => setEnvironmentId(e.target.value)}
              className="h-7 text-xs rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 text-zinc-900 dark:text-zinc-100"
            >
              <option value="">Default Environment</option>
              {environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name} ({env.os || 'Generic'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Execution Metadata Inputs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div>
            <label className="text-[10px] text-zinc-400 uppercase font-medium">Version</label>
            <Input
              value={appVersion}
              onChange={(e) => setAppVersion(e.target.value)}
              placeholder="e.g. 1.2.0"
              className="h-7 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-400 uppercase font-medium">Build</label>
            <Input
              value={buildNumber}
              onChange={(e) => setBuildNumber(e.target.value)}
              placeholder="e.g. 1045"
              className="h-7 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-400 uppercase font-medium">Branch</label>
            <Input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="h-7 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-400 uppercase font-medium">Commit SHA</label>
            <Input
              value={commitSha}
              onChange={(e) => setCommitSha(e.target.value)}
              placeholder="a1b2c3d..."
              className="h-7 text-xs font-mono"
            />
          </div>
        </div>

        {/* Step-by-Step Execution Checklist */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              Test Steps Checklist ({stepResults.length})
            </h4>
            <div className="flex items-center gap-1.5">
              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  setStepResults((prev) => prev.map((s) => ({ ...s, status: 'pass' })))
                }
              >
                Mark All Pass
              </Button>
            </div>
          </div>

          {stepResults.map((step, idx) => (
            <div
              key={step.step_id || idx}
              className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-2 text-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                    {step.step_number}
                  </span>
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{step.action}</p>
                    {step.expected_result && (
                      <p className="mt-0.5 text-zinc-500 dark:text-zinc-400 font-mono text-[11px]">
                        Expected: {step.expected_result}
                      </p>
                    )}
                  </div>
                </div>

                {/* Step Result Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStepStatusChange(idx, 'pass')}
                    className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 border transition-colors ${
                      step.status === 'pass'
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/40'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <CheckCircle2 className="h-3 w-3" /> Pass
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStepStatusChange(idx, 'fail')}
                    className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 border transition-colors ${
                      step.status === 'fail'
                        ? 'bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/40'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <XCircle className="h-3 w-3" /> Fail
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStepStatusChange(idx, 'blocked')}
                    className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 border transition-colors ${
                      step.status === 'blocked'
                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <AlertCircle className="h-3 w-3" /> Blocked
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStepStatusChange(idx, 'skipped')}
                    className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 border transition-colors ${
                      step.status === 'skipped'
                        ? 'bg-zinc-500/20 text-zinc-700 dark:text-zinc-400 border-zinc-500/40'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <SkipForward className="h-3 w-3" /> Skip
                  </button>
                </div>
              </div>

              {/* Step Actual Result input if Failed or Blocked */}
              {(step.status === 'fail' || step.status === 'blocked') && (
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <Input
                    placeholder="Describe observed failure / discrepancy for this step..."
                    value={step.actual_result}
                    onChange={(e) => handleStepActualChange(idx, e.target.value)}
                    className="h-7 text-xs bg-rose-50/30 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Overall Result & Notes Section */}
        <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Computed Overall Result:
            </span>
            <div className="flex items-center gap-2">
              <StatusBadge status={effectiveStatus} />
              <select
                value={manualOverrideStatus || ''}
                onChange={(e) =>
                  setManualOverrideStatus((e.target.value as TestRunStatus) || null)
                }
                className="h-6 text-[11px] rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1 text-zinc-700 dark:text-zinc-300"
              >
                <option value="">Auto ({computedOverallStatus.toUpperCase()})</option>
                <option value="pass">Force PASS</option>
                <option value="fail">Force FAIL</option>
                <option value="blocked">Force BLOCKED</option>
                <option value="skipped">Force SKIPPED</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Actual Execution Outcome / Result Summary:
            </label>
            <Input
              value={overallActual}
              onChange={(e) => setOverallActual(e.target.value)}
              placeholder="e.g. Completed with expected output without errors"
              className="text-xs"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 block mb-1">
              Execution Notes & Observations:
            </label>
            <Textarea
              value={overallNotes}
              onChange={(e) => setOverallNotes(e.target.value)}
              placeholder="Any additional observations, logs, or comments..."
              className="text-xs"
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4">
        <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          isLoading={isSaving}
          className="gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          Save & Commit Test Run
        </Button>
      </div>
    </Modal>
  );
}
