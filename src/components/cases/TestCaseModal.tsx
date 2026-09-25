'use client';

import * as React from 'react';
import {
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  FileText,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  TestSuite,
  TestCase,
  TestType,
  TestPriority,
  TestSeverity,
  TestCaseStatus,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface StepDraft {
  id: string;
  action: string;
  expected_result: string;
}

interface TestCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  suites: TestSuite[];
  initialData?: Partial<TestCase>;
  onSaveTestCase: (caseData: any) => Promise<void>;
}

export function TestCaseModal({
  isOpen,
  onClose,
  projectId,
  suites,
  initialData,
  onSaveTestCase,
}: TestCaseModalProps) {
  const [suiteId, setSuiteId] = React.useState<string>(
    initialData?.suite_id || ''
  );
  const [title, setTitle] = React.useState(initialData?.title || '');
  const [description, setDescription] = React.useState(
    initialData?.description || ''
  );
  const [type, setType] = React.useState<TestType>(
    initialData?.type || 'functional'
  );
  const [priority, setPriority] = React.useState<TestPriority>(
    initialData?.priority || 'medium'
  );
  const [severity, setSeverity] = React.useState<TestSeverity>(
    initialData?.severity || 'major'
  );
  const [status, setStatus] = React.useState<TestCaseStatus>(
    initialData?.status || 'active'
  );
  const [preconditions, setPreconditions] = React.useState(
    initialData?.preconditions || ''
  );
  const [testData, setTestData] = React.useState(initialData?.test_data || '');
  const [expectedResult, setExpectedResult] = React.useState(
    initialData?.expected_result || 'All execution steps pass with zero defects'
  );

  const [steps, setSteps] = React.useState<StepDraft[]>([
    {
      id: 'step-1',
      action: 'Open target application page',
      expected_result: 'Page loads with HTTP 200 and initial view is rendered',
    },
  ]);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setSuiteId(initialData.suite_id || '');
      setType(initialData.type || 'functional');
      setPriority(initialData.priority || 'medium');
      setSeverity(initialData.severity || 'major');
      setStatus(initialData.status || 'active');
      setPreconditions(initialData.preconditions || '');
      setTestData(initialData.test_data || '');
      setExpectedResult(initialData.expected_result || 'All execution steps pass with zero defects');
    }
  }, [initialData]);

  if (!isOpen) return null;

  const handleAddStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        id: `step-${Date.now()}`,
        action: '',
        expected_result: '',
      },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    setSteps((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleStepChange = (
    index: number,
    field: 'action' | 'expected_result',
    value: string
  ) => {
    setSteps((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Test case title is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSaveTestCase({
        title: title.trim(),
        description: description.trim() || null,
        suite_id: suiteId || null,
        type,
        priority,
        severity,
        status,
        preconditions: preconditions.trim() || null,
        test_data: testData.trim() || null,
        expected_result: expectedResult.trim() || steps[0]?.expected_result || 'All execution steps pass with zero defects',
        steps: steps.filter((s) => s.action.trim().length > 0),
      });

      onClose();
    } catch (err: any) {
      console.error('Save test case failed:', err);
      setError(err.message || 'Failed to save test case');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-2xl text-zinc-900 dark:text-zinc-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">
                {initialData ? 'Edit Test Case' : 'Create Test Case'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Define the verification requirements, steps, and expected behaviors.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500 dark:text-rose-400 shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body - Scrollable */}
        <form
          id="test-case-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto pr-2 py-4 space-y-4"
        >
          {/* Title & Suite */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Title <span className="text-rose-500">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Verify user authentication with valid credentials"
                className="text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Test Suite
              </label>
              <Select
                value={suiteId}
                onChange={(e) => setSuiteId(e.target.value)}
                className="text-xs"
              >
                <option value="">(No Suite / General)</option>
                {suites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Description / Objective
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the purpose and scope of this test..."
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none"
            />
          </div>

          {/* Classification Attributes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Type
              </label>
              <Select
                value={type}
                onChange={(e) => setType(e.target.value as TestType)}
                className="text-xs"
              >
                <option value="functional">Functional</option>
                <option value="regression">Regression</option>
                <option value="integration">Integration</option>
                <option value="system">System</option>
                <option value="security">Security</option>
                <option value="performance">Performance</option>
                <option value="exploratory">Exploratory</option>
                <option value="automated">Automated</option>
                <option value="manual">Manual</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Priority
              </label>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TestPriority)}
                className="text-xs"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Severity
              </label>
              <Select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as TestSeverity)}
                className="text-xs"
              >
                <option value="blocker">Blocker</option>
                <option value="critical">Critical</option>
                <option value="major">Major</option>
                <option value="minor">Minor</option>
                <option value="trivial">Trivial</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Status
              </label>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as TestCaseStatus)}
                className="text-xs"
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="deprecated">Deprecated</option>
              </Select>
            </div>
          </div>

          {/* Preconditions & Test Data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Preconditions
              </label>
              <textarea
                rows={2}
                value={preconditions}
                onChange={(e) => setPreconditions(e.target.value)}
                placeholder="e.g. User account exists in database and is verified"
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Test Data / Inputs
              </label>
              <textarea
                rows={2}
                value={testData}
                onChange={(e) => setTestData(e.target.value)}
                placeholder="e.g. email: tester@example.com, payload: { role: 'admin' }"
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Overall Expected Result */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Overall Expected Result <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={expectedResult}
              onChange={(e) => setExpectedResult(e.target.value)}
              placeholder="e.g. All filesystem metadata invariants maintained and system mounts cleanly"
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none"
              required
            />
          </div>

          {/* Step-by-Step Procedure */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Step-by-Step Execution Procedure
                </span>
                <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                  ({steps.length} {steps.length === 1 ? 'step' : 'steps'})
                </span>
              </div>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={handleAddStep}
                className="gap-1 border-zinc-200 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
              >
                <Plus className="h-3 w-3" />
                Add Step
              </Button>
            </div>

            <div className="space-y-2.5">
              {steps.map((step, idx) => (
                <div
                  key={step.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/60 p-3 flex gap-3 items-start group"
                >
                  <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-[10px] font-mono font-medium text-zinc-700 dark:text-zinc-300">
                      {idx + 1}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleMoveStep(idx, 'up')}
                        disabled={idx === 0}
                        className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-20 p-0.5"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveStep(idx, 'down')}
                        disabled={idx === steps.length - 1}
                        className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-20 p-0.5"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1">
                        Action / Instruction
                      </span>
                      <textarea
                        rows={2}
                        value={step.action}
                        onChange={(e) =>
                          handleStepChange(idx, 'action', e.target.value)
                        }
                        placeholder={`Step ${idx + 1} action...`}
                        className="w-full rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:border-zinc-400 dark:focus:border-zinc-700 focus:outline-none"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1">
                        Expected Result
                      </span>
                      <textarea
                        rows={2}
                        value={step.expected_result}
                        onChange={(e) =>
                          handleStepChange(
                            idx,
                            'expected_result',
                            e.target.value
                          )
                        }
                        placeholder="What should be observed..."
                        className="w-full rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:border-zinc-400 dark:focus:border-zinc-700 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveStep(idx)}
                    disabled={steps.length <= 1}
                    className="text-zinc-400 hover:text-rose-500 dark:text-zinc-600 dark:hover:text-rose-400 p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800/80 transition-colors disabled:opacity-20"
                    title="Remove step"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-200 dark:border-zinc-800/80 shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="test-case-form"
            variant="primary"
            isLoading={isSubmitting}
          >
            {initialData ? 'Save Changes' : 'Create Test Case'}
          </Button>
        </div>
      </div>
    </div>
  );
}
