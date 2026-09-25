import { z } from 'zod';

export const projectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters').max(60, 'Maximum 60 characters'),
  key: z
    .string()
    .min(2, 'Key must be at least 2 characters')
    .max(10, 'Key cannot exceed 10 characters')
    .regex(/^[A-Z0-9]+$/, 'Project key must consist of uppercase alphanumeric characters only (e.g. CORE, AUTH, API)'),
  description: z.string().max(500, 'Maximum 500 characters').optional().nullable(),
  icon: z.string().default('Layers'),
  accent_color: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/, 'Must be a valid hex color').default('#3b82f6'),
});

export const testSuiteSchema = z.object({
  name: z.string().min(2, 'Suite name must be at least 2 characters').max(100, 'Maximum 100 characters'),
  description: z.string().max(1000).optional().nullable(),
  status: z.enum(['active', 'draft', 'archived']).default('active'),
  is_regression: z.boolean().default(false),
});

export const testStepSchema = z.object({
  step_number: z.number().int().positive(),
  action: z.string().min(1, 'Action description is required'),
  expected_result: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const testCaseSchema = z.object({
  title: z.string().min(3, 'Test title must be at least 3 characters').max(200, 'Maximum 200 characters'),
  suite_id: z.string().uuid('Invalid suite ID').optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  severity: z.enum(['blocker', 'critical', 'major', 'minor', 'trivial']).default('major'),
  type: z.enum([
    'functional',
    'integration',
    'system',
    'regression',
    'performance',
    'security',
    'recovery',
    'compatibility',
    'stress',
    'fuzz',
    'exploratory',
    'manual',
    'automated',
    'other',
  ]).default('functional'),
  preconditions: z.string().max(2000).optional().nullable(),
  test_data: z.string().max(2000).optional().nullable(),
  expected_result: z.string().min(1, 'Expected overall result is required'),
  is_regression: z.boolean().default(false),
  requirement_refs: z.string().max(500).optional().nullable(),
  status: z.enum(['active', 'draft', 'deprecated']).default('active'),
  steps: z.array(testStepSchema).default([]),
});

export const testStepResultSchema = z.object({
  step_id: z.string().uuid().optional().nullable(),
  step_number: z.number().int().positive(),
  status: z.enum(['pass', 'fail', 'blocked', 'skipped']),
  actual_result: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const testRunSchema = z.object({
  test_case_id: z.string().uuid(),
  environment_id: z.string().uuid().optional().nullable(),
  application_version: z.string().max(50).optional().nullable(),
  build_number: z.string().max(50).optional().nullable(),
  branch: z.string().max(100).optional().nullable(),
  commit_sha: z.string().max(64).optional().nullable(),
  status: z.enum(['pass', 'fail', 'blocked', 'skipped', 'in_progress']),
  duration_ms: z.number().int().nonnegative().default(0),
  actual_result: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  step_results: z.array(testStepResultSchema).default([]),
});

export const issueSchema = z.object({
  title: z.string().min(3, 'Issue title must be at least 3 characters').max(200),
  test_case_id: z.string().uuid().optional().nullable(),
  test_run_id: z.string().uuid().optional().nullable(),
  severity: z.enum(['blocker', 'critical', 'major', 'minor', 'trivial']).default('major'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('high'),
  status: z.enum(['open', 'investigating', 'in_progress', 'fixed', 'retesting', 'closed', 'rejected', 'wont_fix']).default('open'),
  assigned_to: z.string().uuid().optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
  root_cause: z.string().max(4000).optional().nullable(),
  fix_description: z.string().max(4000).optional().nullable(),
  related_commit: z.string().max(64).optional().nullable(),
  resolution: z.string().max(1000).optional().nullable(),
});

export const environmentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  os: z.string().max(100).optional().nullable(),
  cpu: z.string().max(100).optional().nullable(),
  ram: z.string().max(100).optional().nullable(),
  runtime: z.string().max(100).optional().nullable(),
  tools: z.string().max(500).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
});

export const testPlanSchema = z.object({
  name: z.string().min(2, 'Plan name must be at least 2 characters').max(100),
  description: z.string().max(1000).optional().nullable(),
  status: z.enum(['planning', 'in_progress', 'completed', 'archived']).default('planning'),
  milestone_id: z.string().uuid().optional().nullable(),
});

export const milestoneSchema = z.object({
  name: z.string().min(2, 'Milestone name is required').max(100),
  description: z.string().max(1000).optional().nullable(),
  due_date: z.string().optional().nullable(),
  status: z.enum(['in_progress', 'completed', 'delayed']).default('in_progress'),
});

export const invitationSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['admin', 'tester', 'viewer']).default('tester'),
});
