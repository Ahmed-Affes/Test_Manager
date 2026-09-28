import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/** ------------------------------------------------------------------ *
 *  Agent-Sync API — Authentication helper
 *  Accepts key via X-Agent-Key header OR ?agent_key= query parameter.
 *  Set AGENT_API_KEY in your environment to enable auth enforcement.
 *  When not set, the API remains open (backward compatible).
 * ------------------------------------------------------------------- */
function isAuthorized(request: Request): boolean {
  const requiredKey = process.env.AGENT_API_KEY;
  if (!requiredKey) return true; // open when env var not configured

  const headerKey = request.headers.get('x-agent-key') || request.headers.get('authorization')?.replace('Bearer ', '');
  const urlKey = new URL(request.url).searchParams.get('agent_key');
  return headerKey === requiredKey || urlKey === requiredKey;
}

/**
 * GET /api/projects/[id]/agent-sync
 * Allows the AI agent to inspect the full project tree:
 * - All test cases with their 1-based index (e.g. index 1 = "first test"), key, title, steps, suite, latest run
 * - All test suites
 * - All environments
 * - All bugs & issues
 * - All execution runs
 * - All test plans / milestones
 *
 * Query filters (all optional):
 *   ?suite=<name>       Filter test cases to a specific suite
 *   ?status=<status>    Filter test cases by status (active|draft|deprecated)
 *   ?priority=<p>       Filter test cases by priority (low|medium|high|critical)
 *   ?run_status=<s>     Filter test cases by latest run status (pass|fail|blocked|untested)
 *   ?include_coverage=true  Append coverage metrics block
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized: invalid or missing agent API key' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const filterSuite = url.searchParams.get('suite')?.toLowerCase() || null;
    const filterStatus = url.searchParams.get('status')?.toLowerCase() || null;
    const filterPriority = url.searchParams.get('priority')?.toLowerCase() || null;
    const filterRunStatus = url.searchParams.get('run_status')?.toLowerCase() || null;
    const includeCoverage = url.searchParams.get('include_coverage') === 'true';
    const admin = createAdminClient();

    // 1. Resolve project by UUID or Key (e.g. MORPH)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let projQuery = admin.from('projects').select('*');
    if (isUuid) {
      projQuery = projQuery.eq('id', id);
    } else {
      projQuery = projQuery.ilike('key', id);
    }
    const { data: project, error: projErr } = await projQuery.single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. Fetch all test cases with their steps, suite, and runs
    const { data: cases } = await admin
      .from('test_cases')
      .select(`
        *,
        suite:test_suites(id, name),
        steps:test_steps(id, step_number, action, expected_result, notes),
        runs:test_runs(id, run_number, status, duration_ms, actual_result, created_at)
      `)
      .eq('project_id', project.id)
      .order('created_at', { ascending: true });

    // 3. Fetch test suites
    const { data: suites } = await admin
      .from('test_suites')
      .select('*')
      .eq('project_id', project.id)
      .order('name', { ascending: true });

    // 4. Fetch environments
    const { data: environments } = await admin
      .from('environments')
      .select('*')
      .eq('project_id', project.id)
      .order('name', { ascending: true });

    // 5. Fetch issues
    const { data: issues } = await admin
      .from('issues')
      .select(`
        *,
        test_case:test_cases(id, key, title)
      `)
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    // 6. Fetch test runs
    const { data: runs } = await admin
      .from('test_runs')
      .select(`
        *,
        test_case:test_cases(id, key, title),
        environment:environments(id, name)
      `)
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    // 7. Fetch test plans
    const { data: plans } = await admin
      .from('test_plans')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    // Map and enrich test cases
    let mappedCases = (cases || []).map((c, idx) => {
      const latestRun = c.runs && c.runs.length > 0
        ? [...c.runs].sort((a: any, b: any) => (b.run_number || 0) - (a.run_number || 0) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        : null;
      return {
        index: idx + 1, // 1-based index: 1 = first test
        id: c.id,
        key: c.key,
        title: c.title,
        description: c.description,
        type: c.type,
        priority: c.priority,
        severity: c.severity,
        status: c.status,
        expected_result: c.expected_result,
        suite: c.suite?.name || null,
        suite_id: c.suite_id,
        steps: (c.steps || []).sort((a: any, b: any) => a.step_number - b.step_number),
        latest_run: latestRun,
        latest_run_status: latestRun?.status || 'untested',
      };
    });

    // Apply optional filters
    if (filterSuite) {
      mappedCases = mappedCases.filter((c) => (c.suite || '').toLowerCase() === filterSuite);
    }
    if (filterStatus) {
      mappedCases = mappedCases.filter((c) => (c.status || '').toLowerCase() === filterStatus);
    }
    if (filterPriority) {
      mappedCases = mappedCases.filter((c) => (c.priority || '').toLowerCase() === filterPriority);
    }
    if (filterRunStatus) {
      mappedCases = mappedCases.filter((c) => c.latest_run_status === filterRunStatus);
    }

    // Coverage metrics
    const totalCases = (cases || []).length;
    const passCount = (cases || []).filter((c) => {
      const r = c.runs && c.runs.length > 0
        ? [...c.runs].sort((a: any, b: any) => (b.run_number || 0) - (a.run_number || 0) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        : null;
      return r?.status === 'pass';
    }).length;
    const failCount = (cases || []).filter((c) => {
      const r = c.runs && c.runs.length > 0
        ? [...c.runs].sort((a: any, b: any) => (b.run_number || 0) - (a.run_number || 0) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        : null;
      return r?.status === 'fail';
    }).length;
    const blockedCount = (cases || []).filter((c) => {
      const r = c.runs && c.runs.length > 0
        ? [...c.runs].sort((a: any, b: any) => (b.run_number || 0) - (a.run_number || 0) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        : null;
      return r?.status === 'blocked';
    }).length;
    const untestedCount = totalCases - passCount - failCount - blockedCount;
    const openIssueCount = (issues || []).filter((i) => i.status !== 'closed' && i.status !== 'resolved').length;

    const coverageMetrics = {
      total: totalCases,
      pass: passCount,
      fail: failCount,
      blocked: blockedCount,
      untested: untestedCount,
      pass_rate: totalCases > 0 ? Math.round((passCount / totalCases) * 100) : 0,
      execution_rate: totalCases > 0 ? Math.round(((totalCases - untestedCount) / totalCases) * 100) : 0,
      open_bugs: openIssueCount,
    };

    const response: any = {
      success: true,
      project: { id: project.id, key: project.key, name: project.name, description: project.description },
      counts: {
        cases: cases?.length || 0,
        suites: suites?.length || 0,
        environments: environments?.length || 0,
        issues: issues?.length || 0,
        runs: runs?.length || 0,
        plans: plans?.length || 0,
      },
      coverage: coverageMetrics,
      test_cases: mappedCases,
      test_suites: suites || [],
      environments: environments || [],
      issues: issues || [],
      test_runs: runs || [],
      test_plans: plans || [],
    };

    // Only include verbose coverage block when explicitly requested
    if (!includeCoverage) {
      delete response.test_runs; // omit bulky runs list by default to save tokens
    }

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('Agent GET error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/agent-sync
 * Autonomous endpoint for AI agents to perform ANY QA action:
 * - Create, update, or delete test cases (support matching by index like 1 for "first test", key, or id)
 * - Update steps on existing test cases
 * - Execute test runs (mark pass/fail/blocked with telemetry)
 * - Auto-create defects on failure or retest and close defects on pass
 * - Manage suites, environments, plans, and evidence
 * - Reset or wipe project data
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized: invalid or missing agent API key' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const admin = createAdminClient();

    // 1. Resolve project by UUID or Key (e.g. MORPH)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let projQuery = admin.from('projects').select('*');
    if (isUuid) {
      projQuery = projQuery.eq('id', id);
    } else {
      projQuery = projQuery.ilike('key', id);
    }
    const { data: project, error: projErr } = await projQuery.single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const {
      reset = false,
      wipe = false,
      clear = false,
      suite: singleSuiteParam,
      suites: multiSuitesParam,
      suite_description = 'Automated verification suite created by AI agent',
      environment: singleEnvParam,
      environments: multiEnvsParam,
      plan: singlePlanParam,
      plans: multiPlansParam,
      milestone: singleMilestoneParam,
      milestones: multiMilestonesParam,
      signoff: singleSignoffParam,
      signoffs: multiSignoffsParam,
      gates: gatesParam,
      evidence: topLevelEvidence = [],
    } = body;

    // Normalizing aliases
    const rawTests: any[] = body.tests || body.testCases || body.test_cases || body.cases || [];
    const rawRuns: any[] = body.runs || body.testRuns || body.test_runs || body.executions || [];
    const rawIssues: any[] = body.issues || body.defects || body.crashes || body.bugs || [];
    const deleteTests: any[] = body.delete_tests || body.delete_cases || body.deleteTestCases || [];
    const deleteIssues: any[] = body.delete_issues || body.delete_bugs || [];
    const deleteSuites: any[] = body.delete_suites || [];
    const retests: any[] = body.retests || (body.retest ? [body.retest] : []);
    const rawComments: any[] = body.comments || body.notes || [];
    const updateIssues: any[] = body.update_issues || body.patch_issues || [];

    // Support autonomous project wipe / fresh start if requested
    if (reset || wipe || clear) {
      await admin.from('evidence').delete().eq('project_id', project.id);
      await admin.from('issues').delete().eq('project_id', project.id);
      await admin.from('test_runs').delete().eq('project_id', project.id);
      await admin.from('test_cases').delete().eq('project_id', project.id);
      await admin.from('test_suites').delete().eq('project_id', project.id);
      await admin.from('test_plans').delete().eq('project_id', project.id);
      await admin.from('environments').delete().eq('project_id', project.id);
      await admin.from('report_signoffs').delete().eq('project_id', project.id);
    }

    const summary = {
      created_suites: 0,
      created_environments: 0,
      created_plans: 0,
      created_cases: 0,
      updated_cases: 0,
      deleted_cases: 0,
      created_runs: 0,
      created_issues: 0,
      resolved_issues: 0,
      deleted_issues: 0,
      attached_evidence: 0,
      recorded_signoffs: 0,
      details: [] as any[],
    };

    // Helper caches for dynamically created or existing entities
    const suiteCache = new Map<string, string>();
    const envCache = new Map<string, string>();
    const planCache = new Map<string, string>();

    // Helper: Resolve or Create Suite
    async function resolveOrCreateSuite(rawSuite: any): Promise<string | null> {
      if (!rawSuite) return null;
      const name = (typeof rawSuite === 'string' ? rawSuite : rawSuite.name || '').trim();
      if (!name) return null;

      const cacheKey = name.toLowerCase();
      if (suiteCache.has(cacheKey)) return suiteCache.get(cacheKey)!;

      const { data: existing } = await admin
        .from('test_suites')
        .select('id, name')
        .eq('project_id', project.id)
        .ilike('name', name)
        .maybeSingle();

      if (existing) {
        suiteCache.set(cacheKey, existing.id);
        return existing.id;
      }

      const desc = typeof rawSuite === 'object' && rawSuite.description ? rawSuite.description : suite_description;
      const { data: created, error: suiteErr } = await admin
        .from('test_suites')
        .insert({
          project_id: project.id,
          name,
          description: desc,
          status: 'active',
        })
        .select('id')
        .single();

      if (suiteErr || !created) {
        console.warn('Failed to create suite:', suiteErr?.message);
        return null;
      }

      suiteCache.set(cacheKey, created.id);
      summary.created_suites++;
      return created.id;
    }

    // Helper: Resolve or Create Environment
    async function resolveOrCreateEnvironment(rawEnv: any): Promise<string | null> {
      if (!rawEnv) return null;
      const name = (typeof rawEnv === 'string' ? rawEnv : rawEnv.name || '').trim();
      if (!name) return null;

      const cacheKey = name.toLowerCase();
      if (envCache.has(cacheKey)) return envCache.get(cacheKey)!;

      const { data: existing } = await admin
        .from('environments')
        .select('id, name')
        .eq('project_id', project.id)
        .ilike('name', name)
        .maybeSingle();

      if (existing) {
        envCache.set(cacheKey, existing.id);
        return existing.id;
      }

      const envObj = typeof rawEnv === 'object' ? rawEnv : {};
      const { data: created } = await admin
        .from('environments')
        .insert({
          project_id: project.id,
          name,
          os: envObj.os || 'Windows 11 (WinFsp/QEMU)',
          cpu: envObj.cpu || null,
          ram: envObj.ram || null,
          runtime: envObj.runtime || 'PowerShell 7 / FIO Harness',
          tools: envObj.tools || null,
          description: envObj.description || 'Target execution environment registered by AI agent',
        })
        .select('id')
        .single();

      if (created) {
        envCache.set(cacheKey, created.id);
        summary.created_environments++;
        return created.id;
      }
      return null;
    }

    // Helper: Resolve or Create Test Plan / Milestone
    async function resolveOrCreatePlan(rawPlan: any): Promise<string | null> {
      if (!rawPlan) return null;
      const name = (typeof rawPlan === 'string' ? rawPlan : rawPlan.name || '').trim();
      if (!name) return null;

      const cacheKey = name.toLowerCase();
      if (planCache.has(cacheKey)) return planCache.get(cacheKey)!;

      const { data: existing } = await admin
        .from('test_plans')
        .select('id, name')
        .eq('project_id', project.id)
        .ilike('name', name)
        .maybeSingle();

      if (existing) {
        planCache.set(cacheKey, existing.id);
        return existing.id;
      }

      const planObj = typeof rawPlan === 'object' ? rawPlan : {};
      const { data: created } = await admin
        .from('test_plans')
        .insert({
          project_id: project.id,
          name,
          description: planObj.description || 'PFE verification milestone plan created by AI agent',
          status: planObj.status || 'in_progress',
        })
        .select('id')
        .single();

      if (created) {
        planCache.set(cacheKey, created.id);
        summary.created_plans++;
        return created.id;
      }
      return null;
    }

    // 2. Pre-process top-level suites
    let defaultSuiteId: string | null = null;
    if (singleSuiteParam) {
      defaultSuiteId = await resolveOrCreateSuite(singleSuiteParam);
    }
    const suitesList = multiSuitesParam || body.test_suites;
    if (Array.isArray(suitesList)) {
      for (const s of suitesList) {
        const sid = await resolveOrCreateSuite(s);
        if (!defaultSuiteId) defaultSuiteId = sid;
      }
    }

    // 3. Pre-process top-level environments
    let defaultEnvId: string | null = null;
    if (singleEnvParam) {
      defaultEnvId = await resolveOrCreateEnvironment(singleEnvParam);
    }
    const envsList = multiEnvsParam || body.envs;
    if (Array.isArray(envsList)) {
      for (const e of envsList) {
        const eid = await resolveOrCreateEnvironment(e);
        if (!defaultEnvId) defaultEnvId = eid;
      }
    }

    // 4. Pre-process top-level plans / milestones
    let defaultPlanId: string | null = null;
    const planCandidate = singlePlanParam || singleMilestoneParam;
    if (planCandidate) {
      defaultPlanId = await resolveOrCreatePlan(planCandidate);
    }
    const multiPlans = multiPlansParam || multiMilestonesParam;
    if (Array.isArray(multiPlans)) {
      for (const p of multiPlans) {
        const pid = await resolveOrCreatePlan(p);
        if (!defaultPlanId) defaultPlanId = pid;
      }
    }

    // 5. Fetch all existing test cases ordered by created_at ascending
    // This allows 1-based indexing: index 1 = first test case, index 2 = second test case
    let { data: allProjectCases } = await admin
      .from('test_cases')
      .select('id, key, title, created_at, suite_id')
      .eq('project_id', project.id)
      .order('created_at', { ascending: true });

    let existingCasesList = allProjectCases || [];
    let nextCaseIndex = existingCasesList.length + 1;

    // Helper to find existing case by various user-friendly identifiers
    function findExistingCase(item: any) {
      if (!item) return null;
      if (typeof item === 'string' || typeof item === 'number') {
        item = { target: item };
      }

      // 1. Direct UUID
      const idCandidate =
        item.id ||
        (typeof item.target === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.target.trim())
          ? item.target.trim()
          : null);
      if (idCandidate) {
        const match = existingCasesList.find((c) => c.id.toLowerCase() === idCandidate.toLowerCase());
        if (match) return match;
      }

      // 2. Exact or case-insensitive Key (check key, test_case_key, testKey, target_key, target, target_test, test_target)
      const keyCandidate =
        item.key ||
        item.test_case_key ||
        item.testKey ||
        item.target_key ||
        item.target ||
        item.target_test ||
        item.test_target;
      if (keyCandidate) {
        const keyTrimmed = String(keyCandidate).toLowerCase().trim();
        const match = existingCasesList.find((c) => c.key.toLowerCase() === keyTrimmed);
        if (match) return match;
      }

      // 3. Positional / 1-based index ("first", "last", or numeric string / number)
      const targetStr = typeof item.target === 'string' ? item.target.toLowerCase().trim() : '';
      if (targetStr === 'first' || item.first === true || item.first_test === true) {
        if (existingCasesList.length > 0) return existingCasesList[0];
      }
      if (targetStr === 'last' || item.last === true || item.last_test === true) {
        if (existingCasesList.length > 0) return existingCasesList[existingCasesList.length - 1];
      }

      let numIdx: number | null = null;
      if (typeof item.index === 'number') numIdx = item.index;
      else if (typeof item.order === 'number') numIdx = item.order;
      else if (typeof item.target === 'number') numIdx = item.target;
      else if (targetStr && /^\d+$/.test(targetStr)) numIdx = parseInt(targetStr, 10);

      if (numIdx !== null && numIdx > 0 && numIdx <= existingCasesList.length) {
        return existingCasesList[numIdx - 1];
      }

      // 4. Exact Title Match
      if (item.title) {
        const titleTrimmed = String(item.title).toLowerCase().trim();
        const match = existingCasesList.find((c) => c.title.toLowerCase().trim() === titleTrimmed);
        if (match) return match;
      }

      // 5. Target / target_test matching title or partial title
      const strToMatch = item.target_test || item.test_target || item.target;
      if (strToMatch) {
        const str = String(strToMatch).toLowerCase().trim();
        const match = existingCasesList.find(
          (c) => c.key.toLowerCase() === str || c.title.toLowerCase() === str || c.title.toLowerCase().includes(str)
        );
        if (match) return match;
      }

      return null;
    }

    // Helper to find existing issue by UUID, exact key, or flexible format
    // (e.g. MORPH-BUG-1, BUG-MORPH-001, BUG-MORPH-1, or pure number string '1')
    async function findExistingIssue(target: any) {
      if (!target) return null;
      const str = (typeof target === 'object' ? target.issue_key || target.key || target.id : String(target)).trim();
      if (!str) return null;

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      if (isUuid) {
        const { data } = await admin.from('issues').select('*').eq('id', str).eq('project_id', project.id).maybeSingle();
        if (data) return data;
      }

      // Exact case-insensitive match
      const { data: exact } = await admin.from('issues').select('*').ilike('issue_key', str).eq('project_id', project.id).maybeSingle();
      if (exact) return exact;

      // Extract numeric suffix if present
      const numMatch = str.match(/\d+$/);
      if (numMatch) {
        const num = parseInt(numMatch[0], 10);
        const { data: allIssues } = await admin.from('issues').select('*').eq('project_id', project.id);
        if (allIssues && allIssues.length > 0) {
          const matched = allIssues.find((i) => {
            if (i.issue_key.toLowerCase() === str.toLowerCase()) return true;
            const iNumMatch = i.issue_key.match(/\d+$/);
            return iNumMatch && parseInt(iNumMatch[0], 10) === num;
          });
          if (matched) return matched;
        }
      }

      return null;
    }

    // Helper to safely delete a test case and all associated cascade data
    async function deleteTestCaseWithCascade(caseId: string) {
      // 1. Delete test_step_results for all runs on this case
      const { data: runsToDel } = await admin.from('test_runs').select('id').eq('test_case_id', caseId);
      if (runsToDel && runsToDel.length > 0) {
        await admin.from('test_step_results').delete().in('test_run_id', runsToDel.map((r) => r.id));
      }

      // 2. Delete issue_history for all issues on this case
      const { data: issuesToDel } = await admin.from('issues').select('id').eq('test_case_id', caseId);
      if (issuesToDel && issuesToDel.length > 0) {
        await admin.from('issue_history').delete().in('issue_id', issuesToDel.map((i) => i.id));
      }

      await admin.from('test_steps').delete().eq('test_case_id', caseId);
      await admin.from('test_runs').delete().eq('test_case_id', caseId);
      await admin.from('issues').delete().eq('test_case_id', caseId);
      await admin.from('evidence').delete().eq('test_case_id', caseId);
      await admin.from('test_plan_items').delete().eq('test_case_id', caseId);
      await admin.from('test_cases').delete().eq('id', caseId);
    }

    // 6. Handle explicit delete_tests array
    if (Array.isArray(deleteTests) && deleteTests.length > 0) {
      for (const target of deleteTests) {
        const matched = findExistingCase(target);
        if (matched) {
          await deleteTestCaseWithCascade(matched.id);
          summary.deleted_cases++;
          existingCasesList = existingCasesList.filter((c) => c.id !== matched.id);
        }
      }
    }

    // 7. Process Test Cases (Insert, Update, or Delete)
    if (Array.isArray(rawTests) && rawTests.length > 0) {
      for (let i = 0; i < rawTests.length; i++) {
        const item = rawTests[i];
        const matched = findExistingCase(item);

        // Check if this action is explicitly a deletion
        if (item.action === 'delete' || item.delete === true) {
          if (matched) {
            await deleteTestCaseWithCascade(matched.id);
            summary.deleted_cases++;
            existingCasesList = existingCasesList.filter((c) => c.id !== matched.id);
          }
          continue;
        }

        // Determine suite for this case
        const caseSuiteId = item.suite !== undefined ? await resolveOrCreateSuite(item.suite) : defaultSuiteId;
        // Determine environment for this case
        const caseEnvId = item.environment
          ? await resolveOrCreateEnvironment(item.environment)
          : item.run?.environment
          ? await resolveOrCreateEnvironment(item.run.environment)
          : defaultEnvId;
        // Determine plan for this case
        const casePlanId = (item.plan || item.milestone)
          ? await resolveOrCreatePlan(item.plan || item.milestone)
          : defaultPlanId;

        let caseId: string | null = null;
        let testKey = item.key;
        let testTitle = item.title;

        if (matched) {
          // UPDATE existing test case!
          caseId = matched.id;
          testKey = item.key || matched.key;
          testTitle = item.title !== undefined ? item.title : matched.title;

          const updateFields: any = { updated_at: new Date().toISOString() };
          if (item.title !== undefined) updateFields.title = item.title;
          if (item.key !== undefined) updateFields.key = item.key;
          if (item.suite !== undefined) {
            updateFields.suite_id = caseSuiteId;
          } else if (defaultSuiteId !== null) {
            updateFields.suite_id = defaultSuiteId;
          }
          if (item.description !== undefined) updateFields.description = item.description;
          if (item.priority !== undefined) updateFields.priority = item.priority;
          if (item.severity !== undefined) updateFields.severity = item.severity;
          if (item.type !== undefined) updateFields.type = item.type;
          if (item.preconditions !== undefined) updateFields.preconditions = item.preconditions;
          if (item.test_data !== undefined) updateFields.test_data = item.test_data;
          if (item.expected_result !== undefined) updateFields.expected_result = item.expected_result;
          if (item.status !== undefined) updateFields.status = item.status;

          await admin.from('test_cases').update(updateFields).eq('id', caseId);
          summary.updated_cases++;

          // If steps are provided on update, replace existing steps
          if (Array.isArray(item.steps)) {
            await admin.from('test_steps').delete().eq('test_case_id', caseId);
            if (item.steps.length > 0) {
              const stepInserts = item.steps.map((st: any, idx: number) => ({
                test_case_id: caseId,
                step_number: idx + 1,
                action: typeof st === 'string' ? st : st.action || `Execute step ${idx + 1}`,
                expected_result: typeof st === 'object' ? st.expected || st.expected_result : null,
                notes: typeof st === 'object' ? st.notes : null,
              }));
              await admin.from('test_steps').insert(stepInserts);
            }
          }
        } else {
          // CREATE new test case
          testKey = item.key || `${project.key}-${String(nextCaseIndex).padStart(3, '0')}`;
          testTitle = item.title || `Test Case ${nextCaseIndex}`;
          nextCaseIndex++;

          const expectedOverall =
            item.expected_result || item.steps?.[0]?.expected || 'Expected behavior verified without crash or corruption';

          const { data: newCase, error: caseErr } = await admin
            .from('test_cases')
            .insert({
              project_id: project.id,
              suite_id: caseSuiteId ?? null,
              key: testKey,
              title: testTitle,
              description: item.description || null,
              priority: item.priority || 'medium',
              severity: item.severity || 'major',
              type: item.type || 'automated',
              preconditions: item.preconditions || null,
              test_data: item.test_data || null,
              expected_result: expectedOverall,
              status: item.status || 'active',
            })
            .select('id')
            .single();

          if (caseErr || !newCase) {
            console.warn('Failed to insert test case:', caseErr?.message);
            continue;
          }

          caseId = newCase.id;
          summary.created_cases++;
          existingCasesList.push({ id: caseId, key: testKey, title: testTitle, created_at: new Date().toISOString(), suite_id: caseSuiteId });

          // Insert steps for new case
          if (Array.isArray(item.steps) && item.steps.length > 0) {
            const stepInserts = item.steps.map((st: any, idx: number) => ({
              test_case_id: caseId,
              step_number: idx + 1,
              action: typeof st === 'string' ? st : st.action || `Execute step ${idx + 1}`,
              expected_result: typeof st === 'object' ? st.expected || st.expected_result : null,
              notes: typeof st === 'object' ? st.notes : null,
            }));
            await admin.from('test_steps').insert(stepInserts);
          }
        }

        if (caseId) {
          // Link to Test Plan / Milestone if designated
          if (casePlanId) {
            await admin
              .from('test_plan_items')
              .upsert({ test_plan_id: casePlanId, test_case_id: caseId }, { onConflict: 'test_plan_id,test_case_id' });
          }

          // Case-level evidence
          if (Array.isArray(item.evidence) && item.evidence.length > 0) {
            for (const ev of item.evidence) {
              await admin.from('evidence').insert({
                project_id: project.id,
                test_case_id: caseId,
                original_file_name: ev.file_name || ev.original_file_name || 'test_artifact.log',
                file_path: ev.file_path || `vault/${project.key}/${Date.now()}-${ev.file_name || 'artifact.log'}`,
                file_type: ev.file_type || 'text/plain',
                file_size: ev.file_size || ev.size || 1024,
                description: ev.description || 'Verification evidence attached by AI agent',
              });
              summary.attached_evidence++;
            }
          }

          // Execution Run Recording on this test
          const runParam = item.run || item.execute || (item.run_status ? { status: item.run_status } : null);
          if (runParam) {
            const runStatus = runParam.status || 'in_progress';
            const { data: testRun, error: runErr } = await admin
              .from('test_runs')
              .insert({
                project_id: project.id,
                test_case_id: caseId,
                environment_id: caseEnvId,
                status: runStatus,
                duration_ms: runParam.duration_ms || 120,
                actual_result: runParam.actual_result || (runStatus === 'pass' ? 'Verification passed successfully' : runStatus === 'fail' ? 'Execution failed' : `Execution status: ${runStatus}`),
                notes: runParam.notes || 'Executed autonomously via AI Agent test sync',
                application_version: runParam.version || runParam.application_version || 'v1.0.0-dev',
                branch: runParam.branch || 'main',
                commit_sha: runParam.commit_sha || null,
              })
              .select()
              .single();

            if (!runErr && testRun) {
              summary.created_runs++;

              // Record Step Results
              const stepResultsList = runParam.step_results || runParam.steps;
              if (Array.isArray(stepResultsList) && stepResultsList.length > 0) {
                const stepResults = stepResultsList.map((sr: any, sIdx: number) => ({
                  test_run_id: testRun.id,
                  step_number: sr.step_number || sIdx + 1,
                  status: sr.status || 'pass',
                  actual_result: sr.actual_result || null,
                  notes: sr.notes || null,
                }));
                await admin.from('test_step_results').insert(stepResults);
              }

              // Auto-create defect on failure if requested and not already open
              const shouldCreateDefect = item.create_defect === true || Boolean(item.defect || item.issue);
              if ((runStatus === 'fail' || runStatus === 'blocked') && shouldCreateDefect) {
                const { data: openBugs } = await admin
                  .from('issues')
                  .select('id, issue_key, status')
                  .eq('test_case_id', caseId)
                  .in('status', ['open', 'investigating', 'in_progress', 'retesting', 'fixed']);

                if (!openBugs || openBugs.length === 0) {
                  const { count: issueCount } = await admin
                    .from('issues')
                    .select('*', { count: 'exact', head: true })
                    .eq('project_id', project.id);
                  const nextNum = (issueCount || 0) + 1;
                  const issueKey = `${project.key}-BUG-${nextNum}`;
                  const defect = item.defect || item.issue || {};
                  const { data: createdIssue } = await admin.from('issues').insert({
                    project_id: project.id,
                    test_case_id: caseId,
                    test_run_id: testRun.id,
                    issue_key: issueKey,
                    title: defect.title || `[Defect] ${testTitle} verification failed`,
                    description:
                      defect.description ||
                      runParam.actual_result ||
                      'Automated execution failure detected during AI agent verification.',
                    severity: defect.severity || item.severity || 'major',
                    priority: defect.priority || item.priority || 'high',
                    status: defect.status || 'open',
                    root_cause: defect.root_cause || null,
                    fix_description: defect.fix_description || null,
                    related_commit: runParam.commit_sha || null,
                  }).select('id').single();

                  if (createdIssue) {
                    summary.created_issues++;
                    await admin.from('issue_history').insert({
                      issue_id: createdIssue.id,
                      old_status: null,
                      new_status: 'open',
                      comment: `Auto-created defect from failing run: ${runParam.actual_result || 'Execution failed'}`,
                    });
                  }
                }
              }

              // Auto-resolve open defects if passed
              if (runStatus === 'pass') {
                const { data: openBugs } = await admin
                  .from('issues')
                  .select('id, issue_key, status')
                  .eq('test_case_id', caseId)
                  .in('status', ['open', 'investigating', 'in_progress', 'retesting', 'fixed']);

                if (openBugs && openBugs.length > 0) {
                  for (const ob of openBugs) {
                    const passRes = `Verified resolved: Test passed in Run #${testRun.run_number || 'Latest'}`;
                    await admin
                      .from('issues')
                      .update({
                        status: 'closed',
                        resolution: passRes,
                        updated_at: new Date().toISOString(),
                      })
                      .eq('id', ob.id);

                    summary.resolved_issues++;
                    await admin.from('issue_history').insert({
                      issue_id: ob.id,
                      old_status: ob.status || 'open',
                      new_status: 'closed',
                      comment: passRes,
                    });
                  }
                }
              }
            }
          }

          summary.details.push({ key: testKey, title: testTitle, case_id: caseId });
        }
      }
    }

    // 8. Process standalone Runs array
    if (Array.isArray(rawRuns) && rawRuns.length > 0) {
      for (const r of rawRuns) {
        const targetCase = findExistingCase(r);
        if (!targetCase) continue;

        const runEnvId = r.environment ? await resolveOrCreateEnvironment(r.environment) : defaultEnvId;
        const runStatus = r.status || 'pass';

        const { data: createdRun, error: rErr } = await admin
          .from('test_runs')
          .insert({
            project_id: project.id,
            test_case_id: targetCase.id,
            environment_id: runEnvId,
            status: runStatus,
            duration_ms: r.duration_ms || 150,
            actual_result: r.actual_result || (runStatus === 'pass' ? 'Standalone run completed successfully' : 'Execution failed'),
            notes: r.notes || 'Recorded via agent-sync runs payload',
            application_version: r.version || r.application_version || null,
            branch: r.branch || 'main',
            commit_sha: r.commit_sha || null,
          })
          .select()
          .single();

        if (!rErr && createdRun) {
          summary.created_runs++;

          if (Array.isArray(r.step_results)) {
            const stepResults = r.step_results.map((sr: any, sIdx: number) => ({
              test_run_id: createdRun.id,
              step_number: sr.step_number || sIdx + 1,
              status: sr.status || 'pass',
              actual_result: sr.actual_result || null,
              notes: sr.notes || null,
            }));
            await admin.from('test_step_results').insert(stepResults);
          }

          if (runStatus === 'pass') {
            const { data: openBugs } = await admin
              .from('issues')
              .select('id, issue_key, status')
              .eq('test_case_id', targetCase.id)
              .in('status', ['open', 'investigating', 'in_progress', 'retesting', 'fixed']);

            if (openBugs && openBugs.length > 0) {
              for (const ob of openBugs) {
                await admin.from('issues').update({ status: 'closed', resolution: 'Verified in standalone run', updated_at: new Date().toISOString() }).eq('id', ob.id);
                summary.resolved_issues++;
              }
            }
          } else if (runStatus === 'fail' || runStatus === 'blocked') {
            const { data: openBugs } = await admin
              .from('issues')
              .select('id, issue_key, status')
              .eq('test_case_id', targetCase.id)
              .in('status', ['open', 'investigating', 'in_progress', 'retesting', 'fixed']);

            if (!openBugs || openBugs.length === 0) {
              const { count: issueCount } = await admin
                .from('issues')
                .select('*', { count: 'exact', head: true })
                .eq('project_id', project.id);
              const nextNum = (issueCount || 0) + 1;
              const issueKey = `${project.key}-BUG-${nextNum}`;

              const defect = r.defect || r.issue || {};
              const { data: createdIssue } = await admin
                .from('issues')
                .insert({
                  project_id: project.id,
                  test_case_id: targetCase.id,
                  test_run_id: createdRun.id,
                  issue_key: issueKey,
                  title: defect.title || `[Defect] ${targetCase.title} execution failed`,
                  description: defect.description || r.actual_result || 'Automated execution failure detected during test run.',
                  severity: defect.severity || (targetCase as any).severity || 'major',
                  priority: defect.priority || (targetCase as any).priority || 'high',
                  status: defect.status || 'open',
                  root_cause: defect.root_cause || r.notes || r.actual_result || null,
                  fix_description: defect.fix_description || null,
                  related_commit: r.commit_sha || null,
                })
                .select('id')
                .single();

              if (createdIssue) {
                summary.created_issues++;
                await admin.from('issue_history').insert({
                  issue_id: createdIssue.id,
                  old_status: null,
                  new_status: 'open',
                  comment: `Auto-created defect from failing run: ${r.actual_result || 'Execution failed'}`,
                });
              }
            }
          }
        }
      }
    }

    // 9. Process Retests
    if (Array.isArray(retests) && retests.length > 0) {
      for (const ret of retests) {
        const foundIssue = await findExistingIssue(ret.issue_key || ret.issue_id || ret.issue);
        const targetCase = findExistingCase(ret);
        const caseId = targetCase?.id || foundIssue?.test_case_id || null;

        const status = ret.status || 'pass';
        if (caseId) {
          const { data: newRun } = await admin.from('test_runs').insert({
            project_id: project.id,
            test_case_id: caseId,
            status,
            actual_result: ret.actual_result || (status === 'pass' ? 'Retest passed verification' : 'Retest failed'),
            notes: ret.notes || 'Retest execution via agent sync',
            duration_ms: ret.duration_ms || 100,
          }).select().single();

          if (newRun) {
            summary.created_runs++;
          }
        }

        if (foundIssue) {
          const newStatus = status === 'pass' ? 'closed' : 'retesting';
          await admin.from('issues').update({
            status: newStatus,
            resolution: status === 'pass' ? (ret.actual_result || 'Retest passed verification') : foundIssue.resolution,
            updated_at: new Date().toISOString(),
          }).eq('id', foundIssue.id);

          if (status === 'pass') {
            summary.resolved_issues++;
          }

          await admin.from('issue_history').insert({
            issue_id: foundIssue.id,
            old_status: foundIssue.status,
            new_status: newStatus,
            comment: ret.actual_result || (status === 'pass' ? 'Retest passed verification' : 'Retest failed verification'),
          });
        }
      }
    }

    // 10. Process Standalone Issues / Defects
    if (Array.isArray(rawIssues) && rawIssues.length > 0) {
      for (let idx = 0; idx < rawIssues.length; idx++) {
        const iss = rawIssues[idx];
        const issKey = iss.key || iss.issue_key || `${project.key}-BUG-${Date.now().toString().slice(-4)}${idx}`;
        let normalizedStatus = (iss.status || 'open').toLowerCase();
        if (normalizedStatus === 'resolved') normalizedStatus = 'closed';
        if (!['open', 'investigating', 'in_progress', 'fixed', 'retesting', 'closed', 'rejected', 'wont_fix'].includes(normalizedStatus)) {
          normalizedStatus = 'open';
        }

        const matchedCase = findExistingCase(iss);

        const { data: createdIssue } = await admin.from('issues').upsert(
          {
            project_id: project.id,
            issue_key: issKey,
            test_case_id: matchedCase?.id || iss.test_case_id || null,
            title: iss.title || 'Defect Report',
            description: iss.description || null,
            severity: iss.severity || 'major',
            priority: iss.priority || 'medium',
            status: normalizedStatus,
            root_cause: iss.root_cause || null,
            fix_description: iss.fix_description || null,
            related_commit: iss.related_commit || null,
            resolution: iss.resolution || (normalizedStatus === 'closed' ? 'Verified resolved' : null),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'project_id,issue_key' }
        ).select('id, status').single();

        if (createdIssue) {
          if (normalizedStatus === 'closed') {
            summary.resolved_issues++;
          } else {
            summary.created_issues++;
          }

          await admin.from('issue_history').insert({
            issue_id: createdIssue.id,
            old_status: null,
            new_status: normalizedStatus,
            comment: iss.description || 'Issue registered via agent sync',
          });
        }
      }
    }

    // 11. Handle delete_issues
    if (Array.isArray(deleteIssues) && deleteIssues.length > 0) {
      for (const issTarget of deleteIssues) {
        const found = await findExistingIssue(issTarget);
        if (found) {
          await admin.from('issue_history').delete().eq('issue_id', found.id);
          const { error: delErr } = await admin.from('issues').delete().eq('id', found.id);
          if (!delErr) summary.deleted_issues++;
        }
      }
    }

    // 12. Explicit resolved_issues array
    const resolvedKeysOrIds: string[] = Array.isArray(body.resolved_issues)
      ? body.resolved_issues
      : Array.isArray(body.resolve_issues)
      ? body.resolve_issues
      : [];

    if (resolvedKeysOrIds.length > 0) {
      for (const item of resolvedKeysOrIds) {
        const found = await findExistingIssue(item);
        if (found) {
          await admin.from('issues').update({
            status: 'closed',
            resolution: 'Marked resolved by AI Agent sync',
            updated_at: new Date().toISOString(),
          }).eq('id', found.id);
          summary.resolved_issues++;

          await admin.from('issue_history').insert({
            issue_id: found.id,
            old_status: found.status,
            new_status: 'closed',
            comment: 'Marked resolved by AI Agent sync',
          });
        }
      }
    }

    // 13. Add comments / notes to existing issues
    if (Array.isArray(rawComments) && rawComments.length > 0) {
      for (const c of rawComments) {
        const target = c.issue_key || c.key || c.issue_id || c.id;
        const found = await findExistingIssue(target);
        if (found && c.comment) {
          await admin.from('issue_history').insert({
            issue_id: found.id,
            old_status: found.status,
            new_status: found.status, // Must never be null
            comment: c.comment,
          });
        }
      }
    }

    // 14. Patch / update existing issues status or fields
    if (Array.isArray(updateIssues) && updateIssues.length > 0) {
      for (const upd of updateIssues) {
        const target = upd.issue_key || upd.key || upd.issue_id || upd.id;
        const found = await findExistingIssue(target);
        if (!found) continue;

        let newStatus = upd.status ? String(upd.status).toLowerCase().trim() : found.status;
        if (newStatus === 'resolved') newStatus = 'closed';

        const patch: any = { updated_at: new Date().toISOString() };
        if (upd.status) patch.status = newStatus;
        if (upd.severity) patch.severity = upd.severity;
        if (upd.priority) patch.priority = upd.priority;
        if (upd.fix_description) patch.fix_description = upd.fix_description;
        if (upd.root_cause) patch.root_cause = upd.root_cause;
        if (upd.resolution) patch.resolution = upd.resolution;
        if (newStatus === 'closed' && !patch.resolution) {
          patch.resolution = upd.fix_description || upd.comment || 'Resolved by AI Agent';
        }

        await admin.from('issues').update(patch).eq('id', found.id);

        if (upd.comment || (upd.status && newStatus !== found.status)) {
          await admin.from('issue_history').insert({
            issue_id: found.id,
            old_status: found.status,
            new_status: newStatus, // Must never be null
            comment: upd.comment || `Status updated to ${newStatus}`,
          });
        }
      }
    }

    // 15. Handle delete_suites
    if (Array.isArray(deleteSuites) && deleteSuites.length > 0) {
      for (const sTarget of deleteSuites) {
        if (!sTarget) continue;
        const sStr = (typeof sTarget === 'object' ? sTarget.name || sTarget.id : String(sTarget)).trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sStr);
        let q = admin.from('test_suites').select('id').eq('project_id', project.id);
        if (isUuid) q = q.eq('id', sStr);
        else q = q.ilike('name', sStr);
        const { data: matchedSuites } = await q;
        if (matchedSuites && matchedSuites.length > 0) {
          for (const s of matchedSuites) {
            await admin.from('test_cases').update({ suite_id: null }).eq('suite_id', s.id);
            await admin.from('test_suites').delete().eq('id', s.id);
          }
        }
      }
    }

    // 16. Process topLevelEvidence
    if (Array.isArray(topLevelEvidence) && topLevelEvidence.length > 0) {
      for (const ev of topLevelEvidence) {
        if (!ev) continue;
        let targetCaseId: string | null = null;
        if (ev.test_case_id || ev.target || ev.case || ev.key) {
          const matched = findExistingCase(ev);
          if (matched) targetCaseId = matched.id;
        }
        await admin.from('evidence').insert({
          project_id: project.id,
          test_case_id: targetCaseId,
          original_file_name: ev.file_name || ev.original_file_name || 'artifact.log',
          file_path: ev.file_path || `vault/${project.key}/${Date.now()}-${ev.file_name || 'artifact.log'}`,
          file_type: ev.file_type || 'text/plain',
          file_size: ev.file_size || ev.size || 1024,
          description: ev.description || 'Top-level verification evidence attached by AI agent',
        });
        summary.attached_evidence++;
      }
    }

    // 17. Quality Sign-Offs
    const allSignoffs = [
      ...(singleSignoffParam ? [singleSignoffParam] : []),
      ...(Array.isArray(multiSignoffsParam) ? multiSignoffsParam : []),
      ...(Array.isArray(gatesParam) ? gatesParam : []),
    ];

    if (allSignoffs.length > 0) {
      for (const so of allSignoffs) {
        if (so && so.decision) {
          await admin.from('report_signoffs').insert({
            project_id: project.id,
            role: so.role || so.gate_name || 'Automated AI QA Sign-Off',
            decision: so.decision,
            notes: so.notes || 'Automated quality sign-off recorded by AI Agent sync',
          });
          summary.recorded_signoffs++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      project: { id: project.id, key: project.key, name: project.name },
      summary,
    });
  } catch (err: any) {
    console.error('Agent sync error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
