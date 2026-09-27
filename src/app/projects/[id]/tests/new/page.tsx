'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckSquare,
  Plus,
  Trash2,
  Sparkles,
  Bot,
  AlertCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface StepItem {
  id: string;
  action: string;
  expectedResult: string;
}

export default function NewTestCasePage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.id as string;
  const supabase = createClient();

  const [projectId, setProjectId] = React.useState<string>(rawId);
  const [projectKey, setProjectKey] = React.useState<string>('TM');
  const [suites, setSuites] = React.useState<any[]>([]);

  // Form states
  const [title, setTitle] = React.useState('');
  const [key, setKey] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [suiteId, setSuiteId] = React.useState('');
  const [severity, setSeverity] = React.useState('major');
  const [priority, setPriority] = React.useState('medium');
  const [type, setType] = React.useState('manual');
  const [preconditions, setPreconditions] = React.useState('');
  const [expectedResult, setExpectedResult] = React.useState('');
  const [steps, setSteps] = React.useState<StepItem[]>([
    { id: '1', action: '', expectedResult: '' },
  ]);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 1. Resolve project UUID & suites
  React.useEffect(() => {
    async function loadProjectData() {
      if (!rawId) return;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);
      let pId = rawId;

      if (!isUuid) {
        const { data: p } = await supabase.from('projects').select('id, key').ilike('key', rawId).maybeSingle();
        if (p) {
          pId = p.id;
          setProjectKey(p.key);
        }
      } else {
        const { data: p } = await supabase.from('projects').select('id, key').eq('id', rawId).maybeSingle();
        if (p) setProjectKey(p.key);
      }
      setProjectId(pId);

      // Fetch suites
      const { data: suitesData } = await supabase
        .from('test_suites')
        .select('*')
        .eq('project_id', pId)
        .order('name');

      if (suitesData && suitesData.length > 0) {
        setSuites(suitesData);
        setSuiteId(suitesData[0].id);
      }

      // Fetch count for auto-key
      const { count } = await supabase
        .from('test_cases')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', pId);

      const nextNum = (count || 0) + 1;
      setKey(`${projectKey}-${String(nextNum).padStart(3, '0')}`);
    }

    loadProjectData();
  }, [rawId, supabase, projectKey]);

  // Step handlers
  const handleAddStep = () => {
    setSteps((prev) => [
      ...prev,
      { id: Date.now().toString(), action: '', expectedResult: '' },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStepChange = (index: number, field: 'action' | 'expectedResult', val: string) => {
    setSteps((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Test case title is required.');
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Ensure a suite exists
      let finalSuiteId = suiteId;
      if (!finalSuiteId) {
        const { data: newSuite } = await supabase
          .from('test_suites')
          .insert({
            project_id: projectId,
            name: 'General Regression Suite',
            status: 'active',
          })
          .select()
          .single();
        if (newSuite) finalSuiteId = newSuite.id;
      }

      // Insert test case
      const { data: newCase, error: caseErr } = await supabase
        .from('test_cases')
        .insert({
          project_id: projectId,
          suite_id: finalSuiteId || null,
          key: key.trim().toUpperCase(),
          title: title.trim(),
          description: description.trim() || null,
          severity,
          priority,
          type,
          preconditions: preconditions.trim() || null,
          expected_result: expectedResult.trim() || 'Step expectations met successfully',
          status: 'active',
          created_by: user?.id,
        })
        .select()
        .single();

      if (caseErr) throw caseErr;

      // Insert steps
      const validSteps = steps.filter((s) => s.action.trim().length > 0);
      if (validSteps.length > 0 && newCase) {
        const stepRecords = validSteps.map((s, idx) => ({
          test_case_id: newCase.id,
          step_number: idx + 1,
          action: s.action.trim(),
          expected_result: s.expectedResult.trim() || null,
        }));
        await supabase.from('test_steps').insert(stepRecords);
      }

      router.push(`/projects/${projectId}/tests/${newCase.id}`);
    } catch (err: any) {
      console.error('Failed to create test case:', err);
      setError(err.message || 'Failed to save test case.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${projectId}/tests`}>
            <Button size="xs" variant="ghost" className="gap-1.5 text-zinc-400 hover:text-zinc-100">
              <ArrowLeft className="h-3.5 w-3.5" />
              All Cases
            </Button>
          </Link>
          <div className="h-4 w-px bg-zinc-800" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-blue-500" />
              Author Manual Test Case
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Define detailed preconditions, executable steps, and verification checkpoints.
            </p>
          </div>
        </div>

        {/* AI Agent alternative callout */}
        <Link href={`/projects/${projectId}/import`}>
          <Button size="xs" variant="outline" className="gap-1.5 border-purple-500/30 text-purple-400 hover:bg-purple-500/10">
            <Bot className="h-3.5 w-3.5" />
            Prefer AI Agent Auto-Creation?
          </Button>
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold text-zinc-200">
              Test Identity & Classification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Test Key <span className="text-rose-400">*</span>
                </label>
                <Input
                  value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                  placeholder="e.g. TM-001"
                  className="font-mono uppercase bg-zinc-950/70 border-zinc-800 text-zinc-100"
                  required
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Test Case Title <span className="text-rose-400">*</span>
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Inode allocation under sudden power disruption"
                  className="bg-zinc-950/70 border-zinc-800 text-zinc-100"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Description / Objective
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what specific invariants or behaviors this test verifies..."
                rows={2}
                className="bg-zinc-950/70 border-zinc-800 text-zinc-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Test Suite
                </label>
                <Select
                  value={suiteId}
                  onChange={(e) => setSuiteId(e.target.value)}
                  className="bg-zinc-950/70 border-zinc-800 text-zinc-100"
                >
                  {suites.length === 0 && (
                    <option value="">Default General Suite</option>
                  )}
                  {suites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Severity
                </label>
                <Select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="bg-zinc-950/70 border-zinc-800 text-zinc-100"
                >
                  <option value="critical">Critical / Blocker</option>
                  <option value="major">Major</option>
                  <option value="minor">Minor</option>
                  <option value="trivial">Trivial</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Priority
                </label>
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="bg-zinc-950/70 border-zinc-800 text-zinc-100"
                >
                  <option value="p0">P0 - Blocker</option>
                  <option value="p1">P1 - High</option>
                  <option value="p2">P2 - Medium</option>
                  <option value="p3">P3 - Low</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Execution Type
                </label>
                <Select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="bg-zinc-950/70 border-zinc-800 text-zinc-100"
                >
                  <option value="manual">Manual QA</option>
                  <option value="automated">Automated (CI/Agent)</option>
                  <option value="exploratory">Exploratory</option>
                  <option value="stress">Stress / Load</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Pre-Conditions
              </label>
              <Input
                value={preconditions}
                onChange={(e) => setPreconditions(e.target.value)}
                placeholder="e.g. morphFS kernel module loaded; root partition mounted with ordered journaling"
                className="bg-zinc-950/70 border-zinc-800 text-zinc-100"
              />
            </div>
          </CardContent>
        </Card>

        {/* Step-by-Step Instructions */}
        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-zinc-200">
                Test Steps & Verification Points
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Provide clear sequential steps for human testers or automation harnesses to execute.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleAddStep}
              className="gap-1"
            >
              <Plus className="h-3 w-3" />
              Add Step
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.map((st, idx) => (
              <div
                key={st.id}
                className="flex items-start gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-mono font-bold text-zinc-300 mt-1">
                  {idx + 1}
                </span>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Action / Step Description
                    </label>
                    <Input
                      value={st.action}
                      onChange={(e) => handleStepChange(idx, 'action', e.target.value)}
                      placeholder="e.g. Execute mkdir -p /mnt/morph/test_dir"
                      className="bg-zinc-900 border-zinc-800 text-zinc-100 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Expected Result
                    </label>
                    <Input
                      value={st.expectedResult}
                      onChange={(e) => handleStepChange(idx, 'expectedResult', e.target.value)}
                      placeholder="e.g. Directory created with inode return status 0"
                      className="bg-zinc-900 border-zinc-800 text-zinc-100 text-xs"
                    />
                  </div>
                </div>

                {steps.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="iconSm"
                    onClick={() => handleRemoveStep(idx)}
                    className="text-zinc-500 hover:text-rose-400 mt-6"
                    title="Remove step"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={`/projects/${projectId}/tests`}>
            <Button type="button" variant="outline" size="sm">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={loading || !title.trim()}
            className="gap-1.5"
          >
            {loading ? 'Creating Test Case...' : 'Create Test Case'}
          </Button>
        </div>
      </form>
    </div>
  );
}
