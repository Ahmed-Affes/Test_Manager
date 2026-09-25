import { describe, it, expect } from 'vitest';
import { parseJUnitXml } from './junit-parser';

describe('JUnit Parser', () => {
  it('should parse a basic JUnit XML with passing tests', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Mocha Tests" tests="2" failures="0" errors="0" time="0.045">
    <testsuite name="Auth Service" tests="2" failures="0" errors="0" skipped="0" time="0.045">
        <testcase classname="Auth Service" name="should hash passwords correctly" time="0.020" />
        <testcase classname="Auth Service" name="should validate JWT tokens" time="0.025" />
    </testsuite>
</testsuites>`;

    const result = parseJUnitXml(xml);

    expect(result.totalTests).toBe(2);
    expect(result.totalPass).toBe(2);
    expect(result.totalFail).toBe(0);
    expect(result.totalSkipped).toBe(0);
    expect(result.suites).toHaveLength(1);
    expect(result.suites[0].name).toBe('Auth Service');
    expect(result.suites[0].cases).toHaveLength(2);
    expect(result.suites[0].cases[0].status).toBe('pass');
    expect(result.suites[0].cases[0].timeMs).toBe(20);
    expect(result.suites[0].cases[1].timeMs).toBe(25);
  });

  it('should handle test failures with error traces and system-out', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="Payment Gateway" tests="3" failures="1" errors="0" skipped="1" time="1.500">
    <testcase classname="Payments" name="process valid card" time="0.500" />
    <testcase classname="Payments" name="handle expired card" time="0.800">
        <failure message="Expected status 402 but received 500" type="AssertionError">
            AssertionError: Expected status 402 but received 500
            at Object.&lt;anonymous&gt; (test/payments.test.js:42:12)
        </failure>
        <system-out>Transaction ID: tx_987654321 failed with code 500</system-out>
    </testcase>
    <testcase classname="Payments" name="process apple pay" time="0.200">
        <skipped message="Feature flag disabled in staging" />
    </testcase>
</testsuite>`;

    const result = parseJUnitXml(xml);

    expect(result.totalTests).toBe(3);
    expect(result.totalPass).toBe(1);
    expect(result.totalFail).toBe(1);
    expect(result.totalSkipped).toBe(1);
    expect(result.suites).toHaveLength(1);

    const failedCase = result.suites[0].cases.find((c) => c.status === 'fail');
    expect(failedCase).toBeDefined();
    expect(failedCase?.name).toBe('handle expired card');
    expect(failedCase?.failureMessage).toContain('Expected status 402 but received 500');
    expect(failedCase?.systemOut).toContain('Transaction ID: tx_987654321');

    const skippedCase = result.suites[0].cases.find((c) => c.status === 'skipped');
    expect(skippedCase).toBeDefined();
    expect(skippedCase?.name).toBe('process apple pay');
  });

  it('should parse multiple testsuites elements', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
    <testsuite name="Frontend Suite" tests="1" failures="0" time="0.100">
        <testcase classname="UI" name="renders header" time="0.100" />
    </testsuite>
    <testsuite name="Backend Suite" tests="1" failures="0" time="0.200">
        <testcase classname="API" name="GET /health returns 200" time="0.200" />
    </testsuite>
</testsuites>`;

    const result = parseJUnitXml(xml);

    expect(result.suites).toHaveLength(2);
    expect(result.suites[0].name).toBe('Frontend Suite');
    expect(result.suites[1].name).toBe('Backend Suite');
    expect(result.totalTests).toBe(2);
    expect(result.totalPass).toBe(2);
  });

  it('should throw an error for malformed or empty XML', () => {
    expect(() => parseJUnitXml('')).toThrow();
    expect(() => parseJUnitXml('not xml content')).toThrow();
  });
});
