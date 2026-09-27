'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
  Bot,
  Terminal,
  CheckCircle2,
  Copy,
  Check,
  FileCode,
  Sparkles,
  Play,
  AlertTriangle,
  ArrowRight,
  Upload,
  Zap,
  Globe,
  Settings,
  Layers,
  Code2,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { JunitImportModal } from '@/components/automated/JunitImportModal';

type ActiveTab = 'mcp' | 'prompts' | 'rules' | 'cicd' | 'tester';

export default function ImportAndAgentPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [projectKey, setProjectKey] = React.useState('MORPH');
  const [activeTab, setActiveTab] = React.useState<ActiveTab>('mcp');
  const [copiedSection, setCopiedSection] = React.useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);

  // Playground state
  const [pinging, setPinging] = React.useState(false);
  const [pingResult, setPingResult] = React.useState<any>(null);
  const [syncingSample, setSyncingSample] = React.useState(false);
  const [sampleSuccess, setSampleSuccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadProj() {
      if (!projectId) return;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
      const query = isUuid
        ? supabase.from('projects').select('key').eq('id', projectId)
        : supabase.from('projects').select('key').ilike('key', projectId);
      const { data } = await query.single();
      if (data?.key) setProjectKey(data.key);
    }
    loadProj();
  }, [projectId, supabase]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  // MCP JSON config for Cursor & Claude Desktop
  const mcpConfigJson = JSON.stringify(
    {
      mcpServers: {
        testmanager: {
          command: 'node',
          args: ['scripts/testmanager-mcp.mjs'],
          env: {
            TEST_MANAGER_API_URL: 'https://testmanger.vercel.app',
            TEST_MANAGER_PROJECT_KEY: projectKey,
          },
        },
      },
    },
    null,
    2
  );

  // Modular Prompt Presets
  const promptPresets = [
    {
      id: 'author_tests',
      title: '1. Author & Sync Tests for a New Feature',
      badge: 'Test Creation',
      description: 'Instruct the agent to analyze code or requirements, write structured test cases, and sync them to Test Manager.',
      prompt: `You are the QA engineer for project ${projectKey}.
I just created/updated the following feature:
[Describe your feature or paste code here]

TASKS:
1. Identify all edge cases, positive/negative paths, and recovery scenarios.
2. Push new test cases to Test Manager via POST https://testmanger.vercel.app/api/projects/${projectKey}/agent-sync with payload:
{
  "suite": "[Feature Name]",
  "tests": [
    {
      "key": "${projectKey}-[CODE]-001",
      "title": "[Clear test title]",
      "description": "[Detailed specification]",
      "type": "functional",
      "priority": "high",
      "severity": "major",
      "expected_result": "[Expected outcome]",
      "steps": [
        { "action": "Step 1", "expected": "Outcome 1" },
        { "action": "Step 2", "expected": "Outcome 2" }
      ]
    }
  ]
}`,
    },
    {
      id: 'run_and_report',
      title: '2. Execute Tests & Auto-File Bugs on Failure',
      badge: 'Test Run & Triage',
      description: 'Instruct the agent to run the test suite, report execution times, and automatically file defects for any failures.',
      prompt: `You are the autonomous QA Lead for project ${projectKey}.
Run our local test suite (e.g. npm test).
Capture stdout, execution duration in milliseconds, and pass/fail statuses.

Immediately report the results to Test Manager via POST https://testmanger.vercel.app/api/projects/${projectKey}/agent-sync:
{
  "runs": [
    {
      "target": "first",
      "status": "pass",
      "duration_ms": 120,
      "actual_result": "All assertions passed cleanly",
      "branch": "main"
    }
  ],
  "tests": [
    {
      "target": "2",
      "run": { "status": "fail", "duration_ms": 350, "actual_result": "Assertion failed: expected 200 got 500" },
      "create_defect": true,
      "defect": {
        "title": "Unhandled 500 server error during token refresh",
        "severity": "critical",
        "root_cause": "Null pointer in auth_middleware.ts line 42"
      }
    }
  ]
}`,
    },
    {
      id: 'retest_verification',
      title: '3. Verify Bug Fix & Auto-Close Defect',
      badge: 'Retest & Close',
      description: 'Instruct the agent to verify that a fixed bug no longer fails. Passing retests automatically close the issue.',
      prompt: `You are the QA verification agent for project ${projectKey}.
I have applied a fix for defect BUG-${projectKey}-001.

TASKS:
1. Re-run the reproduction test locally to verify the bug is eliminated.
2. Send verification retest to Test Manager via POST https://testmanger.vercel.app/api/projects/${projectKey}/retest:
{
  "issue_id": "BUG-${projectKey}-001",
  "status": "pass",
  "actual_result": "Verified fixed: Regression test passed with 0 errors.",
  "duration_ms": 95
}`,
    },
    {
      id: 'release_gate',
      title: '4. Milestone Release Sign-Off Gate',
      badge: 'Release Gating',
      description: 'Instruct the agent to review all test runs and submit an official Go / No-Go sign-off decision.',
      prompt: `Inspect project ${projectKey} test status via GET https://testmanger.vercel.app/api/projects/${projectKey}/agent-sync.
Verify that:
1. All critical tests have passing execution runs.
2. There are 0 open blocker or critical defects.

If criteria are met, submit release sign-off via POST https://testmanger.vercel.app/api/projects/${projectKey}/agent-sync:
{
  "signoff": {
    "gate_name": "Production Milestone Release",
    "decision": "approved",
    "notes": "All automated test suites verified. Zero open blocker defects."
  }
}`,
    },
  ];

  // Test Ping handler
  const handlePing = async () => {
    setPinging(true);
    setPingResult(null);
    try {
      const res = await fetch(`/api/projects/${projectKey}/agent-sync`);
      const data = await res.json();
      setPingResult({ status: res.status, data });
    } catch (err: any) {
      setPingResult({ error: err.message });
    } finally {
      setPinging(false);
    }
  };

  // Sample run trigger
  const handlePushSample = async () => {
    setSyncingSample(true);
    setSampleSuccess(null);
    try {
      const payload = {
        suite: 'Autonomous AI Verification Suite',
        tests: [
          {
            key: `${projectKey}-AI-001`,
            title: 'Verify Autonomous Agent API Handshake',
            expected_result: 'Handshake succeeds with 200 OK',
            type: 'automated',
            priority: 'high',
            severity: 'major',
            steps: [
              { action: 'Dispatch JSON payload to /agent-sync', expected: 'HTTP 200 status' },
              { action: 'Verify case creation', expected: 'Returned in project tree' },
            ],
            run: {
              status: 'pass',
              duration_ms: 45,
              actual_result: 'Handshake verified successfully via Agent Hub.',
              branch: 'main',
              version: 'v1.0.0',
            },
          },
        ],
      };

      const res = await fetch(`/api/projects/${projectKey}/agent-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());
      const resData = await res.json();
      setSampleSuccess(`Successfully synced: 1 test case created, 1 test run logged!`);
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncingSample(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Bot className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              AI Agent & CI/CD Integration Hub
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
              {projectKey}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Empower Cursor, Claude Code, Antigravity, and CI/CD pipelines to manage test suites, executions, and bug triage programmatically.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsImportModalOpen(true)}
            className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            Import JUnit XML
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('mcp')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'mcp'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Cpu className="h-3.5 w-3.5" />
          <span>MCP Tool Server</span>
          <span className="ml-1 px-1.5 py-0.2 rounded text-[9px] bg-white/20 uppercase font-bold">Pro</span>
        </button>

        <button
          onClick={() => setActiveTab('prompts')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'prompts'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Task-Specific Prompts</span>
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'rules'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Code2 className="h-3.5 w-3.5" />
          <span>IDE Rules (.cursorrules)</span>
        </button>

        <button
          onClick={() => setActiveTab('cicd')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'cicd'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Terminal className="h-3.5 w-3.5" />
          <span>CI/CD & Scripts</span>
        </button>

        <button
          onClick={() => setActiveTab('tester')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'tester'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          <span>Live API Playground</span>
        </button>
      </div>

      {/* TAB 1: MCP Server */}
      {activeTab === 'mcp' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-start gap-3 text-xs text-blue-300">
            <Cpu className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-200">The Modern Way: Native MCP Tool Calling</p>
              <p className="text-zinc-400 mt-0.5 leading-relaxed">
                Instead of copy-pasting brittle text prompts, connect your coding agent (Cursor, Claude Desktop, Antigravity, Windsurf) to the Test Manager MCP server. The agent gets native, type-safe tools to query tests, log executions, and auto-file defects directly.
              </p>
            </div>
          </div>

          {/* Config Snippet */}
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
            <CardHeader className="pb-3 border-b border-zinc-200 dark:border-zinc-800/80 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">1. Add to your MCP Settings</CardTitle>
                <CardDescription className="text-xs">
                  Place in <code className="font-mono text-zinc-300">.cursor/mcp.json</code> or <code className="font-mono text-zinc-300">claude_desktop_config.json</code>
                </CardDescription>
              </div>
              <Button
                size="xs"
                variant="outline"
                onClick={() => copyToClipboard(mcpConfigJson, 'mcp_config')}
                className="gap-1.5"
              >
                {copiedSection === 'mcp_config' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedSection === 'mcp_config' ? 'Copied' : 'Copy JSON'}
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 overflow-x-auto">
                {mcpConfigJson}
              </pre>
            </CardContent>
          </Card>

          {/* Tools Reference Table */}
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
            <CardHeader className="pb-3 border-b border-zinc-200 dark:border-zinc-800/80">
              <CardTitle className="text-sm font-semibold">2. Exposed MCP Native Tools</CardTitle>
              <CardDescription className="text-xs">
                Your AI agent automatically invokes these tools during code editing, test runs, and bug fixes:
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/60">
                  <div className="flex items-center gap-2 font-bold text-blue-400">
                    <Terminal className="h-3.5 w-3.5" />
                    <span>tm_get_project_tree</span>
                  </div>
                  <p className="font-sans text-[11px] text-zinc-400 mt-1">
                    Fetches all suites, test cases with 1-based index numbers, latest execution run results, and active defects.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/60">
                  <div className="flex items-center gap-2 font-bold text-purple-400">
                    <Terminal className="h-3.5 w-3.5" />
                    <span>tm_create_or_update_test</span>
                  </div>
                  <p className="font-sans text-[11px] text-zinc-400 mt-1">
                    Creates new test cases or updates existing ones with steps, expected results, priority, and severity.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/60">
                  <div className="flex items-center gap-2 font-bold text-emerald-400">
                    <Terminal className="h-3.5 w-3.5" />
                    <span>tm_record_test_run</span>
                  </div>
                  <p className="font-sans text-[11px] text-zinc-400 mt-1">
                    Logs execution outcomes (pass, fail, blocked) with millisecond duration, logs, and optional auto-defect filing on failure.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/60">
                  <div className="flex items-center gap-2 font-bold text-rose-400">
                    <Terminal className="h-3.5 w-3.5" />
                    <span>tm_file_defect</span>
                  </div>
                  <p className="font-sans text-[11px] text-zinc-400 mt-1">
                    Files a bug ticket linked to a test case with severity, root cause analysis, and commit reference.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/60">
                  <div className="flex items-center gap-2 font-bold text-amber-400">
                    <Terminal className="h-3.5 w-3.5" />
                    <span>tm_verify_retest</span>
                  </div>
                  <p className="font-sans text-[11px] text-zinc-400 mt-1">
                    Executes verification on a defect. When passing, automatically transitions the bug to resolved.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: Modular Task Prompts */}
      {activeTab === 'prompts' && (
        <div className="space-y-6">
          <p className="text-xs text-zinc-400">
            Use these targeted, task-specific prompts whenever you need your AI agent to perform a specific QA action without confusion:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {promptPresets.map((preset) => (
              <Card key={preset.id} className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 flex flex-col justify-between">
                <CardHeader className="pb-3 border-b border-zinc-200 dark:border-zinc-800/80">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {preset.badge}
                    </span>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => copyToClipboard(preset.prompt, preset.id)}
                      className="gap-1.5"
                    >
                      {copiedSection === preset.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      {copiedSection === preset.id ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <CardTitle className="text-sm font-semibold text-zinc-100 mt-2">
                    {preset.title}
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-400">
                    {preset.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-3">
                  <pre className="p-2.5 rounded bg-zinc-950 border border-zinc-800/80 text-[10px] font-mono text-zinc-400 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {preset.prompt}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: IDE Rules (.cursorrules & AGENTS.md) */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 text-xs text-purple-300">
            <p className="font-semibold text-purple-200">Zero-Prompt Autonomous Maintenance</p>
            <p className="text-zinc-400 mt-0.5 leading-relaxed">
              Place these rule files in your code repository. Coding agents like Cursor, Windsurf, and Claude Code read them automatically upon opening your project. They will document tests and log results without you needing to prompt them manually.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* .cursorrules */}
            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
              <CardHeader className="pb-3 border-b border-zinc-200 dark:border-zinc-800/80 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">.cursorrules</CardTitle>
                  <CardDescription className="text-xs">Save as <code className="font-mono text-zinc-300">.cursorrules</code> in repo root</CardDescription>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    copyToClipboard(
                      `# Cursor AI Rules — Test Manager Integration\nYou are connected to Test Manager for project ${projectKey}.\nAlways record test execution runs via MCP or POST to https://testmanger.vercel.app/api/projects/${projectKey}/agent-sync.`,
                      'cursorrules'
                    )
                  }
                  className="gap-1.5"
                >
                  {copiedSection === 'cursorrules' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copiedSection === 'cursorrules' ? 'Copied' : 'Copy'}
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-400 overflow-x-auto">
{`# Cursor AI Rules — Test Manager Integration
You are connected to Test Manager for project ${projectKey}.
Whenever you build features or fix bugs:
1. Inspect existing tests with tm_get_project_tree.
2. Record execution results with tm_record_test_run.
3. Automatically file defects on failed assertions.`}
                </pre>
              </CardContent>
            </Card>

            {/* AGENTS.md */}
            <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
              <CardHeader className="pb-3 border-b border-zinc-200 dark:border-zinc-800/80 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">AGENTS.md</CardTitle>
                  <CardDescription className="text-xs">Save as <code className="font-mono text-zinc-300">AGENTS.md</code> in repo root</CardDescription>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    copyToClipboard(
                      `# Test Manager Protocol\nEndpoint: https://testmanger.vercel.app/api/projects/${projectKey}/agent-sync\nRun scripts/testmanager-mcp.mjs for native MCP tooling.`,
                      'agentsmd'
                    )
                  }
                  className="gap-1.5"
                >
                  {copiedSection === 'agentsmd' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copiedSection === 'agentsmd' ? 'Copied' : 'Copy'}
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-400 overflow-x-auto">
{`# Test Manager AI Protocol
Project Key: ${projectKey}
API Endpoint: https://testmanger.vercel.app/api/projects/${projectKey}/agent-sync

Modes:
- Preferred: Use MCP tools (scripts/testmanager-mcp.mjs)
- Fallback: POST JSON payloads to API endpoint.`}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 4: CI/CD & Scripts */}
      {activeTab === 'cicd' && (
        <div className="space-y-6">
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
            <CardHeader className="pb-3 border-b border-zinc-200 dark:border-zinc-800/80">
              <CardTitle className="text-sm font-semibold">GitHub Actions CI Pipeline</CardTitle>
              <CardDescription className="text-xs">
                Automatically push test run outcomes to Test Manager on every push or pull request:
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 overflow-x-auto">
{`name: Test & Sync
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test -- --reporter=junit --outputFile=results.xml
      - name: Push to Test Manager
        if: always()
        run: |
          curl -X POST "https://testmanger.vercel.app/api/projects/${projectKey}/import-junit" \\
            -H "Content-Type: text/xml" \\
            --data-binary @results.xml`}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 5: Live API Playground */}
      {activeTab === 'tester' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePing}
              isLoading={pinging}
              className="gap-1.5 border-zinc-700 text-zinc-200"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Ping Project Tree (GET)
            </Button>

            <Button
              size="sm"
              variant="primary"
              onClick={handlePushSample}
              isLoading={syncingSample}
              className="gap-1.5"
            >
              <Play className="h-3.5 w-3.5" />
              Push Sample AI Test Run (POST)
            </Button>
          </div>

          {sampleSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{sampleSuccess}</span>
            </div>
          )}

          {pingResult && (
            <Card className="border-zinc-200 dark:border-zinc-800 bg-zinc-950">
              <CardHeader className="pb-2 border-b border-zinc-800">
                <CardTitle className="text-xs font-mono text-zinc-400 flex items-center justify-between">
                  <span>GET /api/projects/{projectKey}/agent-sync</span>
                  <span className="text-emerald-400 font-bold">Status: {pingResult.status || 200}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <pre className="text-[11px] font-mono text-zinc-300 max-h-96 overflow-y-auto">
                  {JSON.stringify(pingResult.data, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* JUnit Import Modal */}
      <JunitImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        projectId={projectId}
      />
    </div>
  );
}
