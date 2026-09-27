import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      issue_id,
      test_case_id,
      status = 'pass',
      duration_ms = 100,
      actual_result,
      notes,
      environment_id,
      application_version,
      build_number,
      branch,
      commit_sha,
      step_results,
    } = body;

    const admin = createAdminClient();

    // 1. Resolve project by UUID or Key
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let projQuery = admin.from('projects').select('id, key');
    if (isUuid) {
      projQuery = projQuery.eq('id', id);
    } else {
      projQuery = projQuery.ilike('key', id);
    }
    const { data: project, error: projErr } = await projQuery.single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. Resolve test_case_id (can be UUID, key like 'PFE-001', or derived from issue_id)
    let resolvedCaseId = test_case_id || null;
    let targetIssue: any = null;

    if (issue_id) {
      const { data: foundIssue } = await admin
        .from('issues')
        .select('*')
        .eq('id', issue_id)
        .maybeSingle();
      targetIssue = foundIssue;
      if (!resolvedCaseId && targetIssue?.test_case_id) {
        resolvedCaseId = targetIssue.test_case_id;
      }
    }

    if (resolvedCaseId) {
      const isCaseUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedCaseId);
      if (!isCaseUuid) {
        const { data: foundCase } = await admin
          .from('test_cases')
          .select('id')
          .eq('project_id', project.id)
          .ilike('key', resolvedCaseId)
          .maybeSingle();
        if (foundCase) {
          resolvedCaseId = foundCase.id;
        }
      }
    }

    if (!resolvedCaseId) {
      return NextResponse.json({ error: 'Valid test_case_id is required for recording test runs' }, { status: 400 });
    }

    // 3. Insert test run
    const { data: newRun, error: runErr } = await admin
      .from('test_runs')
      .insert({
        project_id: project.id,
        test_case_id: resolvedCaseId,
        environment_id: environment_id || null,
        status,
        duration_ms,
        actual_result: actual_result || (status === 'pass' ? 'Retest passed verification successfully' : 'Retest failed'),
        notes: notes || `Retest verification execution`,
        application_version: application_version || null,
        build_number: build_number || null,
        branch: branch || null,
        commit_sha: commit_sha || null,
      })
      .select()
      .single();

    if (runErr || !newRun) {
      console.error('Retest run error:', runErr);
      return NextResponse.json({ error: runErr?.message || 'Failed to record retest run' }, { status: 500 });
    }

    // 4. Insert step results if provided
    if (Array.isArray(step_results) && step_results.length > 0) {
      const stepInserts = step_results.map((sr: any, idx: number) => ({
        test_run_id: newRun.id,
        step_id: sr.step_id || null,
        step_number: sr.step_number || idx + 1,
        status: sr.status || 'pass',
        actual_result: sr.actual_result || null,
        notes: sr.notes || null,
      }));
      await admin.from('test_step_results').insert(stepInserts);
    }

    // 5. If status is pass, mark issue(s) closed (satisfying PostgreSQL check constraint!)
    let resolvedCount = 0;
    const runResolution = actual_result || `Verified passed in Run #${newRun.run_number || 'Latest'}`;

    if (status === 'pass') {
      const issueIdsToClose = new Set<string>();
      if (issue_id) {
        issueIdsToClose.add(issue_id);
      }

      // Also auto-resolve any active issues for this test case
      if (resolvedCaseId) {
        const { data: openBugs, error: bugsFetchErr } = await admin
          .from('issues')
          .select('id, status')
          .eq('test_case_id', resolvedCaseId)
          .in('status', ['open', 'investigating', 'in_progress', 'retesting', 'fixed']);

        if (bugsFetchErr) {
          console.error('Error fetching open bugs for case:', bugsFetchErr);
        }

        if (openBugs && openBugs.length > 0) {
          for (const b of openBugs) {
            issueIdsToClose.add(b.id);
          }
        }
      }

      for (const targetId of issueIdsToClose) {
        const { data: prevIssue } = await admin
          .from('issues')
          .select('status')
          .eq('id', targetId)
          .maybeSingle();

        const { error: issueErr } = await admin
          .from('issues')
          .update({
            status: 'closed', // 'closed' is valid in check constraint (open, investigating, in_progress, fixed, retesting, closed, rejected, wont_fix)
            resolution: runResolution,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetId);

        if (!issueErr) {
          resolvedCount++;
          // Record issue history entry
          await admin.from('issue_history').insert({
            issue_id: targetId,
            old_status: prevIssue?.status || 'open',
            new_status: 'closed',
            comment: runResolution,
          });
        } else {
          console.error('Error closing issue in retest:', targetId, issueErr);
        }
      }
    } else if (status === 'fail' || status === 'blocked') {
      // If retest failed or test execution failed, ensure defect exists and is open
      if (issue_id) {
        await admin
          .from('issues')
          .update({
            status: 'in_progress',
            test_run_id: newRun.id,
            resolution: `Retest verification failed in Run #${newRun.run_number || 'Latest'}: ${actual_result || 'Discrepancy observed'}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', issue_id);

        await admin.from('issue_history').insert({
          issue_id,
          old_status: targetIssue?.status || 'open',
          new_status: 'in_progress',
          comment: `Retest failed in Run #${newRun.run_number || 'Latest'}: ${actual_result || 'Still failing'}`,
        });
      } else if (resolvedCaseId) {
        // Check if there is an active defect for this test case
        const { data: existingActive } = await admin
          .from('issues')
          .select('id, issue_key, status')
          .eq('test_case_id', resolvedCaseId)
          .in('status', ['open', 'investigating', 'in_progress', 'retesting', 'fixed'])
          .maybeSingle();

        if (existingActive) {
          await admin
            .from('issues')
            .update({
              status: 'in_progress',
              test_run_id: newRun.id,
              resolution: `Test execution failed in Run #${newRun.run_number || 'Latest'}: ${actual_result || 'Discrepancy observed'}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingActive.id);

          await admin.from('issue_history').insert({
            issue_id: existingActive.id,
            old_status: existingActive.status,
            new_status: 'in_progress',
            comment: `Execution failure in Run #${newRun.run_number || 'Latest'}: ${actual_result || 'Failure observed'}`,
          });
        } else {
          // AUTO-CREATE DEFECT SO IT IMMEDIATELY APPEARS IN BUGS & ISSUES!
          const { data: tc } = await admin
            .from('test_cases')
            .select('key, title, severity, priority, description')
            .eq('id', resolvedCaseId)
            .maybeSingle();

          const { count } = await admin
            .from('issues')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', project.id);

          const nextNum = (count || 0) + 1;
          const issueKey = `BUG-${project.key}-${String(nextNum).padStart(3, '0')}`;

          const { data: newDefect, error: defErr } = await admin
            .from('issues')
            .insert({
              project_id: project.id,
              test_case_id: resolvedCaseId,
              test_run_id: newRun.id,
              issue_key: issueKey,
              title: tc?.title ? `[Defect] ${tc.title} verification failed` : `[Defect] Execution failure in ${project.key}`,
              description: actual_result || notes || `Execution run #${newRun.run_number || 'Latest'} failed.`,
              severity: tc?.severity || 'major',
              priority: tc?.priority || 'high',
              status: 'open',
              root_cause: notes || actual_result || 'Observed failure during test execution',
            })
            .select()
            .single();

          if (newDefect) {
            await admin.from('issue_history').insert({
              issue_id: newDefect.id,
              old_status: null,
              new_status: 'open',
              comment: `Defect auto-created from failing Run #${newRun.run_number || 'Latest'}: ${actual_result || 'Execution failed'}`,
            });
          } else if (defErr) {
            console.error('Failed to auto-create defect on test failure:', defErr);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      run: newRun,
      resolved_issues_count: resolvedCount,
    });
  } catch (err: any) {
    console.error('Retest API error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
