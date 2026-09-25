'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
  Bot,
  Terminal,
  UploadCloud,
  CheckCircle2,
  Copy,
  Check,
  FileCode,
  Sparkles,
  Play,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { JunitImportModal } from '@/components/automated/JunitImportModal';

export default function ImportAndAgentPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();

  const [projectKey, setProjectKey] = React.useState('TM-101');
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
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Comprehensive sample morphFS test ecosystem covering all features
  const sampleMorphFSPayload = {
    suite: 'morphFS Core & VFS Layer',
    suite_description: 'Automated verification for morphFS inode operations, crash recovery, and VFS compliance',
    environment: {
      name: 'morphFS Linux 6.12 (QEMU KVM)',
      os: 'Ubuntu 24.04 (Kernel 6.12.5-morphfs)',
      cpu: '16 vCPU AMD EPYC',
      ram: '32 GB RAM',
      runtime: 'QEMU KVM + GDB Stub',
    },
    plan: {
      name: 'v1.0 Milestone Release Verification',
      description: 'Core filesystem stability, crash consistency, and POSIX compliance gating',
    },
    tests: [
      {
        key: `${projectKey}-001`,
        title: 'Crash Consistency & Journal Replay',
        description: 'Verify metadata consistency after sudden power failure during asynchronous write operations.',
        type: 'recovery',
        severity: 'critical',
        priority: 'critical',
        preconditions: 'morphFS module loaded; root partition mounted with ordered journaling',
        expected_result: 'Zero orphan inodes; fsck reports clean state with all metadata intact',
        steps: [
          { action: 'Mount morphFS with journal=ordered', expected: 'Filesystem mounts in read-write mode' },
          { action: 'Start multi-threaded writes to 500 files', expected: 'Transactions queued in journal buffer' },
          { action: 'Trigger kernel fault / abrupt unmount', expected: 'Dirty blocks preserved in circular journal' },
          { action: 'Remount and trigger journal replay', expected: 'Zero orphan inodes; fsck reports clean state' },
        ],
        run: {
          status: 'pass',
          duration_ms: 1840,
          actual_result: 'Journal replayed in 1.84s. All 500 file descriptors intact with valid checksums.',
          version: 'v1.0.0-rc1',
          branch: 'main',
          commit_sha: 'a1b2c3d4e5',
          evidence: [
            {
              file_name: 'fsck_journal_replay.log',
              file_type: 'text/plain',
              description: 'fsck journal replay verification output log',
            },
          ],
        },
      },
      {
        key: `${projectKey}-002`,
        title: 'Concurrent Directory Inode Allocation',
        description: 'Stress-test lock contention on parent directory inode under 100 concurrent workers.',
        type: 'stress',
        severity: 'major',
        priority: 'high',
        preconditions: '100 worker threads initialized in user space',
        expected_result: '10,000 directories created without deadlock or lock contention panic',
        steps: [
          { action: 'Spawn 100 POSIX threads calling mkdir concurrently', expected: 'Directory mutex scales with zero deadlocks' },
          { action: 'Verify all directory entries via readdir()', expected: 'All 10,000 directories listed without collision' },
        ],
        run: {
          status: 'pass',
          duration_ms: 2450,
          actual_result: '10,000 subdirectories created across 100 threads in 2.45s.',
          version: 'v1.0.0-rc1',
          branch: 'main',
        },
      },
      {
        key: `${projectKey}-003`,
        title: 'Extended Attributes (xattr) Security Context',
        description: 'Validate POSIX ACLs and security.selinux attributes preservation across snapshot restore.',
        type: 'security',
        severity: 'critical',
        priority: 'critical',
        preconditions: 'SELinux enabled in permissive mode; xattr partition enabled',
        expected_result: 'xattr integrity verified across COW snapshot tree',
        steps: [
          { action: 'Set security.selinux attribute on /test/sec.txt', expected: 'Attribute stored in extended inode header' },
          { action: 'Take COW snapshot snap_001', expected: 'COW refcount incremented' },
          { action: 'Read xattr from snap_001', expected: 'Attribute returns matching hash' },
        ],
        run: {
          status: 'fail',
          duration_ms: 680,
          actual_result: 'Kernel returned EINVAL: Extended attribute hash mismatch on snapshot boundary.',
          version: 'v1.0.0-rc1',
          branch: 'main',
          evidence: [
            {
              file_name: 'xattr_mismatch.dump',
              file_type: 'application/octet-stream',
              description: 'Raw inode header dump with corrupted xattr offset',
            },
          ],
        },
        create_defect: true,
        defect: {
          title: '[morphFS Kernel Bug] xattr hash mismatch on COW snapshot restore',
          description: 'Extended attributes are corrupted when reading from a read-only snapshot boundary.',
          severity: 'critical',
          priority: 'critical',
          root_cause: 'Missing inode offset calculation in snapshot lookup function.',
          evidence: [
            {
              file_name: 'kernel_panic_trace.txt',
              file_type: 'text/plain',
              description: 'Kernel stack trace at morphfs_getxattr',
            },
          ],
        },
      },
    ],
    signoff: {
      decision: 'conditional',
      role: 'Automated AI Verification Gate',
      notes: 'Crash recovery and concurrency suites passed. Release blocked until xattr COW defect is resolved.',
    },
  };

  const handlePushSampleTests = async () => {
    setSyncingSample(true);
    setSampleSuccess(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/agent-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleMorphFSPayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync tests');

      setSampleSuccess(
        `Full Ecosystem Synchronized! Populated Test Suites, Target Environment, Test Cases, Execution History, Defect Issue, Test Plan, and Quality Sign-Off.`
      );
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSyncingSample(false);
    }
  };

  const agentPrompt = `You are an AI Coding & Verification Agent building ${projectKey}.
Whenever you implement a feature, module, or bugfix in ${projectKey}, write and execute your tests, then push the entire verification ecosystem directly to Test Manager via this single API call:

Endpoint: POST https://testmanger.vercel.app/api/projects/${projectKey}/agent-sync
Header: Content-Type: application/json

What you have full access to create & manage automatically:
- Suites: Define your feature verification suite (e.g., "Disk Layout & Superblock", "Crash Recovery & Journal Replay", "WinFsp Driver Sync")
- Environments: Define your runtime targets (e.g., "Windows 11 WinFsp Native", "WSL2 Ubuntu 24.04 QEMU")
- Milestones / Plans: Group tests into defense milestones (e.g., "PFE Milestone 1: Core Disk Layout")
- Test Cases & Step Definitions: Actions, preconditions, expected outcomes
- Execution History: Actual duration, passing/failing status, commit SHA, version
- Crash Dumps & Evidence Vault: Attach logs, hex traces, and core dump filenames directly to the run or defect
- Defect Tracking: Automatically opened if a test fails or crashes
- Release Gates: Submit quality gating decisions (approved, conditional, rejected)

Payload Format:
{
  "suite": "morphFS Core & VFS Layer",
  "suite_description": "Verification of inode allocation and crash consistency",
  "environment": {
    "name": "morphFS Windows 11 (WinFsp)",
    "os": "Windows 11 23H2",
    "runtime": "WinFsp + PowerShell 7 Harness"
  },
  "plan": {
    "name": "PFE Milestone 1: Core Disk Layout",
    "description": "Superblock and COW inode tree verification"
  },
  "tests": [
    {
      "key": "${projectKey}-001",
      "title": "Crash Consistency & Journal Replay",
      "description": "Verify filesystem integrity after sudden power interruption.",
      "severity": "critical",
      "priority": "critical",
      "type": "recovery",
      "preconditions": "Ordered journaling enabled",
      "expected_result": "Clean journal replay with zero orphan inodes",
      "steps": [
        { "action": "Mount with journal=ordered", "expected": "Filesystem mounts rw" },
        { "action": "Trigger abrupt power fault", "expected": "Dirty blocks written to circular buffer" },
        { "action": "Remount and replay journal", "expected": "Zero orphan inodes; clean state" }
      ],
      "run": {
        "status": "pass",
        "duration_ms": 1420,
        "actual_result": "Replay completed in 1.42s with zero orphan inodes.",
        "version": "v1.0.0",
        "branch": "main",
        "evidence": [
          { "file_name": "fsck_journal_replay.log", "file_type": "text/plain", "description": "fsck replay output" }
        ]
      }
    }
  ],
  "signoff": {
    "decision": "approved",
    "role": "Lead Systems Architect Gate",
    "notes": "Journal replay verified without metadata corruption."
  }
}`;

  const curlSnippet = `curl -X POST https://testmanger.vercel.app/api/projects/${projectKey}/agent-sync \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(sampleMorphFSPayload, null, 2)}'`;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20">
              <Bot className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              AI Agent & Automated CI/CD Hub
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Let your AI coding agents automatically create verification suites, add test cases, log execution runs, attach crash dumps, and register environments.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsImportModalOpen(true)}
            className="border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
          >
            <UploadCloud className="h-3.5 w-3.5 mr-1.5 text-zinc-500 dark:text-zinc-400" />
            Upload JUnit / JSON Report
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={handlePushSampleTests}
            isLoading={syncingSample}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Populate Sample Run (Demo)
          </Button>
        </div>
      </div>

      {sampleSuccess && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{sampleSuccess}</span>
          </div>
          <a
            href={`/projects/${projectId}/tests`}
            className="text-xs text-emerald-600 dark:text-emerald-300 font-semibold underline flex items-center gap-1"
          >
            View Test Cases <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="agent">
        <TabsList className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <TabsTrigger value="agent">
            <Bot className="h-3.5 w-3.5 mr-1.5" />
            AI Agent Instructions
          </TabsTrigger>
          <TabsTrigger value="curl">
            <Terminal className="h-3.5 w-3.5 mr-1.5" />
            cURL / REST API
          </TabsTrigger>
          <TabsTrigger value="junit">
            <FileCode className="h-3.5 w-3.5 mr-1.5" />
            JUnit & Vitest CI Pipeline
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: AI Agent */}
        <TabsContent value="agent" className="space-y-4 pt-3">
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    How to instruct your AI Agent
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Copy and paste this prompt into Antigravity, Cursor, Claude Code, or GitHub Copilot so it automatically creates and runs tests for you.
                  </CardDescription>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => copyToClipboard(agentPrompt, 'agent')}
                >
                  {copiedSection === 'agent' ? (
                    <>
                      <Check className="h-3 w-3 mr-1 text-emerald-500 dark:text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy Agent Prompt
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {agentPrompt}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: cURL / REST API */}
        <TabsContent value="curl" className="space-y-4 pt-3">
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                    One-Command Direct Sync (cURL)
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Send test suites, step definitions, and execution run results directly via bash or python scripts.
                  </CardDescription>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => copyToClipboard(curlSnippet, 'curl')}
                >
                  {copiedSection === 'curl' ? (
                    <>
                      <Check className="h-3 w-3 mr-1 text-emerald-500 dark:text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy cURL
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {curlSnippet}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: JUnit CI Pipeline */}
        <TabsContent value="junit" className="space-y-4 pt-3">
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <FileCode className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                GitHub Actions / CI Ingestion
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Automatically ingest JUnit XML from Pytest, Maven, Jest, or Vitest into Test Manager in your CI workflow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <pre className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`# Add this step to your .github/workflows/test.yml
- name: Push Test Results to Test Manager
  if: always()
  run: |
    curl -X POST https://testmanger.vercel.app/api/projects/${projectKey}/import-junit \\
      -H "Content-Type: application/json" \\
      -d @<(jq -n --rawfile content ./test-results.xml '{format: "junit", content: $content}')`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Manual Upload Modal */}
      <JunitImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        projectId={projectId}
        onImportComplete={() => {
          setIsImportModalOpen(false);
          alert('Test reports successfully imported!');
        }}
      />
    </div>
  );
}
