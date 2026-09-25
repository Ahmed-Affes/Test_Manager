export interface ParsedTestCase {
  name: string;
  className: string;
  timeMs: number;
  status: 'pass' | 'fail' | 'blocked' | 'skipped';
  failureMessage?: string;
  systemOut?: string;
}

export interface ParsedSuite {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  timeMs: number;
  cases: ParsedTestCase[];
}

export interface JUnitParseResult {
  suites: ParsedSuite[];
  totalTests: number;
  totalPass: number;
  totalFail: number;
  totalSkipped: number;
  totalTimeMs: number;
}

export type JunitTestSuite = ParsedSuite;
export type JunitTestCaseResult = ParsedTestCase;
export const parseJunitXml = parseJUnitXml;

function decodeXmlEntities(str?: string): string | undefined {
  if (!str) return str;
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Parses JUnit XML string into structured test data.
 * Works across both Node and edge environments without heavy external dependencies.
 */
export function parseJUnitXml(xmlString: string): JUnitParseResult {
  if (!xmlString || typeof xmlString !== 'string' || !xmlString.trim()) {
    throw new Error('Invalid JUnit XML: empty or non-string input');
  }

  if (!xmlString.includes('<testsuite') && !xmlString.includes('<testcase')) {
    throw new Error('Invalid JUnit XML: missing <testsuite> or <testcase> elements');
  }

  const suites: ParsedSuite[] = [];

  // Match testsuite elements (both <testsuite ...>...</testsuite> and self-closing <testsuite .../>)
  const suiteRegex = /<testsuite\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testsuite>)/gi;
  let suiteMatch;

  while ((suiteMatch = suiteRegex.exec(xmlString)) !== null) {
    const suiteAttrs = parseAttributes(suiteMatch[1]);
    const suiteBody = suiteMatch[2] || '';

    const suiteName = decodeXmlEntities(suiteAttrs['name']) || 'Automated Suite';
    const suiteTimeSec = parseFloat(suiteAttrs['time'] || '0') || 0;
    const timeMs = Math.round(suiteTimeSec * 1000);

    const cases: ParsedTestCase[] = [];

    // Match testcase elements within the suite (both self-closing and with bodies)
    const caseRegex = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/gi;
    let caseMatch;

    while ((caseMatch = caseRegex.exec(suiteBody)) !== null) {
      const caseAttrs = parseAttributes(caseMatch[1]);
      const caseContent = caseMatch[2] || '';

      const name = decodeXmlEntities(caseAttrs['name']) || 'Unnamed Test';
      const className = decodeXmlEntities(caseAttrs['classname']) || suiteName;
      const caseTimeSec = parseFloat(caseAttrs['time'] || '0') || 0;
      const caseTimeMs = Math.round(caseTimeSec * 1000);

      let status: 'pass' | 'fail' | 'blocked' | 'skipped' = 'pass';
      let failureMessage: string | undefined = undefined;

      if (/<failure\b/i.test(caseContent)) {
        status = 'fail';
        const failureMatch = /<failure\b([^>]*?)(?:\/>|>([\s\S]*?)<\/failure>)/i.exec(caseContent);
        if (failureMatch) {
          const failAttrs = parseAttributes(failureMatch[1]);
          failureMessage = failAttrs['message'] || failureMatch[2]?.trim();
        }
      } else if (/<error\b/i.test(caseContent)) {
        status = 'fail';
        const errorMatch = /<error\b([^>]*?)(?:\/>|>([\s\S]*?)<\/error>)/i.exec(caseContent);
        if (errorMatch) {
          const errAttrs = parseAttributes(errorMatch[1]);
          failureMessage = errAttrs['message'] || errorMatch[2]?.trim();
        }
      } else if (/<skipped\b/i.test(caseContent)) {
        status = 'skipped';
      }

      // Extract system-out if present
      let systemOut: string | undefined = undefined;
      const sysOutMatch = /<system-out>([\s\S]*?)<\/system-out>/i.exec(caseContent);
      if (sysOutMatch) {
        systemOut = decodeXmlEntities(sysOutMatch[1].trim());
      }

      cases.push({
        name,
        className,
        timeMs: caseTimeMs,
        status,
        failureMessage: decodeXmlEntities(failureMessage),
        systemOut,
      });
    }

    const suiteTests = parseInt(suiteAttrs['tests'] || `${cases.length}`, 10);
    const suiteFailures = cases.filter((c) => c.status === 'fail').length;
    const suiteSkipped = cases.filter((c) => c.status === 'skipped').length;

    suites.push({
      name: suiteName,
      tests: suiteTests,
      failures: suiteFailures,
      errors: 0,
      skipped: suiteSkipped,
      timeMs,
      cases,
    });
  }

  // Fallback: If no <testsuite> tag was found, try finding loose <testcase> tags
  if (suites.length === 0) {
    const looseCaseRegex = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/gi;
    let match;
    const fallbackCases: ParsedTestCase[] = [];

    while ((match = looseCaseRegex.exec(xmlString)) !== null) {
      const caseAttrs = parseAttributes(match[1]);
      const caseContent = match[2] || '';
      const name = decodeXmlEntities(caseAttrs['name']) || 'Unnamed Test';
      const className = decodeXmlEntities(caseAttrs['classname']) || 'Default';
      const caseTimeSec = parseFloat(caseAttrs['time'] || '0') || 0;

      let status: 'pass' | 'fail' | 'blocked' | 'skipped' = 'pass';
      let failureMessage: string | undefined = undefined;

      if (/<failure/i.test(caseContent) || /<error/i.test(caseContent)) {
        status = 'fail';
        const failMatch = /<(?:failure|error)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:failure|error)>)/i.exec(caseContent);
        if (failMatch) {
          const failAttrs = parseAttributes(failMatch[1]);
          failureMessage = failAttrs['message'] || failMatch[2]?.trim();
        }
      } else if (/<skipped/i.test(caseContent)) {
        status = 'skipped';
      }

      fallbackCases.push({
        name,
        className,
        timeMs: Math.round(caseTimeSec * 1000),
        status,
        failureMessage: decodeXmlEntities(failureMessage),
      });
    }

    if (fallbackCases.length > 0) {
      suites.push({
        name: 'Automated Import Suite',
        tests: fallbackCases.length,
        failures: fallbackCases.filter((c) => c.status === 'fail').length,
        errors: 0,
        skipped: fallbackCases.filter((c) => c.status === 'skipped').length,
        timeMs: fallbackCases.reduce((acc, c) => acc + c.timeMs, 0),
        cases: fallbackCases,
      });
    }
  }

  const totalTests = suites.reduce((acc, s) => acc + s.cases.length, 0);
  const totalFail = suites.reduce((acc, s) => acc + s.cases.filter((c) => c.status === 'fail').length, 0);
  const totalSkipped = suites.reduce((acc, s) => acc + s.cases.filter((c) => c.status === 'skipped').length, 0);
  const totalPass = totalTests - totalFail - totalSkipped;
  const totalTimeMs = suites.reduce((acc, s) => acc + s.timeMs, 0);

  return {
    suites,
    totalTests,
    totalPass,
    totalFail,
    totalSkipped,
    totalTimeMs,
  };
}

function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([a-zA-Z0-9_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = regex.exec(attrString)) !== null) {
    attrs[match[1]] = match[2] !== undefined ? match[2] : match[3];
  }
  return attrs;
}
