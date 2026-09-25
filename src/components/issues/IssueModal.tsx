'use client';

import * as React from 'react';
import { Bug, Save } from 'lucide-react';
import { TestCase, TestRun, Issue, TestPriority, TestSeverity, IssueStatus, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';

interface IssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  testCase?: TestCase | null;
  testRun?: TestRun | null;
  initialIssue?: Issue | null;
  members?: UserProfile[];
  onSaveIssue: (data: {
    title: string;
    description: string | null;
    test_case_id: string | null;
    test_run_id: string | null;
    severity: TestSeverity;
    priority: TestPriority;
    status: IssueStatus;
    assigned_to: string | null;
    root_cause: string | null;
    fix_description: string | null;
    related_commit: string | null;
    resolution: string | null;
  }) => Promise<void>;
}

export function IssueModal({
  isOpen,
  onClose,
  projectId,
  testCase,
  testRun,
  initialIssue,
  members = [],
  onSaveIssue,
}: IssueModalProps) {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [severity, setSeverity] = React.useState<TestSeverity>('major');
  const [priority, setPriority] = React.useState<TestPriority>('high');
  const [status, setStatus] = React.useState<IssueStatus>('open');
  const [assignedTo, setAssignedTo] = React.useState<string>('');
  const [rootCause, setRootCause] = React.useState('');
  const [fixDescription, setFixDescription] = React.useState('');
  const [relatedCommit, setRelatedCommit] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (initialIssue) {
        setTitle(initialIssue.title);
        setDescription(initialIssue.description || '');
        setSeverity(initialIssue.severity);
        setPriority(initialIssue.priority);
        setStatus(initialIssue.status);
        setAssignedTo(initialIssue.assigned_to || '');
        setRootCause(initialIssue.root_cause || '');
        setFixDescription(initialIssue.fix_description || '');
        setRelatedCommit(initialIssue.related_commit || '');
      } else {
        const defaultTitle = testCase
          ? `[Failure] ${testCase.title}`
          : 'Bug: ';
        const defaultDesc = testRun?.actual_result
          ? `Observed discrepancy in Run #${testRun.run_number}:\n${testRun.actual_result}`
          : '';
        setTitle(defaultTitle);
        setDescription(defaultDesc);
        setSeverity(testCase?.severity || 'major');
        setPriority(testCase?.priority || 'high');
        setStatus('open');
        setAssignedTo('');
        setRootCause('');
        setFixDescription('');
        setRelatedCommit('');
      }
    }
  }, [isOpen, initialIssue, testCase, testRun]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      await onSaveIssue({
        title: title.trim(),
        description: description.trim() || null,
        test_case_id: testCase?.id || initialIssue?.test_case_id || null,
        test_run_id: testRun?.id || initialIssue?.test_run_id || null,
        severity,
        priority,
        status,
        assigned_to: assignedTo || null,
        root_cause: rootCause.trim() || null,
        fix_description: fixDescription.trim() || null,
        related_commit: relatedCommit.trim() || null,
        resolution: status === 'closed' ? 'Verified resolved' : null,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save issue:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-rose-500" />
          <span>{initialIssue ? `Edit Issue ${initialIssue.issue_key}` : 'Report Verification Failure / Issue'}</span>
        </div>
      }
      description={
        testCase
          ? `Linked to test case ${testCase.key}: ${testCase.title}`
          : 'Record a bug or discrepancy observed during testing'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
            Issue Title *
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Clear, concise summary of the defect"
            required
            className="text-xs"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
              Severity
            </label>
            <Select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as TestSeverity)}
            >
              <option value="blocker">Blocker</option>
              <option value="critical">Critical</option>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
              <option value="trivial">Trivial</option>
            </Select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
              Priority
            </label>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TestPriority)}
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
              Status
            </label>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as IssueStatus)}
            >
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="in_progress">In Progress</option>
              <option value="fixed">Fixed</option>
              <option value="retesting">Retesting</option>
              <option value="closed">Closed</option>
              <option value="rejected">Rejected</option>
              <option value="wont_fix">Won&apos;t Fix</option>
            </Select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
              Assignee
            </label>
            <Select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.email}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
            Steps to Reproduce & Discrepancy Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Detailed description of what failed, actual vs expected, error messages..."
          />
        </div>

        {/* Technical Resolution Fields (Root Cause & Fix) */}
        <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-3">
          <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs uppercase tracking-wider">
            Engineering Root Cause & Resolution Tracking
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-medium block mb-1">
                Root Cause Analysis
              </label>
              <Textarea
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                rows={2}
                placeholder="Why did this failure occur?"
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-medium block mb-1">
                Fix Description
              </label>
              <Textarea
                value={fixDescription}
                onChange={(e) => setFixDescription(e.target.value)}
                rows={2}
                placeholder="How was it resolved in code?"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 uppercase font-medium block mb-1">
              Related Commit SHA / PR Link
            </label>
            <Input
              value={relatedCommit}
              onChange={(e) => setRelatedCommit(e.target.value)}
              placeholder="e.g. 7f83b2a or PR #142"
              className="font-mono text-xs"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            isLoading={isSaving}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {initialIssue ? 'Save Changes' : 'Submit Issue'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
