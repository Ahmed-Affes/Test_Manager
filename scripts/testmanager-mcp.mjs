#!/usr/bin/env node

/**
 * Test Manager — Official Model Context Protocol (MCP) Server v2.0
 * Allows Cursor, Claude, Antigravity, and other AI agents to interact with
 * Test Manager using native, type-safe tools over standard stdio JSON-RPC.
 *
 * New in v2.0:
 *  - API key authentication (AGENT_API_KEY env var)
 *  - tm_delete_test: delete outdated test cases
 *  - tm_add_comment: add notes/comments to bug reports
 *  - tm_get_issue: fetch a single bug by key
 *  - tm_update_issue_status: patch status, severity, priority on an issue
 *  - tm_list_environments: list all tracked test environments
 *  - tm_get_coverage: get pass/fail/untested coverage metrics
 *  - Filtering support on tm_get_project_tree (suite, status, priority, run_status)
 */

import readline from 'readline';

const API_BASE = process.env.TEST_MANAGER_API_URL || 'https://testmanger.vercel.app';
const DEFAULT_PROJECT_KEY = process.env.TEST_MANAGER_PROJECT_KEY || 'MORPH';
const AGENT_API_KEY = process.env.AGENT_API_KEY || null;

/** Build request headers including optional auth key */
function buildHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (AGENT_API_KEY) headers['X-Agent-Key'] = AGENT_API_KEY;
  return headers;
}

const TOOLS = [
  {
    name: 'tm_get_project_tree',
    description: 'Inspect the full Test Manager project tree: all test suites, test cases with 1-based index numbers, coverage metrics, open defects, and environments. Supports optional filters.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: {
          type: 'string',
          description: 'The project key (e.g. MORPH). Defaults to environment or active project.',
        },
        filter_suite: {
          type: 'string',
          description: 'Filter test cases to a specific suite name.',
        },
        filter_status: {
          type: 'string',
          enum: ['active', 'draft', 'deprecated'],
          description: 'Filter test cases by their status.',
        },
        filter_priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Filter test cases by priority.',
        },
        filter_run_status: {
          type: 'string',
          enum: ['pass', 'fail', 'blocked', 'untested'],
          description: 'Filter test cases by the status of their latest run.',
        },
        include_coverage: {
          type: 'boolean',
          description: 'When true, includes full run history in the response. Default false (coverage metrics always included).',
        },
      },
    },
  },
  {
    name: 'tm_get_coverage',
    description: 'Get a quick coverage summary for the project: pass rate, execution rate, fail count, open bugs — without returning all test case data.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Project key (e.g. MORPH)' },
      },
    },
  },
  {
    name: 'tm_create_or_update_test',
    description: 'Create a new test case or modify an existing test case in Test Manager. STRICT QA RULES: (1) NEVER create monolithic test cases; break features into granular single-scenario cases under the same suite. (2) Use SIMPLE, PLAIN ENGLISH for all titles, descriptions, and steps so anyone can easily read and understand without technical jargon overload.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Project key (e.g. MORPH)' },
        target: { type: 'string', description: 'Target existing test: "first", "last", a number string like "1", or a test key like "MORPH-001". Leave empty if creating new.' },
        suite: { type: 'string', description: 'Name of the test suite (feature/module group). Multiple granular test cases should share the same suite.' },
        key: { type: 'string', description: 'Custom test key (e.g. MORPH-AUTH-001). Auto-generated if omitted.' },
        title: { type: 'string', description: 'Clear title in plain, simple English (e.g. "Save folder snapshot with 3 files").' },
        description: { type: 'string', description: 'Simple explanation of what this test verifies in plain English.' },
        type: {
          type: 'string',
          enum: ['functional', 'integration', 'regression', 'smoke', 'performance', 'security', 'recovery', 'automated'],
          description: 'Category of the test case.',
        },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        severity: { type: 'string', enum: ['trivial', 'minor', 'major', 'critical', 'blocker'] },
        preconditions: { type: 'string', description: 'Setup or prerequisites required before execution in simple English.' },
        expected_result: { type: 'string', description: 'Expected outcome in simple, clear English.' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string', description: 'Action performed in this step (plain English)' },
              expected: { type: 'string', description: 'Expected outcome for this step (plain English)' },
            },
            required: ['action'],
          },
          description: 'Ordered sequence of execution steps in simple English.',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'tm_delete_test',
    description: 'Delete a test case from Test Manager by key, 1-based index, or title. Also cleans up associated steps, runs, and issues.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Project key (e.g. MORPH)' },
        target: { type: 'string', description: 'Test to delete: a 1-based index like "3", a key like "MORPH-003", or "first" / "last".' },
      },
      required: ['target'],
    },
  },
  {
    name: 'tm_record_test_run',
    description: 'Record an execution run for a test case. WHEN TO MARK PASS: (1) If the AI can independently test backend code, CLI, or API logic and verifies 100% success with zero errors, it SHOULD record status "pass". (2) For UI/UX styling, visual layout, or things hard to verify 100% automatically, leave as "untested" until confirmed by the human user. NEVER mark "pass" on assumptions without real execution.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Project key' },
        target: { type: 'string', description: 'Target test: 1-based index (e.g. "1"), "first", or test key (e.g. "MORPH-001")' },
        status: {
          type: 'string',
          enum: ['pass', 'fail', 'blocked', 'skipped'],
          description: 'Outcome of test execution. STRICT: Only "pass" if verified by real test execution or explicit user confirmation. Never assume pass!',
        },
        duration_ms: { type: 'number', description: 'Execution time in milliseconds.' },
        actual_result: { type: 'string', description: 'Actual observed behavior, assertion output, or error message.' },
        branch: { type: 'string', description: 'Git branch name (e.g. main)' },
        version: { type: 'string', description: 'Application build or version string' },
        commit_sha: { type: 'string', description: 'Git commit SHA' },
        create_defect: { type: 'boolean', description: 'If status is fail, automatically file an issue/defect.' },
        defect_title: { type: 'string', description: 'Title of the defect if creating one.' },
        defect_severity: { type: 'string', enum: ['minor', 'major', 'critical', 'blocker'] },
        defect_root_cause: { type: 'string', description: 'Technical analysis or root cause of the failure.' },
      },
      required: ['target', 'status'],
    },
  },
  {
    name: 'tm_file_defect',
    description: 'File a defect/bug in Test Manager linked to a test case or project component.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Project key' },
        target_test: { type: 'string', description: 'Optional key or index of the associated test case.' },
        title: { type: 'string', description: 'Brief summary of the defect.' },
        description: { type: 'string', description: 'Steps to reproduce and observed defect behavior.' },
        severity: { type: 'string', enum: ['minor', 'major', 'critical', 'blocker'], description: 'Impact severity.' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Fix urgency.' },
        root_cause: { type: 'string', description: 'Technical analysis of why the bug occurred.' },
        related_commit: { type: 'string', description: 'Commit hash where bug was introduced or identified.' },
      },
      required: ['title', 'severity'],
    },
  },
  {
    name: 'tm_get_issue',
    description: 'Fetch a single bug/defect by its issue key (e.g. MORPH-BUG-001). Returns full details including status, severity, root cause, and history.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Project key' },
        issue_key: { type: 'string', description: 'The issue key to look up (e.g. MORPH-BUG-001).' },
      },
      required: ['issue_key'],
    },
  },
  {
    name: 'tm_update_issue_status',
    description: 'Update the status, severity, priority, root cause, or resolution of an existing bug. Can also add a comment explaining the change.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Project key' },
        issue_key: { type: 'string', description: 'Issue key to update (e.g. MORPH-BUG-001).' },
        status: {
          type: 'string',
          enum: ['open', 'investigating', 'in_progress', 'fixed', 'retesting', 'closed', 'rejected', 'wont_fix'],
          description: 'New status for the issue.',
        },
        severity: { type: 'string', enum: ['minor', 'major', 'critical', 'blocker'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        fix_description: { type: 'string', description: 'Description of the applied fix.' },
        root_cause: { type: 'string', description: 'Updated root cause analysis.' },
        resolution: { type: 'string', description: 'Resolution notes.' },
        comment: { type: 'string', description: 'A comment or note to add to the issue history.' },
      },
      required: ['issue_key'],
    },
  },
  {
    name: 'tm_add_comment',
    description: 'Add a comment or investigation note to an existing bug/issue without changing its status.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Project key' },
        issue_key: { type: 'string', description: 'Issue key (e.g. MORPH-BUG-001).' },
        comment: { type: 'string', description: 'The comment text to add to the issue timeline.' },
      },
      required: ['issue_key', 'comment'],
    },
  },
  {
    name: 'tm_list_environments',
    description: 'List all test environments configured for the project (OS, CPU, RAM, runtime info).',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Project key' },
      },
    },
  },
  {
    name: 'tm_verify_retest',
    description: 'Perform a verification retest for an existing defect. If the retest passes, the defect is automatically marked as fixed and resolved. MANDATORY QA RULE: NEVER set status to "pass" unless you independently executed the retest commands and confirmed 0 errors, OR the user explicitly confirmed the fix works.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Project key' },
        issue_key: { type: 'string', description: 'Defect key (e.g. MORPH-BUG-1) or issue ID.' },
        status: {
          type: 'string',
          enum: ['pass', 'fail'],
          description: 'Verification test result. STRICT: Only "pass" if verified by real test execution or explicit user confirmation. Never assume pass!',
        },
        actual_result: { type: 'string', description: 'Verification log, assertion output, or evidence description.' },
        duration_ms: { type: 'number', description: 'Duration of retest in milliseconds.' },
      },
      required: ['issue_key', 'status'],
    },
  },
  {
    name: 'tm_create_signoff',
    description: 'Submit an official QA release sign-off or deployment gating decision.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Project key' },
        gate_name: { type: 'string', description: 'Name of the release gate (e.g. v1.0.0 Production Release Gate)' },
        decision: { type: 'string', enum: ['approved', 'rejected', 'conditionally_approved'] },
        notes: { type: 'string', description: 'Sign-off rationale, risk assessment, or test summary.' },
      },
      required: ['gate_name', 'decision'],
    },
  },
];

async function callAgentSyncApi(projectKey, payload) {
  const pKey = projectKey || DEFAULT_PROJECT_KEY;
  const url = `${API_BASE}/api/projects/${pKey}/agent-sync`;
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Test Manager API error (${res.status}): ${errorText}`);
  }
  return await res.json();
}

async function getProjectTree(projectKey, filters = {}) {
  const pKey = projectKey || DEFAULT_PROJECT_KEY;
  const qp = new URLSearchParams();
  if (filters.filter_suite) qp.set('suite', filters.filter_suite);
  if (filters.filter_status) qp.set('status', filters.filter_status);
  if (filters.filter_priority) qp.set('priority', filters.filter_priority);
  if (filters.filter_run_status) qp.set('run_status', filters.filter_run_status);
  if (filters.include_coverage) qp.set('include_coverage', 'true');

  const url = `${API_BASE}/api/projects/${pKey}/agent-sync${qp.toString() ? '?' + qp.toString() : ''}`;
  const res = await fetch(url, { headers: buildHeaders() });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Test Manager API error (${res.status}): ${errorText}`);
  }
  return await res.json();
}

async function handleToolCall(name, args) {
  const projectKey = args.projectKey || DEFAULT_PROJECT_KEY;

  switch (name) {
    case 'tm_get_project_tree': {
      const data = await getProjectTree(projectKey, {
        filter_suite: args.filter_suite,
        filter_status: args.filter_status,
        filter_priority: args.filter_priority,
        filter_run_status: args.filter_run_status,
        include_coverage: args.include_coverage,
      });

      const testSummary = (data.test_cases || []).map((tc) => ({
        index: tc.index,
        key: tc.key,
        title: tc.title,
        suite: tc.suite || 'Unassigned',
        priority: tc.priority,
        severity: tc.severity,
        latest_run_status: tc.latest_run_status || 'untested',
      }));

      return {
        project: data.project,
        coverage: data.coverage,
        total_test_cases: (data.test_cases || []).length,
        total_suites: (data.test_suites || []).length,
        open_issues: (data.issues || []).filter((i) => i.status !== 'closed' && i.status !== 'resolved').length,
        test_cases_overview: testSummary,
        issues_overview: (data.issues || []).map((i) => ({
          key: i.issue_key,
          title: i.title,
          status: i.status,
          severity: i.severity,
        })),
      };
    }

    case 'tm_get_coverage': {
      const data = await getProjectTree(projectKey);
      return {
        project: data.project?.key,
        coverage: data.coverage,
      };
    }

    case 'tm_create_or_update_test': {
      const testItem = { ...args };
      delete testItem.projectKey;

      const payload = {
        suite: args.suite,
        tests: [testItem],
      };

      const res = await callAgentSyncApi(projectKey, payload);
      return { success: true, summary: res.summary, result: res };
    }

    case 'tm_delete_test': {
      const payload = {
        delete_tests: [args.target],
      };
      const res = await callAgentSyncApi(projectKey, payload);
      return { success: true, summary: res.summary };
    }

    case 'tm_record_test_run': {
      const runItem = {
        target: args.target,
        status: args.status,
        duration_ms: args.duration_ms,
        actual_result: args.actual_result,
        branch: args.branch,
        version: args.version,
        commit_sha: args.commit_sha,
      };

      let payload;
      if (args.create_defect && args.status === 'fail') {
        payload = {
          tests: [
            {
              target: args.target,
              run: runItem,
              create_defect: true,
              defect: {
                title: args.defect_title || `Automated failure in ${args.target}`,
                severity: args.defect_severity || 'critical',
                root_cause: args.defect_root_cause || args.actual_result || null,
              },
            },
          ],
        };
      } else {
        payload = {
          runs: [runItem],
        };
      }

      const res = await callAgentSyncApi(projectKey, payload);
      return { success: true, summary: res.summary, result: res };
    }

    case 'tm_file_defect': {
      const payload = {
        issues: [
          {
            title: args.title,
            description: args.description || null,
            severity: args.severity || 'major',
            priority: args.priority || 'medium',
            root_cause: args.root_cause || null,
            related_commit: args.related_commit || null,
            test_target: args.target_test || null,
          },
        ],
      };

      const res = await callAgentSyncApi(projectKey, payload);
      return { success: true, summary: res.summary, result: res };
    }

    case 'tm_get_issue': {
      // Fetch the project tree and filter to the single issue
      const data = await getProjectTree(projectKey);
      const searchKey = String(args.issue_key).trim().toLowerCase();
      const numMatch = searchKey.match(/\d+$/);
      const targetNum = numMatch ? parseInt(numMatch[0], 10) : null;

      const found = (data.issues || []).find((i) => {
        if (!i) return false;
        if (i.id?.toLowerCase() === searchKey) return true;
        if (i.issue_key?.toLowerCase() === searchKey) return true;
        if (targetNum !== null) {
          const iNumMatch = i.issue_key?.match(/\d+$/);
          if (iNumMatch && parseInt(iNumMatch[0], 10) === targetNum) return true;
        }
        return false;
      });
      if (!found) {
        return { success: false, error: `Issue not found: ${args.issue_key}` };
      }
      return { success: true, issue: found };
    }

    case 'tm_update_issue_status': {
      const payload = {
        update_issues: [
          {
            issue_key: args.issue_key,
            status: args.status,
            severity: args.severity,
            priority: args.priority,
            fix_description: args.fix_description,
            root_cause: args.root_cause,
            resolution: args.resolution,
            comment: args.comment,
          },
        ],
      };
      const res = await callAgentSyncApi(projectKey, payload);
      return { success: true, summary: res.summary };
    }

    case 'tm_add_comment': {
      const payload = {
        comments: [
          {
            issue_key: args.issue_key,
            comment: args.comment,
          },
        ],
      };
      const res = await callAgentSyncApi(projectKey, payload);
      return { success: true, summary: res.summary };
    }

    case 'tm_list_environments': {
      const data = await getProjectTree(projectKey);
      return {
        project: data.project?.key,
        environments: data.environments || [],
        total: (data.environments || []).length,
      };
    }

    case 'tm_verify_retest': {
      const payload = {
        retests: [
          {
            issue_key: args.issue_key,
            status: args.status,
            actual_result: args.actual_result || 'Verified via autonomous AI agent retest',
            duration_ms: args.duration_ms || 100,
          },
        ],
      };

      const res = await callAgentSyncApi(projectKey, payload);
      return { success: true, summary: res.summary, result: res };
    }

    case 'tm_create_signoff': {
      const payload = {
        signoff: {
          gate_name: args.gate_name,
          decision: args.decision,
          notes: args.notes || 'Sign-off submitted via autonomous AI agent',
        },
      };

      const res = await callAgentSyncApi(projectKey, payload);
      return { success: true, summary: res.summary, result: res };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// JSON-RPC 2.0 stdio loop
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

function sendResponse(id, result, error = null) {
  const msg = {
    jsonrpc: '2.0',
    id,
    ...(error ? { error } : { result }),
  };
  process.stdout.write(JSON.stringify(msg) + '\n');
}

rl.on('line', async (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch (e) {
    return sendResponse(null, null, { code: -32700, message: 'Parse error' });
  }

  const { id, method, params } = req;

  try {
    if (method === 'initialize') {
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'testmanager-mcp',
          version: '2.0.0',
        },
      });
    } else if (method === 'notifications/initialized') {
      // client acknowledgement, no reply needed
    } else if (method === 'tools/list') {
      sendResponse(id, { tools: TOOLS });
    } else if (method === 'tools/call') {
      const { name, arguments: toolArgs } = params || {};
      const toolResult = await handleToolCall(name, toolArgs || {});
      sendResponse(id, {
        content: [
          {
            type: 'text',
            text: JSON.stringify(toolResult, null, 2),
          },
        ],
      });
    } else {
      sendResponse(id, null, { code: -32601, message: `Method not found: ${method}` });
    }
  } catch (err) {
    sendResponse(id, null, {
      code: -32000,
      message: err.message || 'Internal tool execution error',
    });
  }
});
