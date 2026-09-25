'use client';

import * as React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  UserCheck,
  CheckCircle,
  XCircle,
  Clock,
  Send,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import { logAuditEvent } from '@/lib/audit';

export interface SignoffCardProps {
  projectId: string;
  testCases?: any[];
  testRuns?: any[];
  issues?: any[];
  onSignoffComplete?: () => Promise<void> | void;
  // Optional direct props
  passRate?: number;
  openBlockers?: number;
  isSignedOff?: boolean;
  signedOffBy?: string | null;
  signedOffAt?: string | null;
  onSignOff?: () => void;
  onRevokeSignOff?: () => void;
  canSignOff?: boolean;
}

export function SignoffCard({
  projectId,
  testCases = [],
  testRuns = [],
  issues = [],
  onSignoffComplete,
  passRate: directPassRate,
  openBlockers: directOpenBlockers,
  isSignedOff: directIsSignedOff,
  signedOffBy,
  signedOffAt,
  onSignOff,
  onRevokeSignOff,
  canSignOff = true,
}: SignoffCardProps) {
  const supabase = createClient();

  // Dialog / form state
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [role, setRole] = React.useState<'qa_lead' | 'release_manager' | 'architect' | 'eng_lead'>('qa_lead');
  const [decision, setDecision] = React.useState<'approved' | 'rejected'>('approved');
  const [notes, setNotes] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Compute metrics from real dataset if not directly supplied
  const openBlockers =
    directOpenBlockers !== undefined
      ? directOpenBlockers
      : issues.filter(
          (i) =>
            i.status !== 'closed' &&
            i.status !== 'rejected' &&
            (i.severity === 'blocker' || i.severity === 'critical')
        ).length;

  const calculatedPassRate = React.useMemo(() => {
    if (directPassRate !== undefined) return directPassRate;
    if (testCases.length === 0) return 0;

    // Latest status per case
    const caseMap = new Map<string, string>();
    const sortedRuns = [...testRuns].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    sortedRuns.forEach((r) => {
      caseMap.set(r.test_case_id, r.status);
    });

    let passed = 0;
    let totalExecuted = 0;
    testCases.forEach((tc) => {
      const status = caseMap.get(tc.id);
      if (status) {
        totalExecuted++;
        if (status === 'pass' || status === 'passed') passed++;
      }
    });

    return totalExecuted > 0 ? Math.round((passed / totalExecuted) * 100) : 0;
  }, [directPassRate, testCases, testRuns]);

  const isReleaseReady = openBlockers === 0 && calculatedPassRate >= 90;

  const handleSubmitSignoff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    setIsSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from('report_signoffs').insert({
        project_id: projectId,
        user_id: user?.id || null,
        role,
        decision,
        notes: notes.trim() || null,
        signed_at: new Date().toISOString(),
      });

      if (error) {
        console.warn('report_signoffs insert error:', error.message);
      }

      await logAuditEvent({
        projectId,
        action: 'create_signoff',
        entityType: 'report_signoff',
        details: { role, decision, pass_rate: calculatedPassRate, open_blockers: openBlockers },
      });

      setIsModalOpen(false);
      setNotes('');
      if (onSignoffComplete) {
        await onSignoffComplete();
      }
    } catch (err) {
      console.error('Failed to submit signoff:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card
        className={`border-2 ${
          openBlockers > 0
            ? 'border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/10'
            : isReleaseReady
            ? 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/10'
            : 'border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/10'
        }`}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {openBlockers > 0 ? (
                <ShieldAlert className="h-5 w-5 text-rose-500" />
              ) : isReleaseReady ? (
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              <span>Release Verification & QA Sign-Off Gate</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                openBlockers > 0
                  ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  : isReleaseReady
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
              }`}
            >
              {openBlockers > 0
                ? 'RELEASE BLOCKED'
                : isReleaseReady
                ? 'RELEASE READY (>=90%)'
                : 'PENDING CRITERIA'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
            <div className="text-xs space-y-1">
              <p className="font-medium text-zinc-800 dark:text-zinc-200">
                {openBlockers > 0
                  ? `Release is currently blocked by ${openBlockers} unresolved blocker/critical defect(s). Gating policy requires zero blockers.`
                  : isReleaseReady
                  ? `Quality gating satisfied (${calculatedPassRate}% pass rate with 0 blockers). Authorized engineers may submit official release sign-off.`
                  : `Verification progress is at ${calculatedPassRate}% pass rate. Minimum release threshold is 90%.`}
              </p>
              <div className="flex items-center gap-4 text-zinc-500 dark:text-zinc-400 font-mono text-[11px]">
                <span>Pass Rate: {calculatedPassRate}%</span>
                <span>•</span>
                <span>Blockers / Criticals: {openBlockers}</span>
                <span>•</span>
                <span>Total Cases: {testCases.length}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="primary"
                onClick={() => setIsModalOpen(true)}
                className={`gap-1.5 ${
                  openBlockers > 0
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <UserCheck className="h-4 w-4" />
                Submit QA Decision
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Decision Submission Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-2xl text-zinc-900 dark:text-zinc-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                <h3 className="text-sm font-semibold">Record Release Gate Sign-Off</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitSignoff} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Sign-Off Decision
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecision('approved')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                      decision === 'approved'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Approve for Release
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('rejected')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-colors ${
                      decision === 'rejected'
                        ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <XCircle className="h-4 w-4 text-rose-500" />
                    Hold / Require Verification
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Authorizing Role / Signatory
                </label>
                <Select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="text-xs"
                >
                  <option value="architect">Lead Systems Architect (Ahmed Affes)</option>
                  <option value="eng_lead">Systems Engineering Co-Author (Friend)</option>
                  <option value="qa_lead">Academic Advisor & Jury President (Professor)</option>
                  <option value="release_manager">PFE Capstone Defense Jury Committee</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Sign-Off Rationale & Risk Assessment
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Document gating assessment, test scope coverage, or justifications..."
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-500 text-white"
                >
                  Confirm & Sign
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
