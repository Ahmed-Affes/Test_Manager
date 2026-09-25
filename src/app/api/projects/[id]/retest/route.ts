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

    // 2. Insert test run
    const { data: newRun, error: runErr } = await admin
      .from('test_runs')
      .insert({
        project_id: project.id,
        test_case_id,
        environment_id: environment_id || null,
        status,
        duration_ms,
        actual_result: actual_result || (status === 'pass' ? 'Retest passed verification successfully' : 'Retest failed'),
        notes: notes || `Retest execution`,
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

    // 3. Insert step results if provided
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

    // 4. If status is pass, mark issue(s) resolved
    let resolvedCount = 0;
    if (status === 'pass') {
      if (issue_id) {
        const { error: issueErr } = await admin
          .from('issues')
          .update({
            status: 'resolved',
            resolution: `Verified passed in Run #${newRun.run_number || 'Latest'}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', issue_id);

        if (!issueErr) resolvedCount++;
      } else if (test_case_id) {
        // Auto-resolve any open issues for this test case
        const { data: openBugs } = await admin
          .from('issues')
          .select('id')
          .eq('test_case_id', test_case_id)
          .in('status', ['open', 'in_progress']);

        if (openBugs && openBugs.length > 0) {
          for (const b of openBugs) {
            await admin
              .from('issues')
              .update({
                status: 'resolved',
                resolution: `Verified passed in Run #${newRun.run_number || 'Latest'}`,
                updated_at: new Date().toISOString(),
              })
              .eq('id', b.id);
            resolvedCount++;
          }
        }
      }
    }

    // 5. Record audit log
    await admin.from('audit_logs').insert({
      project_id: project.id,
      action: 'retest_verification',
      entity_type: 'test_run',
      entity_id: newRun.id,
      details: {
        test_case_id,
        issue_id: issue_id || null,
        status,
        run_number: newRun.run_number,
        resolved_issues_count: resolvedCount,
      },
    });

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
