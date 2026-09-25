-- Migration: Add executed_by to test_runs for automated CI/CD attribution
ALTER TABLE public.test_runs
ADD COLUMN IF NOT EXISTS executed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_test_runs_executed_by ON public.test_runs(executed_by);
