#!/usr/bin/env node

/**
 * Test Manager — Official Model Context Protocol (MCP) Server
 * Allows Cursor, Claude, Antigravity, and other AI agents to interact with
 * Test Manager using native, type-safe tools over standard stdio JSON-RPC.
 */

import readline from 'readline';

const API_BASE = process.env.TEST_MANAGER_API_URL || 'https://testmanger.vercel.app';
const DEFAULT_PROJECT_KEY = process.env.TEST_MANAGER_PROJECT_KEY || 'MORPH';

const TOOLS = [
  {
    name: 'tm_get_project_tree',
    description: 'Inspect the full Test Manager project tree: all test suites, test cases with 1-based index numbers, latest execution runs, open defects, and environments.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: {
          type: 'string',
          description: 'The project key (e.g. MORPH, AUTH, CORE). Defaults to environment or active project.',
        },
      },
    },
  },
  {
    name: 'tm_create_or_update_test',
    description: 'Create a new test case or modify an existing test case in Test Manager. Can target by 1-based index (e.g. 1 for first test) or test key.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Project key (e.g. MORPH)' },
        target: { type: 'string', description: 'Target existing test: "first", "last", a number string like "1", or a test key like "MORPH-001". Leave empty if creating new.' },
        suite: { type: 'string', description: 'Name of the test suite (created automatically if it does not exist).' },
        key: { type: 'string', description: 'Custom test key (e.g. MORPH-AUTH-001). Auto-generated if omitted.' },
        title: { type: 'string', description: 'Clear, descriptive title of the test case.' },
        description: { type: 'string', description: 'Detailed specification of what this test verifies.' },
        type: {
          type: 'string',
          enum: ['functional', 'integration', 'regression', 'smoke', 'performance', 'security', 'recovery', 'automated'],
          description: 'Category of the test case.',
        },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        severity: { type: 'string', enum: ['trivial', 'minor', 'major', 'critical', 'blocker'] },
        preconditions: { type: 'string', description: 'Setup or prerequisites required before execution.' },
        expected_result: { type: 'string', description: 'Expected overall successful outcome.' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string', description: 'Action performed in this step' },
              expected: { type: 'string', description: 'Expected outcome for this step' },
            },
            required: ['action'],
          },
          description: 'Ordered sequence of execution steps.',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'tm_record_test_run',
    description: 'Record an execution run for a test case (pass, fail, blocked, or skipped) with duration, actual results, and git metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Project key' },
        target: { type: 'string', description: 'Target test: 1-based index (e.g. "1"), "first", or test key (e.g. "MORPH-001")' },
        status: { type: 'string', enum: ['pass', 'fail', 'blocked', 'skipped'], description: 'Outcome of test execution.' },
        duration_ms: { type: 'number', description: 'Execution time in milliseconds.' },
        actual_result: { type: 'string', description: 'Actual observed behavior or error message.' },
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
    name: 'tm_verify_retest',
    description: 'Perform a verification retest for an existing defect. If the retest passes, the defect is automatically marked as fixed and resolved.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Project key' },
        issue_key: { type: 'string', description: 'Defect key (e.g. MORPH-BUG-1) or issue ID.' },
        status: { type: 'string', enum: ['pass', 'fail'], description: 'Verification test result.' },
        actual_result: { type: 'string', description: 'Verification log or evidence description.' },
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Test Manager API error (${res.status}): ${errorText}`);
  }
  return await res.json();
}

async function getProjectTree(projectKey) {
  const pKey = projectKey || DEFAULT_PROJECT_KEY;
  const url = `${API_BASE}/api/projects/${pKey}/agent-sync`;
  const res = await fetch(url);
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
      const data = await getProjectTree(projectKey);
      const testSummary = (data.test_cases || []).map((tc) => ({
        index: tc.index,
        key: tc.key,
        title: tc.title,
        suite: tc.suite?.name || 'Unassigned',
        priority: tc.priority,
        severity: tc.severity,
        latest_run: tc.runs?.[0]?.status || 'untested',
      }));

      return {
        project: data.project,
        total_test_cases: (data.test_cases || []).length,
        total_suites: (data.suites || []).length,
        open_issues: (data.issues || []).filter((i) => i.status !== 'closed' && i.status !== 'resolved').length,
        test_cases_overview: testSummary,
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

      const payload = {
        runs: [runItem],
      };

      if (args.create_defect && args.status === 'fail') {
        payload.tests = [
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
        ];
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
          version: '1.0.0',
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
