'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Settings,
  Save,
  ShieldAlert,
  Key,
  Terminal,
  Copy,
  Check,
  Trash2,
  Palette,
  Sliders,
  Sparkles,
  Bot,
  AlertTriangle,
  DownloadCloud,
  FileCode,
  CheckCircle2,
  RefreshCw,
  FolderKanban,
  Shield,
  Layers,
  History,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { logAuditEvent } from '@/lib/audit';

type SettingsTab = 'general' | 'quality' | 'ai_agent' | 'danger';

const ACCENT_COLORS = [
  { name: 'Morph Purple', hex: '#8b5cf6' },
  { name: 'Electric Blue', hex: '#3b82f6' },
  { name: 'Emerald Green', hex: '#10b981' },
  { name: 'Crimson Rose', hex: '#f43f5e' },
  { name: 'Amber Gold', hex: '#f59e0b' },
  { name: 'Cyan Teal', hex: '#06b6d4' },
];

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const supabase = createClient();

  const [activeTab, setActiveTab] = React.useState<SettingsTab>('general');
  const [project, setProject] = React.useState<any>(null);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [accentColor, setAccentColor] = React.useState('#8b5cf6');
  
  // Quality Gates Settings
  const [minPassRate, setMinPassRate] = React.useState('90');
  const [zeroBlockers, setZeroBlockers] = React.useState(true);
  const [enforceRetest, setEnforceRetest] = React.useState(true);
  const [autoCreateDefects, setAutoCreateDefects] = React.useState(true);

  // States
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState(false);
  const [copiedCurl, setCopiedCurl] = React.useState(false);
  const [copiedPrompt, setCopiedPrompt] = React.useState(false);
  const [message, setMessage] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchProject = React.useCallback(async () => {
    setLoading(true);
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
      let query = supabase.from('projects').select('*');
      if (isUuid) {
        query = query.eq('id', projectId);
      } else {
        query = query.ilike('key', projectId);
      }

      const { data, error } = await query.single();

      if (error) throw error;
      setProject(data);
      setName(data.name);
      setDescription(data.description || '');
      setAccentColor(data.accent_color || '#8b5cf6');

      // Load saved quality gates from localStorage if any
      try {
        const saved = localStorage.getItem(`morphfs_quality_gates_${data.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.minPassRate) setMinPassRate(parsed.minPassRate);
          if (parsed.zeroBlockers !== undefined) setZeroBlockers(parsed.zeroBlockers);
          if (parsed.enforceRetest !== undefined) setEnforceRetest(parsed.enforceRetest);
          if (parsed.autoCreateDefects !== undefined) setAutoCreateDefects(parsed.autoCreateDefects);
        }
      } catch (e) {}
    } catch (err) {
      console.error('Fetch project error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  React.useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId, fetchProject]);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          accent_color: accentColor,
        })
        .eq('id', project.id);

      if (error) throw error;

      await logAuditEvent({
        projectId: project.id,
        action: 'update_project_settings',
        entityType: 'project',
        entityId: project.id,
        details: { name: name.trim(), accent_color: accentColor },
      });

      setMessage({ text: 'Project configuration updated successfully!', type: 'success' });
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ text: `Failed to save: ${err.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQualityGates = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const config = { minPassRate, zeroBlockers, enforceRetest, autoCreateDefects };
      localStorage.setItem(`morphfs_quality_gates_${project.id}`, JSON.stringify(config));
      setMessage({ text: 'Release Quality Gating policies saved successfully!', type: 'success' });
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ text: `Failed to save quality rules: ${err.message}`, type: 'error' });
    }
  };

  const curlSyncExample = `curl -X POST "${typeof window !== 'undefined' ? window.location.origin : 'https://testmanger.vercel.app'}/api/projects/${project?.id || projectId}/agent-sync" \\
  -H "Content-Type: application/json" \\
  -d '{
    "mode": "incremental_append",
    "testCases": [
      {
        "key": "MORPH-SRCH-003",
        "title": "Search Bar Alignment in Shell Context",
        "type": "functional",
        "priority": "high",
        "severity": "major",
        "status": "active"
      }
    ],
    "testRuns": [
      {
        "test_case_key": "MORPH-SRCH-003",
        "status": "fail",
        "notes": "Modal alignment shifted 42px right on 1080p display"
      }
    ],
    "issues": [
      {
        "key": "BUG-MORPH-001",
        "title": "Morph Search overlay modal displaced",
        "severity": "major",
        "status": "open",
        "test_case_key": "MORPH-SRCH-003"
      }
    ]
  }'`;

  const agentPromptDirective = `### MORPHFS AUTONOMOUS QA & TEST MANAGEMENT DIRECTIVE
You are the fully-authorized Autonomous QA Agent for this project (${project?.key || 'MORPH'}).
You have 100% full authority and parity with human QA engineers: you can query project state, modify or update existing test cases, rewrite steps, delete tests, execute test runs (pass/fail/blocked), automatically log bugs on failure, and verify fixes through retests which auto-close issues.

BASE URL: https://testmanger.vercel.app (or local http://localhost:3000)
PROJECT ID / KEY: ${project?.key || projectId}

========================================================================
1. STATE INSPECTION (Always query this first to know your tests and issues):
========================================================================
GET /api/projects/${project?.key || projectId}/agent-sync

Returns complete project context with:
- "cases": array of all test cases, with ordered 1-based index (index: 1 is your first test), keys, suites, priority, steps, and last execution status.
- "issues": all active bugs/defects with severity and linked test case keys.
- "suites": all test suites.
- "runs": recent execution runs with duration and step results.

========================================================================
2. MODIFYING OR RETARGETING AN EXISTING TEST (e.g. "go back to first test"):
========================================================================
POST /api/projects/${project?.key || projectId}/agent-sync
Payload:
{
  "mode": "incremental_append",
  "tests": [
    {
      "target": "first",       // Or "index": 1, or "key": "${project?.key || 'MORPH'}-DSK-001"
      "title": "MorphFS Desktop Window & Logo Verification",
      "priority": "critical",
      "severity": "critical",
      "steps": [
        { "action": "Launch MorphFS executable", "expected": "Window renders within 500ms" },
        { "action": "Verify SVG Morph logo in top-left brand header", "expected": "Logo renders crisp at 32x32 without distortion" },
        { "action": "Verify system tray minimize behavior", "expected": "Minimizes to tray without crashing" }
      ]
    }
  ]
}

========================================================================
3. CREATING NEW TEST CASES:
========================================================================
POST /api/projects/${project?.key || projectId}/agent-sync
Payload:
{
  "mode": "incremental_append",
  "suite": "Search & Explorer Engine",
  "tests": [
    {
      "key": "${project?.key || 'MORPH'}-SRCH-001",
      "title": "Morph Search Overlay Instant Filter",
      "type": "functional",
      "priority": "high",
      "severity": "major",
      "steps": [
        { "action": "Press Ctrl+K or click search icon", "expected": "Search modal appears centered" },
        { "action": "Type query 'invoice'", "expected": "Results populate in < 50ms" }
      ]
    }
  ]
}

========================================================================
4. RECORDING TEST EXECUTIONS (Pass / Fail / Blocked):
========================================================================
POST /api/projects/${project?.key || projectId}/agent-sync
Payload:
{
  "runs": [
    {
      "target": "first",       // Or "test_case_key": "${project?.key || 'MORPH'}-DSK-001"
      "status": "pass",        // "pass" | "fail" | "blocked" | "skipped"
      "duration_ms": 84,
      "actual_result": "Morph window and logo verified successfully",
      "version": "v1.0.0-dev",
      "branch": "main"
    }
  ]
}

========================================================================
5. LOGGING DEFECTS ON FAILURE:
========================================================================
POST /api/projects/${project?.key || projectId}/agent-sync
Payload:
{
  "tests": [
    {
      "target": "first",
      "run": { "status": "fail", "actual_result": "Search input overlaps with window close button" },
      "create_defect": true,
      "defect": {
        "title": "Morph Search bar misaligned with window header controls",
        "severity": "major",
        "priority": "high",
        "root_cause": "CSS flex layout collision between search bar container and window action buttons"
      }
    }
  ]
}

========================================================================
6. VERIFYING FIXES & AUTO-CLOSING DEFECTS:
========================================================================
POST /api/projects/${project?.key || projectId}/agent-sync
Payload:
{
  "retests": [
    {
      "issue_key": "BUG-${project?.key || 'MORPH'}-001",
      "status": "pass",
      "actual_result": "Verified fixed: search bar padding corrected, zero overlap"
    }
  ]
}

========================================================================
7. DELETING TESTS:
========================================================================
POST /api/projects/${project?.key || projectId}/agent-sync
Payload:
{
  "delete_tests": [1, "${project?.key || 'MORPH'}-OBS-001"]
}
`;

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <div className="h-8 w-56 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        <div className="h-72 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Settings className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            Project Settings & Governance
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Manage branding, automated CI/CD and AI agent integration, quality gating thresholds, and project lifecycle.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2 py-1 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold">
            KEY: {project?.key}
          </span>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl text-xs font-mono border flex items-center gap-2 animate-in fade-in duration-200 ${
            message.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`pb-3 px-3.5 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'general'
              ? 'border-purple-500 text-purple-600 dark:text-purple-400 font-semibold'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Palette className="h-4 w-4" />
          General & Branding
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('quality')}
          className={`pb-3 px-3.5 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'quality'
              ? 'border-purple-500 text-purple-600 dark:text-purple-400 font-semibold'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          Quality Gates & Sign-Off
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ai_agent')}
          className={`pb-3 px-3.5 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'ai_agent'
              ? 'border-purple-500 text-purple-600 dark:text-purple-400 font-semibold'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Bot className="h-4 w-4" />
          AI Agent & Pipeline Sync
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('danger')}
          className={`pb-3 px-3.5 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'danger'
              ? 'border-rose-500 text-rose-600 dark:text-rose-400 font-semibold'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Maintenance & Danger Zone
        </button>
      </div>

      {/* TAB 1: General & Branding */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveGeneral} className="space-y-6">
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm space-y-5">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Palette className="h-4 w-4 text-purple-500" />
                Project Identity & Branding
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Customize project display metadata and workspace themes
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                  Project Title
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="MorphFS"
                  className="bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                  Immutable Project Key
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    value={project?.key || ''}
                    disabled
                    className="bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-xs font-mono text-purple-500 font-bold cursor-not-allowed"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(project?.key || '', setCopiedKey)}
                    className="shrink-0 text-xs"
                    title="Copy Key"
                  >
                    {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                Description & Scope
              </label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe project architecture, test goals, and capstone specifications..."
                className="bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100"
              />
            </div>

            {/* Accent Color Palette */}
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-2">
                Brand Accent Palette
              </label>
              <div className="flex flex-wrap items-center gap-3">
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setAccentColor(c.hex)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                      accentColor === c.hex
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full shadow-xs"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Preview Card */}
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-2 font-mono">
                Sidebar & Header Badge Preview
              </span>
              <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 flex items-center justify-between max-w-sm">
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-mono font-bold text-sm shadow-sm"
                    style={{ backgroundColor: accentColor }}
                  >
                    {project?.key ? project.key.charAt(0) : 'M'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {name || 'MorphFS'}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-400">
                      {project?.key || 'MORPH'} • WIN-EDITION
                    </div>
                  </div>
                </div>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white shadow-xs"
                  style={{ backgroundColor: accentColor }}
                >
                  ACTIVE
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={saving}
                className="gap-2 bg-purple-600 hover:bg-purple-500 text-white"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save General Settings'}
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: Quality Gates & Sign-Off */}
      {activeTab === 'quality' && (
        <form onSubmit={handleSaveQualityGates} className="space-y-6">
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm space-y-5">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-500" />
                PFE Defense & Release Quality Gates
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Enforce rigorous verification criteria before test suites and capstone releases can be certified
              </p>
            </div>

            <div className="space-y-3">
              {/* Zero Blockers Policy */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-950/60">
                <div className="space-y-0.5 max-w-lg">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                    Zero Open Blocker / Critical Defects
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Strictly prevents signing off releases if any blocker or critical severity issues remain unverified.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={zeroBlockers}
                  onChange={(e) => setZeroBlockers(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
              </div>

              {/* Minimum Pass Rate */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-950/60">
                <div className="space-y-0.5 max-w-lg">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                    Minimum Verification Pass Rate Threshold
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Requires overall execution success percentage to meet or exceed this target for capstone approval.
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <Input
                    type="number"
                    min="50"
                    max="100"
                    value={minPassRate}
                    onChange={(e) => setMinPassRate(e.target.value)}
                    className="w-16 h-8 text-xs text-center font-bold bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                  />
                  <span className="text-xs font-bold text-zinc-500">%</span>
                </div>
              </div>

              {/* Enforce Retest Verification */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-950/60">
                <div className="space-y-0.5 max-w-lg">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                    Mandatory Retest Verification Before Issue Closure
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Requires a passing test execution run (`pass`) linked directly to the defect before its status can transition to `closed`.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={enforceRetest}
                  onChange={(e) => setEnforceRetest(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
              </div>

              {/* Auto Create Defects on Failure */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-950/60">
                <div className="space-y-0.5 max-w-lg">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                    Automated Defect Generation for Failed Runs
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    When CI/CD pipelines or AI agents log a `fail` outcome, automatically create a tracked issue in Bugs & Issues.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoCreateDefects}
                  onChange={(e) => setAutoCreateDefects(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="gap-2 bg-purple-600 hover:bg-purple-500 text-white"
              >
                <Save className="h-4 w-4" />
                Save Quality Gates
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: AI Agent & Automation Sync */}
      {activeTab === 'ai_agent' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-purple-500" />
                  AI Agent Ingestion & CI/CD Pipelines
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Connect coding agents (Cursor, Claude Code, Antigravity) to automatically report test executions and defects
                </p>
              </div>

              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                ACTIVE API
              </span>
            </div>

            {/* Prompt Directive for Agents */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                  One-Click AI Agent System Prompt
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => copyToClipboard(agentPromptDirective, setCopiedPrompt)}
                  className="gap-1.5 text-xs text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
                >
                  {copiedPrompt ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedPrompt ? 'Copied Prompt!' : 'Copy Agent Directive'}
                </Button>
              </div>
              <p className="text-[11px] text-zinc-500">
                Paste this directive into your AI pair programming session so the agent autonomously reports test runs and files defects.
              </p>
              <pre className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-purple-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                {agentPromptDirective}
              </pre>
            </div>

            {/* cURL Ingestion Endpoint */}
            <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-emerald-500" />
                  Live Sync Endpoint (`POST /api/projects/[id]/agent-sync`)
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => copyToClipboard(curlSyncExample, setCopiedCurl)}
                  className="gap-1.5 text-xs"
                >
                  {copiedCurl ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedCurl ? 'Copied cURL!' : 'Copy cURL'}
                </Button>
              </div>
              <pre className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-emerald-400 font-mono text-[11px] overflow-x-auto">
                {curlSyncExample}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Maintenance & Danger Zone */}
      {activeTab === 'danger' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20 shadow-sm space-y-5">
            <div>
              <h2 className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Project Maintenance & Archive
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Export project backups or perform administrative resets
              </p>
            </div>

            <div className="space-y-3">
              {/* Export Full Backup */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                    Export Immutable Verification Archive (.testmanager)
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    Download complete snapshot of all test cases, executions, defects, and audit logs.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/projects/${project?.id || projectId}/backup`)}
                  className="gap-1.5 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 text-xs shrink-0"
                >
                  <DownloadCloud className="h-3.5 w-3.5" />
                  Backup Center →
                </Button>
              </div>

              {/* View Activity Logs */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                    Tamper-Evident Audit Trail
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    Inspect immutable cryptographic timestamps of all team actions and AI runs.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/projects/${project?.id || projectId}/activity`)}
                  className="gap-1.5 text-xs shrink-0"
                >
                  <History className="h-3.5 w-3.5" />
                  View Audit Log →
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
