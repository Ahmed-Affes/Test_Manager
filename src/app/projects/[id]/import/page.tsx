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
  Hand,
  Globe,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { JunitImportModal } from '@/components/automated/JunitImportModal';

export default function ImportAndAgentPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [projectKey, setProjectKey] = React.useState('MORPH');
  const [copiedSection, setCopiedSection] = React.useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
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

  const agentPrompt = `You are the fully autonomous Coding, QA & Test Management AI Agent for the ${projectKey} project.

CORE RULE:
==========
The user does NOT do anything manually on the Test Manager website. No manual forms, no clicking 'Run', no typing bug reports. 
You are 100% in charge of managing test suites, test cases, execution runs, bug filing, evidence uploading, and verification re-tests autonomously via the API.

The user will only open the Test Manager website to observe your progress, history, and live quality dashboard.

HOW TO SYNC TO TEST MANAGER
===========================
Send a POST request to this endpoint after every test execution or verification:

  POST https://testmangerapp.vercel.app/api/projects/${projectKey}/agent-sync
  Content-Type: application/json

WHAT TO INCLUDE
===============
You can include any combination of these fields:

- suite: A logical group name for the feature (e.g. "Login Feature", "File Upload", "Search Engine")  
- tests: An array of test cases you ran, each with:
    - key: unique identifier like "${projectKey}-001"
    - title: what the test checks
    - expected_result: what should happen
    - steps: the actions you took (optional but helpful)
    - run.status: "pass", "fail", "blocked", or "skipped"
    - run.actual_result: what actually happened
    - run.duration_ms: how long it took
    - run.branch / run.version: optional, for tracking which build
    - run.evidence: attach crash logs or screenshots by filename

WHEN A TEST FAILS
=================
If a test fails, add create_defect: true and a defect object to automatically file a bug:

  "run": { "status": "fail", ... },
  "create_defect": true,
  "defect": {
    "title": "Short description of the bug",
    "description": "What went wrong and how to reproduce it",
    "severity": "critical"  // blocker, critical, major, minor, trivial
  }

WHEN YOU FIX A BUG (RE-TESTING & AUTO-RESOLVE)
==============================================
1. Modify the code to apply your fix.
2. Re-run the test to verify the fix works.
3. Send a new sync with the SAME test key and "status": "pass":
   {
     "tests": [{
       "key": "${projectKey}-011",
       "run": {
         "status": "pass",
         "duration_ms": 75,
         "actual_result": "Verified fixed: large file uploads now cleanly return HTTP 413"
       }
     }]
   }

Test Manager automatically:
- Records Run #2 as Passed
- Updates the Test Case status to GREEN (Pass)
- Automatically marks the linked defect as "Resolved"
- Preserves the full history: Run #1 (Failure + crash log) and Run #2 (Fix verification)

MINIMAL EXAMPLE (single passing test)
======================================
{
  "suite": "Feature Name",
  "tests": [{
    "key": "${projectKey}-001",
    "title": "User can log in with valid credentials",
    "expected_result": "User is redirected to dashboard",
    "run": {
      "status": "pass",
      "duration_ms": 320,
      "actual_result": "User was redirected to /dashboard successfully"
    }
  }]
}

STARTING CLEAN / RESETTING DATA
===============================
If the user asks you to start fresh, clean the project, or wipe old test runs, simply add "reset": true to your payload:
{
  "reset": true,
  "suite": "Clean Verification Suite",
  "tests": [...]
}

FULL EXAMPLE (test suite with a failure and auto-bug)
======================================================
{
  "suite": "File Upload Feature",
  "suite_description": "Tests for uploading, validating, and storing files",
  "environment": {
    "name": "Ubuntu 22.04 LTS",
    "os": "Ubuntu 22.04",
    "runtime": "Node.js 20"
  },
  "tests": [
    {
      "key": "${projectKey}-010",
      "title": "Upload a valid PNG file",
      "expected_result": "File saved and URL returned",
      "steps": [
        { "action": "POST /api/upload with valid PNG", "expected": "HTTP 200 with file URL" }
      ],
      "run": {
        "status": "pass",
        "duration_ms": 150,
        "actual_result": "File uploaded, URL https://cdn.example.com/img.png returned"
      }
    },
    {
      "key": "${projectKey}-011",
      "title": "Upload a file larger than 10MB is rejected",
      "expected_result": "HTTP 413 Payload Too Large",
      "run": {
        "status": "fail",
        "duration_ms": 80,
        "actual_result": "Server returned HTTP 500 instead of 413"
      },
      "create_defect": true,
      "defect": {
        "title": "Large file upload crashes server instead of returning 413",
        "description": "When uploading a file > 10MB, server returns 500 instead of 413. Needs proper size validation middleware.",
        "severity": "major"
      }
    }
  ]
}`;

  const nodejsSnippet = `// After running your tests, call this to push results to Test Manager:
const payload = {
  suite: "My Feature Suite",
  tests: [
    {
      key: "${projectKey}-001",
      title: "Feature works as expected",
      expected_result: "Returns 200 OK",
      run: {
        status: "pass",        // pass | fail | blocked | skipped
        duration_ms: 120,
        actual_result: "Returned 200 OK with correct body",
        branch: "main",
        version: "v1.0.0"
      }
    }
  ]
};

const response = await fetch(
  "https://testmangerapp.vercel.app/api/projects/${projectKey}/agent-sync",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }
);

const result = await response.json();
console.log(result.summary); // { created_cases: 1, created_runs: 1, ... }`;

  const powershellSnippet = `# PowerShell - push test result to Test Manager
$payload = @{
  suite = "My Feature Suite"
  tests = @(
    @{
      key = "${projectKey}-001"
      title = "Feature works as expected"
      expected_result = "Returns 200 OK"
      run = @{
        status = "pass"
        duration_ms = 120
        actual_result = "Returned 200 OK with correct body"
      }
    }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod \`
  -Uri "https://testmangerapp.vercel.app/api/projects/${projectKey}/agent-sync" \`
  -Method POST \`
  -Headers @{"Content-Type" = "application/json"} \`
  -Body $payload`;

  // Sample payload for demo push
  const samplePayload = {
    suite: 'Demo: File Operations',
    suite_description: 'Sample test results pushed from the AI Agent Guide',
    environment: { name: 'Demo Environment', os: 'Ubuntu 22.04', runtime: 'Node.js 20' },
    tests: [
      {
        key: `${projectKey}-DEMO-001`,
        title: 'Create and write a new file',
        expected_result: 'File created with correct content',
        type: 'functional',
        severity: 'major',
        steps: [
          { action: 'Call create_file("/tmp/test.txt", "hello")', expected: 'Returns success' },
          { action: 'Read /tmp/test.txt', expected: 'Content equals "hello"' },
        ],
        run: {
          status: 'pass',
          duration_ms: 32,
          actual_result: 'File created and content verified.',
          version: 'v0.1.0',
          branch: 'main',
        },
      },
      {
        key: `${projectKey}-DEMO-002`,
        title: 'Delete a non-existent file returns correct error',
        expected_result: 'Returns ENOENT error code',
        type: 'functional',
        severity: 'minor',
        run: {
          status: 'fail',
          duration_ms: 10,
          actual_result: 'Returned generic 500 error instead of ENOENT',
        },
        create_defect: true,
        defect: {
          title: 'Delete non-existent file returns 500 instead of ENOENT',
          description: 'Error handling for missing files needs to map to the correct error code.',
          severity: 'minor',
        },
      },
    ],
    signoff: { decision: 'conditional', role: 'AI Agent', notes: 'Demo run: one pass, one fail with auto-filed bug.' },
  };

  const handlePushSampleTests = async () => {
    setSyncingSample(true);
    setSampleSuccess(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/agent-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(samplePayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync tests');
      setSampleSuccess(`Demo synced! Created ${data.summary?.created_cases ?? 0} test cases, ${data.summary?.created_runs ?? 0} runs, ${data.summary?.created_issues ?? 0} bug(s) auto-filed.`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSyncingSample(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20">
              <Bot className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              AI Agent Guide
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            How to connect your AI coding agent (or any script) to automatically push test results to this dashboard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setIsImportModalOpen(true)} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            Upload JUnit XML
          </Button>
          <Button size="sm" variant="primary" onClick={handlePushSampleTests} isLoading={syncingSample} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Run Demo Sync
          </Button>
        </div>
      </div>

      {sampleSuccess && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{sampleSuccess}</span>
          </div>
          <a href={`/projects/${projectId}/tests`} className="text-xs font-semibold underline flex items-center gap-1">
            View Test Cases <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* How it works: 3 modes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/10 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Bot className="h-4 w-4 text-blue-500" />
              AI Agent (Recommended)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5">
            <p>Give your AI agent (Antigravity, Cursor, Claude Code, Copilot) the prompt below.</p>
            <p>It will automatically push test results every time it writes or runs code — no manual work needed.</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 dark:border-purple-800/60 bg-purple-50/50 dark:bg-purple-950/10 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Hand className="h-4 w-4 text-purple-500" />
              Manual (from the site)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5">
            <p>Go to <strong>Test Cases</strong>, click <strong>&quot;+ Add Test Case&quot;</strong> to write a test.</p>
            <p>Then click the <strong>▶ Run</strong> button on any test case to manually record whether it passed or failed.</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/10 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-500" />
              Script / CI Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5">
            <p>Use the Node.js or PowerShell snippet below in any test script.</p>
            <p>Works in GitHub Actions, local scripts, or anywhere that can make HTTP requests.</p>
          </CardContent>
        </Card>
      </div>

      {/* What does "Run" mean */}
      <Card className="border-amber-200 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/10 shadow-sm">
        <CardContent className="pt-4">
          <div className="flex gap-3 items-start">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-700 dark:text-zinc-300 space-y-1">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">What does the ▶ Run button do?</p>
              <p>
                A <strong>Test Case</strong> is just a description — it says <em>what</em> to test and <em>what result to expect</em>.
                It doesn&apos;t actually run any code.
              </p>
              <p>
                When you click <strong>▶ Run</strong>, a modal opens where you record the outcome: Did it pass? Did it fail?
                What actually happened? How long did it take? This creates a <strong>Test Run</strong> — a timestamped record of one execution.
              </p>
              <p>
                <strong>If you use the AI agent:</strong> The agent runs the actual code, sees the result, and pushes it via API automatically.
                You don&apos;t need to click ▶ Run at all — the agent does it for you.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step by step: Agent prompt */}
      <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-500" />
                Step 1 — Copy this prompt into your AI agent
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Paste this into Antigravity, Cursor, Claude Code, or GitHub Copilot before you start building.
              </CardDescription>
            </div>
            <Button size="xs" variant="outline" onClick={() => copyToClipboard(agentPrompt, 'agent')}>
              {copiedSection === 'agent' ? (
                <><Check className="h-3 w-3 mr-1 text-emerald-500" />Copied!</>
              ) : (
                <><Copy className="h-3 w-3 mr-1" />Copy Prompt</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
            {agentPrompt}
          </pre>
        </CardContent>
      </Card>

      {/* Node.js snippet */}
      <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Globe className="h-4 w-4 text-emerald-500" />
                Step 2 (optional) — Add this to your test script
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Paste in Node.js, Python (with requests), or any language that can make HTTP POST requests.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="xs" variant="ghost" onClick={() => copyToClipboard(nodejsSnippet, 'node')} className="text-xs">
                {copiedSection === 'node' ? <><Check className="h-3 w-3 mr-1 text-emerald-500" />Copied!</> : <><Copy className="h-3 w-3 mr-1" />Node.js</>}
              </Button>
              <Button size="xs" variant="ghost" onClick={() => copyToClipboard(powershellSnippet, 'ps')} className="text-xs">
                {copiedSection === 'ps' ? <><Check className="h-3 w-3 mr-1 text-emerald-500" />Copied!</> : <><Copy className="h-3 w-3 mr-1" />PowerShell</>}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {nodejsSnippet}
          </pre>
        </CardContent>
      </Card>

      {/* API Reference quick table */}
      <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Quick API Reference
          </CardTitle>
          <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400">
            All the fields you can send in the payload. Only <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">suite</code> and <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">tests</code> are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="p-2.5 text-left font-semibold text-zinc-700 dark:text-zinc-300 w-40">Field</th>
                  <th className="p-2.5 text-left font-semibold text-zinc-700 dark:text-zinc-300 w-20">Required</th>
                  <th className="p-2.5 text-left font-semibold text-zinc-700 dark:text-zinc-300">What it does</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {[
                  ['suite', '✅ Yes', 'Name of the feature group (e.g. "Login Feature")'],
                  ['suite_description', 'No', 'Optional description of the suite'],
                  ['tests', '✅ Yes', 'Array of test cases to create/update and run'],
                  ['tests[].key', '✅ Yes', 'Unique ID like MORPH-001. If it exists, the run is added to it.'],
                  ['tests[].title', '✅ Yes', 'What the test checks'],
                  ['tests[].expected_result', '✅ Yes', 'What should happen'],
                  ['tests[].steps', 'No', 'Array of { action, expected } steps'],
                  ['tests[].run.status', '✅ Yes', '"pass", "fail", "blocked", or "skipped"'],
                  ['tests[].run.actual_result', 'No', 'What actually happened'],
                  ['tests[].run.duration_ms', 'No', 'How long the test took in milliseconds'],
                  ['tests[].run.branch', 'No', 'Git branch name'],
                  ['tests[].run.version', 'No', 'App version string'],
                  ['tests[].run.evidence', 'No', 'Array of { file_name, file_type, description }'],
                  ['tests[].create_defect', 'No', 'true → auto-file a bug when run fails'],
                  ['tests[].defect.title', 'If defect', 'Bug title'],
                  ['tests[].defect.severity', 'If defect', '"blocker", "critical", "major", "minor", "trivial"'],
                  ['environment', 'No', '{ name, os, runtime } — what machine the tests ran on'],
                  ['signoff', 'No', '{ decision, role, notes } — QA approval record'],
                ].map(([field, req, desc]) => (
                  <tr key={field} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="p-2.5 font-mono text-blue-600 dark:text-blue-400">{field}</td>
                    <td className="p-2.5 text-zinc-500">{req}</td>
                    <td className="p-2.5 text-zinc-600 dark:text-zinc-400">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <JunitImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        projectId={projectId}
        onImportComplete={() => {
          setIsImportModalOpen(false);
        }}
      />
    </div>
  );
}
