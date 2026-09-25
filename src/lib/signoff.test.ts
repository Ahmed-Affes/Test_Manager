import { describe, it, expect } from 'vitest';

export function calculateQualityGating({
  testCases,
  testRuns,
  issues,
}: {
  testCases: Array<{ id: string }>;
  testRuns: Array<{ test_case_id: string; status: string; created_at: string }>;
  issues: Array<{ severity: string; status: string }>;
}) {
  const openBlockers = issues.filter(
    (i) =>
      i.status !== 'closed' &&
      i.status !== 'rejected' &&
      (i.severity === 'blocker' || i.severity === 'critical')
  ).length;

  if (testCases.length === 0) {
    return {
      passRate: 0,
      openBlockers,
      isReleaseReady: false,
    };
  }

  // Get latest status for each test case
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

  const passRate = totalExecuted > 0 ? Math.round((passed / totalExecuted) * 100) : 0;
  const isReleaseReady = openBlockers === 0 && passRate >= 90;

  return {
    passRate,
    openBlockers,
    isReleaseReady,
  };
}

describe('QA Release Verification & Sign-off Gate', () => {
  it('should qualify for release when pass rate >= 90% and 0 blockers exist', () => {
    const testCases = Array.from({ length: 10 }, (_, i) => ({ id: `tc-${i + 1}` }));
    // 9 passes, 1 failure
    const testRuns = [
      ...testCases.slice(0, 9).map((tc) => ({
        test_case_id: tc.id,
        status: 'pass',
        created_at: '2026-09-25T10:00:00Z',
      })),
      {
        test_case_id: 'tc-10',
        status: 'fail',
        created_at: '2026-09-25T10:00:00Z',
      },
    ];

    const issues: Array<{ severity: string; status: string }> = [];

    const result = calculateQualityGating({ testCases, testRuns, issues });
    expect(result.passRate).toBe(90);
    expect(result.openBlockers).toBe(0);
    expect(result.isReleaseReady).toBe(true);
  });

  it('should block release when an open blocker issue exists even with 100% pass rate', () => {
    const testCases = [{ id: 'tc-1' }, { id: 'tc-2' }];
    const testRuns = [
      { test_case_id: 'tc-1', status: 'pass', created_at: '2026-09-25T10:00:00Z' },
      { test_case_id: 'tc-2', status: 'pass', created_at: '2026-09-25T10:00:00Z' },
    ];
    const issues = [{ severity: 'blocker', status: 'open' }];

    const result = calculateQualityGating({ testCases, testRuns, issues });
    expect(result.passRate).toBe(100);
    expect(result.openBlockers).toBe(1);
    expect(result.isReleaseReady).toBe(false);
  });

  it('should evaluate latest test run per case preserving history of retests', () => {
    const testCases = [{ id: 'tc-1' }];
    // Run 1 failed, Run 2 passed
    const testRuns = [
      { test_case_id: 'tc-1', status: 'fail', created_at: '2026-09-25T08:00:00Z' },
      { test_case_id: 'tc-1', status: 'pass', created_at: '2026-09-25T09:00:00Z' },
    ];
    const issues = [{ severity: 'critical', status: 'closed' }]; // closed issue is not a blocker

    const result = calculateQualityGating({ testCases, testRuns, issues });
    expect(result.passRate).toBe(100);
    expect(result.openBlockers).toBe(0);
    expect(result.isReleaseReady).toBe(true);
  });

  it('should reject release if pass rate is under 90%', () => {
    const testCases = Array.from({ length: 10 }, (_, i) => ({ id: `tc-${i + 1}` }));
    // 8 passes, 2 fails = 80% pass rate
    const testRuns = [
      ...testCases.slice(0, 8).map((tc) => ({
        test_case_id: tc.id,
        status: 'pass',
        created_at: '2026-09-25T10:00:00Z',
      })),
      { test_case_id: 'tc-9', status: 'fail', created_at: '2026-09-25T10:00:00Z' },
      { test_case_id: 'tc-10', status: 'fail', created_at: '2026-09-25T10:00:00Z' },
    ];
    const issues: Array<{ severity: string; status: string }> = [];

    const result = calculateQualityGating({ testCases, testRuns, issues });
    expect(result.passRate).toBe(80);
    expect(result.isReleaseReady).toBe(false);
  });
});
