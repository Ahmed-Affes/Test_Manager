import { describe, it, expect } from 'vitest';

// Test runner JSON parsing helper matching API route logic
export function parseJsonTestResults(jsonText: string) {
  try {
    const data = JSON.parse(jsonText);

    // Format 1: Direct suites array { suites: [...] }
    if (Array.isArray(data.suites)) {
      let totalTests = 0;
      let totalPass = 0;
      let totalFail = 0;
      let totalSkipped = 0;
      let totalTime = 0;

      const suites = data.suites.map((s: any) => {
        const cases = (Array.isArray(s.cases) ? s.cases : []).map((c: any) => {
          const status = (c.status || 'pass').toLowerCase();
          if (status === 'pass') totalPass++;
          else if (status === 'fail' || status === 'blocked') totalFail++;
          else totalSkipped++;

          return {
            name: c.name || c.title || 'Unnamed Test',
            className: c.className || c.suite || s.name || 'Automated',
            timeMs: Number(c.timeMs || c.duration || 0),
            status,
            failureMessage: c.failureMessage,
          };
        });

        totalTests += cases.length;
        const suiteTime = Number(s.timeMs || cases.reduce((acc: number, c: any) => acc + c.timeMs, 0));
        totalTime += suiteTime;

        return {
          name: s.name || 'Automated Suite',
          tests: cases.length,
          cases,
          timeMs: suiteTime,
        };
      });

      return {
        suites,
        totalTests,
        totalPass,
        totalFail,
        totalSkipped,
        totalTimeMs: totalTime,
      };
    }

    // Format 2: Jest / Vitest format { testResults: [...] }
    if (Array.isArray(data.testResults)) {
      let totalTests = 0;
      let totalPass = 0;
      let totalFail = 0;
      let totalSkipped = 0;
      let totalTime = 0;

      const suites = data.testResults.map((suiteResult: any) => {
        const suiteName = suiteResult.name
          ? suiteResult.name.split(/[\\/]/).pop()?.replace(/\.(test|spec)\.[jt]sx?$/, '') || 'Suite'
          : 'Automated Suite';

        const cases = (Array.isArray(suiteResult.assertionResults) ? suiteResult.assertionResults : []).map((a: any) => {
          const rawStatus = (a.status || '').toLowerCase();
          const status = rawStatus === 'passed' ? 'pass' : rawStatus === 'failed' ? 'fail' : 'skipped';

          if (status === 'pass') totalPass++;
          else if (status === 'fail') totalFail++;
          else totalSkipped++;

          return {
            name: a.title || 'Unnamed test',
            className: (a.ancestorTitles && a.ancestorTitles.join(' > ')) || suiteName,
            timeMs: Math.round(Number(a.duration || 0)),
            status,
            failureMessage: Array.isArray(a.failureMessages) ? a.failureMessages.join('\n') : undefined,
          };
        });

        totalTests += cases.length;
        const suiteTime = Math.round(Number(suiteResult.endTime - suiteResult.startTime || 0));
        totalTime += suiteTime;

        return {
          name: suiteName,
          tests: cases.length,
          cases,
          timeMs: suiteTime,
        };
      });

      return {
        suites,
        totalTests,
        totalPass,
        totalFail,
        totalSkipped,
        totalTimeMs: totalTime,
      };
    }

    return null;
  } catch {
    return null;
  }
}

describe('JSON Test Results Parser (Jest / Vitest / Custom CI)', () => {
  it('should parse Jest / Vitest testResults JSON output', () => {
    const jestJson = JSON.stringify({
      numTotalTests: 3,
      numPassedTests: 2,
      numFailedTests: 1,
      startTime: 1672531190000,
      testResults: [
        {
          name: '/workspace/src/auth.test.ts',
          startTime: 1672531190000,
          endTime: 1672531190150,
          assertionResults: [
            {
              title: 'allows valid login credentials',
              ancestorTitles: ['Authentication', 'Login Flow'],
              status: 'passed',
              duration: 45,
            },
            {
              title: 'rejects expired sessions',
              ancestorTitles: ['Authentication', 'Session Flow'],
              status: 'failed',
              duration: 35,
              failureMessages: ['JWTExpiredError: Token expired 20s ago'],
            },
            {
              title: 'handles OAuth callbacks',
              ancestorTitles: ['Authentication', 'OAuth'],
              status: 'pending',
              duration: 0,
            },
          ],
        },
      ],
    });

    const parsed = parseJsonTestResults(jestJson);
    expect(parsed).not.toBeNull();
    expect(parsed?.totalTests).toBe(3);
    expect(parsed?.totalPass).toBe(1);
    expect(parsed?.totalFail).toBe(1);
    expect(parsed?.totalSkipped).toBe(1);
    expect(parsed?.suites[0].name).toBe('auth');
    expect(parsed?.suites[0].cases[1].failureMessage).toContain('JWTExpiredError');
  });

  it('should parse direct CI JSON format', () => {
    const ciJson = JSON.stringify({
      suites: [
        {
          name: 'Payment Integration',
          cases: [
            { name: 'Stripe charge', status: 'pass', timeMs: 320 },
            { name: 'PayPal refund', status: 'pass', timeMs: 410 },
          ],
        },
      ],
    });

    const parsed = parseJsonTestResults(ciJson);
    expect(parsed).not.toBeNull();
    expect(parsed?.totalTests).toBe(2);
    expect(parsed?.totalPass).toBe(2);
    expect(parsed?.totalTimeMs).toBe(730);
  });

  it('should calculate immutable run numbers monotonically for retests', () => {
    const existingRuns = [
      { test_case_id: 'tc-1', run_number: 1 },
      { test_case_id: 'tc-1', run_number: 2 },
      { test_case_id: 'tc-2', run_number: 1 },
    ];

    const runCountMap = new Map<string, number>();
    existingRuns.forEach((r) => {
      const current = runCountMap.get(r.test_case_id) || 0;
      if (r.run_number > current) {
        runCountMap.set(r.test_case_id, r.run_number);
      }
    });

    // Next run for tc-1 must be 3
    const nextTc1 = (runCountMap.get('tc-1') || 0) + 1;
    expect(nextTc1).toBe(3);

    // Next run for tc-2 must be 2
    const nextTc2 = (runCountMap.get('tc-2') || 0) + 1;
    expect(nextTc2).toBe(2);

    // Next run for a brand new tc-3 must be 1
    const nextTc3 = (runCountMap.get('tc-3') || 0) + 1;
    expect(nextTc3).toBe(1);
  });
});
