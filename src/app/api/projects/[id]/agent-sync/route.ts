import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
      tests = [],
      issues: standaloneIssues = [],
      defects = [],
      crashes = [],
      evidence: topLevelEvidence = [],
      signoff: singleSignoffParam,
      signoffs: multiSignoffsParam,
      gates: gatesParam,
    } = body;

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
      created_runs: 0,
      created_issues: 0,
      resolved_issues: 0,
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

    // 2. Pre-process top-level suites if provided
    let defaultSuiteId: string | null = null;
    if (singleSuiteParam) {
      defaultSuiteId = await resolveOrCreateSuite(singleSuiteParam);
    }
    if (Array.isArray(multiSuitesParam)) {
      for (const s of multiSuitesParam) {
        const sid = await resolveOrCreateSuite(s);
        if (!defaultSuiteId) defaultSuiteId = sid;
      }
    }

    // 3. Pre-process top-level environments if provided
    let defaultEnvId: string | null = null;
    if (singleEnvParam) {
      defaultEnvId = await resolveOrCreateEnvironment(singleEnvParam);
    }
    if (Array.isArray(multiEnvsParam)) {
      for (const e of multiEnvsParam) {
        const eid = await resolveOrCreateEnvironment(e);
        if (!defaultEnvId) defaultEnvId = eid;
      }
    }

    // 4. Pre-process top-level plans / milestones if provided
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

    // 5. Count existing cases in project to generate auto-keys if none given
    const { count: existingCaseCount } = await admin
      .from('test_cases')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project.id);

    let nextCaseIndex = (existingCaseCount || 0) + 1;

    // 6. Process Test Cases, Step Definitions, Runs, Step Results, and Defect linkages
    if (Array.isArray(tests) && tests.length > 0) {
      for (let i = 0; i < tests.length; i++) {
        const item = tests[i];
        const testTitle = item.title || `Test Case ${nextCaseIndex}`;
        const testKey = item.key || `${project.key}-${String(nextCaseIndex).padStart(3, '0')}`;
        nextCaseIndex++;

        // Determine suite for this case
        const caseSuiteId = item.suite ? await resolveOrCreateSuite(item.suite) : defaultSuiteId;
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

        const expectedOverall =
          item.expected_result || item.steps?.[0]?.expected || 'Expected behavior verified without crash or corruption';

        let caseId: string | null = null;
        const { data: existingCase } = await admin
          .from('test_cases')
          .select('id')
          .eq('project_id', project.id)
          .eq('key', testKey)
          .maybeSingle();

        if (existingCase) {
          caseId = existingCase.id;
          summary.updated_cases++;

          await admin
            .from('test_cases')
            .update({
              suite_id: caseSuiteId ?? null,
              title: testTitle,
              description: item.description || null,
              priority: item.priority || 'medium',
              severity: item.severity || 'major',
              type: item.type || 'automated',
              preconditions: item.preconditions || null,
              test_data: item.test_data || null,
              expected_result: expectedOverall,
              status: item.status || 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('id', caseId);
        } else {
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

          // Insert steps
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

          // Execution Run Recording
          if (item.run) {
            const runStatus = item.run.status || 'pass';
            const { data: testRun, error: runErr } = await admin
              .from('test_runs')
              .insert({
                project_id: project.id,
                test_case_id: caseId,
                environment_id: caseEnvId,
                status: runStatus,
                duration_ms: item.run.duration_ms || 120,
                actual_result: item.run.actual_result || (runStatus === 'pass' ? 'Verification passed successfully' : 'Execution failed'),
                notes: item.run.notes || 'Executed autonomously via AI Agent test sync',
                application_version: item.run.version || item.run.application_version || 'v1.0.0-dev',
                branch: item.run.branch || 'main',
                commit_sha: item.run.commit_sha || null,
              })
              .select()
              .single();

            if (!runErr && testRun) {
              summary.created_runs++;

              // Record Step Results
              const stepResultsList = item.run.step_results || item.run.steps;
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

              // Run-level evidence (fsck traces, core dumps, logs)
              if (Array.isArray(item.run.evidence) && item.run.evidence.length > 0) {
                for (const ev of item.run.evidence) {
                  await admin.from('evidence').insert({
                    project_id: project.id,
                    test_case_id: caseId,
                    test_run_id: testRun.id,
                    original_file_name: ev.file_name || ev.original_file_name || 'execution_run.log',
                    file_path: ev.file_path || `vault/${project.key}/${Date.now()}-${ev.file_name || 'run.log'}`,
                    file_type: ev.file_type || 'text/plain',
                    file_size: ev.file_size || ev.size || 2048,
                    description: ev.description || 'Execution run telemetry attached by AI agent',
                  });
                  summary.attached_evidence++;
                }
              }

              // Auto-create defect on failure or crash
              if ((runStatus === 'fail' || runStatus === 'blocked') && item.create_defect === true) {
                const issueKey = `BUG-${project.key}-${String(summary.created_runs).padStart(3, '0')}`;
                const defect = item.defect || item.issue || {};
                const { data: createdIssue } = await admin.from('issues').insert({
                  project_id: project.id,
                  test_case_id: caseId,
                  test_run_id: testRun.id,
                  issue_key: issueKey,
                  title: defect.title || `[Crash / Regression] ${testTitle} failed`,
                  description:
                    defect.description ||
                    item.run.actual_result ||
                    'Automated execution failure or crash detected during AI agent verification.',
                  severity: defect.severity || item.severity || 'critical',
                  priority: defect.priority || item.priority || 'high',
                  status: defect.status || 'open',
                  root_cause: defect.root_cause || null,
                  fix_description: defect.fix_description || null,
                  related_commit: item.run.commit_sha || null,
                }).select('id').single();

                if (createdIssue) {
                  summary.created_issues++;
                  // Attach defect evidence if provided
                  if (Array.isArray(defect.evidence)) {
                    for (const ev of defect.evidence) {
                      await admin.from('evidence').insert({
                        project_id: project.id,
                        test_case_id: caseId,
                        test_run_id: testRun.id,
                        issue_id: createdIssue.id,
                        original_file_name: ev.file_name || 'crash_dump.dmp',
                        file_path: ev.file_path || `vault/crashes/${Date.now()}-${ev.file_name || 'dump.dmp'}`,
                        file_type: ev.file_type || 'application/octet-stream',
                        file_size: ev.file_size || 4096,
                        description: ev.description || 'Crash dump & memory trace',
                      });
                      summary.attached_evidence++;
                    }
                  }
                }
              }

              // Auto-resolve any open defects for this test case if the run passed
              if (runStatus === 'pass') {
                const { data: openBugs } = await admin
                  .from('issues')
                  .select('id, issue_key')
                  .eq('test_case_id', caseId)
                  .in('status', ['open', 'in_progress']);

                if (openBugs && openBugs.length > 0) {
                  for (const ob of openBugs) {
                    await admin
                      .from('issues')
                      .update({
                        status: 'resolved',
                        resolution: `Verified resolved: Test passed in Run #${testRun.run_number || 'Latest'} (${item.run.commit_sha || item.run.version || 'AI Fix'})`,
                        updated_at: new Date().toISOString(),
                      })
                      .eq('id', ob.id);
                    summary.resolved_issues = (summary.resolved_issues || 0) + 1;
                  }
                }
              }
            }
          }

          summary.details.push({ key: testKey, title: testTitle, case_id: caseId });
        }
      }
    }

    // 7. Process Standalone Issues / Defects / Crashes
    const allStandaloneIssues = [...standaloneIssues, ...defects, ...crashes];
    if (allStandaloneIssues.length > 0) {
      for (let idx = 0; idx < allStandaloneIssues.length; idx++) {
        const iss = allStandaloneIssues[idx];
        const issKey = iss.key || iss.issue_key || `BUG-${project.key}-${Date.now().toString().slice(-4)}${idx}`;
        const { data: createdIssue } = await admin.from('issues').upsert(
          {
            project_id: project.id,
            issue_key: issKey,
            title: iss.title || 'Standalone Defect / Crash Report',
            description: iss.description || null,
            severity: iss.severity || 'major',
            priority: iss.priority || 'medium',
            status: iss.status || 'open',
            root_cause: iss.root_cause || null,
            fix_description: iss.fix_description || null,
            related_commit: iss.related_commit || null,
            resolution: iss.resolution || null,
          },
          { onConflict: 'project_id,issue_key' }
        ).select('id').single();

        if (createdIssue) {
          summary.created_issues++;
          if (Array.isArray(iss.evidence)) {
            for (const ev of iss.evidence) {
              await admin.from('evidence').insert({
                project_id: project.id,
                issue_id: createdIssue.id,
                original_file_name: ev.file_name || 'defect_log.txt',
                file_path: ev.file_path || `vault/defects/${Date.now()}-${ev.file_name || 'log.txt'}`,
                file_type: ev.file_type || 'text/plain',
                file_size: ev.file_size || 1024,
                description: ev.description || 'Evidence attached to defect',
              });
              summary.attached_evidence++;
            }
          }
        }
      }
    }

    // 8. Process Top-level Evidence Vault items
    if (Array.isArray(topLevelEvidence) && topLevelEvidence.length > 0) {
      for (const ev of topLevelEvidence) {
        await admin.from('evidence').insert({
          project_id: project.id,
          original_file_name: ev.file_name || ev.original_file_name || 'vault_artifact.log',
          file_path: ev.file_path || `vault/global/${Date.now()}-${ev.file_name || 'artifact.log'}`,
          file_type: ev.file_type || 'text/plain',
          file_size: ev.file_size || 1024,
          description: ev.description || 'Direct evidence item uploaded by AI agent',
        });
        summary.attached_evidence++;
      }
    }

    // 9. Process Quality Sign-Offs
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
            decision: so.decision, // 'approved' | 'rejected' | 'conditional'
            notes: so.notes || 'Automated quality sign-off recorded by AI Agent sync',
          });
          summary.recorded_signoffs++;
        }
      }
    }

    // 10. Record project audit event
    await admin.from('audit_logs').insert({
      project_id: project.id,
      action: 'agent_sync',
      entity_type: 'project',
      entity_id: project.id,
      details: {
        created_suites: summary.created_suites,
        created_environments: summary.created_environments,
        created_plans: summary.created_plans,
        created_cases: summary.created_cases,
        updated_cases: summary.updated_cases,
        created_runs: summary.created_runs,
        created_issues: summary.created_issues,
        resolved_issues: summary.resolved_issues,
        attached_evidence: summary.attached_evidence,
        recorded_signoffs: summary.recorded_signoffs,
      },
    });

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
