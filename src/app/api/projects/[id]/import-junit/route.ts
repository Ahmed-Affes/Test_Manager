import { NextRequest, NextResponse } from 'next/server';
import { parseJUnitXml, JUnitParseResult, ParsedSuite, ParsedTestCase } from '@/lib/junit-parser';
import { createClient } from '@/lib/supabase/server';
import { TestRunStatus } from '@/lib/types';

function parseJsonTestResults(jsonText: string): JUnitParseResult | null {
  try {
    const data = JSON.parse(jsonText);
    const suites: ParsedSuite[] = [];

    // Format 1: Direct suites array { suites: [...] }
    if (Array.isArray(data.suites)) {
      let totalTests = 0;
      let totalPass = 0;
      let totalFail = 0;
      let totalSkipped = 0;
      let totalTime = 0;

      for (const s of data.suites) {
        const cases: ParsedTestCase[] = [];
        const suiteCases = Array.isArray(s.cases) ? s.cases : [];
        let suitePass = 0;
        let suiteFail = 0;
        let suiteSkip = 0;

        for (const c of suiteCases) {
          const status = (c.status || 'pass').toLowerCase() as 'pass' | 'fail' | 'blocked' | 'skipped';
          if (status === 'pass') suitePass++;
          else if (status === 'fail' || status === 'blocked') suiteFail++;
          else suiteSkip++;

          cases.push({
            name: c.name || c.title || 'Unnamed Test',
            className: c.className || c.suite || s.name || 'Automated',
            timeMs: Number(c.timeMs || c.duration || 0),
            status,
            failureMessage: c.failureMessage || (Array.isArray(c.failureMessages) ? c.failureMessages.join('\n') : undefined),
            systemOut: c.systemOut || c.output || undefined,
          });
        }

        const suiteTime = Number(s.timeMs || s.duration || cases.reduce((acc, c) => acc + c.timeMs, 0));
        suites.push({
          name: s.name || 'Automated Suite',
          tests: cases.length,
          failures: suiteFail,
          errors: 0,
          skipped: suiteSkip,
          timeMs: suiteTime,
          cases,
        });

        totalTests += cases.length;
        totalPass += suitePass;
        totalFail += suiteFail;
        totalSkipped += suiteSkip;
        totalTime += suiteTime;
      }

      return {
        suites,
        totalTests,
        totalPass,
        totalFail,
        totalSkipped,
        totalTimeMs: totalTime,
      };
    }

    // Format 2: Jest / Vitest JSON report { testResults: [...] }
    if (Array.isArray(data.testResults)) {
      let totalTests = 0;
      let totalPass = 0;
      let totalFail = 0;
      let totalSkipped = 0;
      let totalTime = 0;

      for (const suiteResult of data.testResults) {
        const suiteName = suiteResult.name
          ? suiteResult.name.split(/[\\/]/).pop()?.replace(/\.(test|spec)\.[jt]sx?$/, '') || 'Suite'
          : 'Automated Suite';

        const cases: ParsedTestCase[] = [];
        const assertions = Array.isArray(suiteResult.assertionResults) ? suiteResult.assertionResults : [];
        let suitePass = 0;
        let suiteFail = 0;
        let suiteSkip = 0;

        for (const a of assertions) {
          const rawStatus = (a.status || '').toLowerCase();
          const status: 'pass' | 'fail' | 'blocked' | 'skipped' =
            rawStatus === 'passed' ? 'pass' : rawStatus === 'failed' ? 'fail' : 'skipped';

          if (status === 'pass') suitePass++;
          else if (status === 'fail') suiteFail++;
          else suiteSkip++;

          const failMsg = Array.isArray(a.failureMessages) && a.failureMessages.length > 0
            ? a.failureMessages.join('\n')
            : undefined;

          cases.push({
            name: a.title || 'Unnamed test',
            className: (a.ancestorTitles && a.ancestorTitles.join(' > ')) || suiteName,
            timeMs: Math.round(Number(a.duration || 0)),
            status,
            failureMessage: failMsg,
          });
        }

        const suiteTime = Math.round(Number(suiteResult.endTime - suiteResult.startTime || 0));
        suites.push({
          name: suiteName,
          tests: cases.length,
          failures: suiteFail,
          errors: 0,
          skipped: suiteSkip,
          timeMs: suiteTime > 0 ? suiteTime : cases.reduce((acc, c) => acc + c.timeMs, 0),
          cases,
        });

        totalTests += cases.length;
        totalPass += suitePass;
        totalFail += suiteFail;
        totalSkipped += suiteSkip;
        totalTime += suiteTime;
      }

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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const rawBody = await request.text();
    if (!rawBody || !rawBody.trim()) {
      return NextResponse.json({ error: 'Empty request body' }, { status: 400 });
    }

    // CI query parameters
    const searchParams = request.nextUrl.searchParams;
    const environmentId = searchParams.get('environment_id') || null;
    const applicationVersion = searchParams.get('version') || 'ci-build';
    const buildNumber = searchParams.get('build') || null;
    const branch = searchParams.get('branch') || null;
    const commitSha = searchParams.get('commit') || null;
    const createIssues = searchParams.get('create_issues') === 'true';

    // Parse either JSON or XML
    let parseResult: JUnitParseResult | null = null;
    const trimmed = rawBody.trim();

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      parseResult = parseJsonTestResults(trimmed);
    }

    if (!parseResult) {
      try {
        parseResult = parseJUnitXml(trimmed);
      } catch (xmlErr: any) {
        return NextResponse.json(
          { error: `Failed to parse test report: ${xmlErr.message}` },
          { status: 400 }
        );
      }
    }

    if (!parseResult || parseResult.suites.length === 0) {
      return NextResponse.json(
        { error: 'No test suites or test cases parsed from payload' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Verify project exists
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, key')
      .eq('id', projectId)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const projectKey = project.key;

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
    let runsInserted = 0;
    let casesCreated = 0;
    let suitesCreated = 0;
    let issuesCreated = 0;

    for (const suite of parseResult.suites) {
      const suiteNameTrimmed = suite.name.trim();
      let suiteId = suiteMap.get(suiteNameTrimmed.toLowerCase());

      if (!suiteId) {
        const { data: newSuite } = await supabase
          .from('suites')
          .insert({
            project_id: projectId,
            name: suiteNameTrimmed,
            description: `Automated test suite: ${suiteNameTrimmed}`,
            status: 'active',
            created_by: user?.id || null,
          })
          .select('id')
          .single();

        if (newSuite) {
          suiteId = newSuite.id;
          suiteMap.set(suiteNameTrimmed.toLowerCase(), newSuite.id);
          suitesCreated++;
        }
      }

      for (const tc of suite.cases) {
        let testCaseId = caseMap.get(tc.name.toLowerCase().trim());

        if (!testCaseId) {
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
              created_by: user?.id || null,
            })
            .select('id')
            .single();

          if (newCase) {
            testCaseId = newCase.id;
            caseMap.set(tc.name.toLowerCase().trim(), newCase.id);
            casesCreated++;
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
              environment_id: environmentId,
              application_version: applicationVersion,
              build_number: buildNumber,
              branch: branch,
              commit_sha: commitSha,
              actual_result: tc.failureMessage || tc.systemOut || null,
              tester_id: user?.id || null,
              executed_by: user?.id || null,
            })
            .select('id')
            .single();

          runsInserted++;

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

            // Optional automated defect creation
            if (createIssues && runStatus === 'fail') {
              const issueKey = `BUG-${Date.now().toString().slice(-4)}`;
              await supabase.from('issues').insert({
                project_id: projectId,
                test_case_id: testCaseId,
                test_run_id: newRun.id,
                issue_key: issueKey,
                title: `Automated Test Failure: ${tc.name}`,
                description: tc.failureMessage || 'Automated test failed in CI pipeline',
                severity: 'critical',
                priority: 'high',
                status: 'open',
                created_by: user?.id || null,
              });
              issuesCreated++;
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${parseResult.totalTests} tests`,
      stats: {
        total: parseResult.totalTests,
        passed: parseResult.totalPass,
        failed: parseResult.totalFail,
        skipped: parseResult.totalSkipped,
        runsInserted,
        casesCreated,
        suitesCreated,
        issuesCreated,
      },
    });
  } catch (err: any) {
    console.error('CI Ingestion error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

