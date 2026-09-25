-- ==============================================================================
-- TEST MANAGER PLATFORM — CORE DATABASE SCHEMA & RLS MIGRATION
-- Migration: 20260925000000_init_test_manager.sql
-- Philosophy: "A test result is historical information and should never be silently overwritten."
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. PUBLIC PROFILES (Mirrors auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role_title TEXT DEFAULT 'Software Engineer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backward compatibility alias
CREATE OR REPLACE VIEW public.users AS SELECT * FROM public.profiles;

-- Trigger to sync auth.users with public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. PROJECTS
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('planning', 'active', 'paused', 'completed', 'archived')),
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    icon TEXT DEFAULT 'folder',
    accent_color TEXT DEFAULT '#0284c7',
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_key ON public.projects(key);

-- 4. PROJECT MEMBERS & RBAC
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'tester' CHECK (role IN ('owner', 'admin', 'tester', 'viewer')),
    invited_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_proj_user ON public.project_members(project_id, user_id);

-- Helper function to check project membership & roles
CREATE OR REPLACE FUNCTION public.get_project_role(p_id UUID)
RETURNS TEXT AS $$
    SELECT role FROM public.project_members
    WHERE project_id = p_id AND user_id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_project_member(p_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_id = p_id AND user_id = auth.uid()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 5. PROJECT INVITATIONS
CREATE TABLE IF NOT EXISTS public.project_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'tester' CHECK (role IN ('admin', 'tester', 'viewer')),
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_invitations_token ON public.project_invitations(token);
CREATE INDEX IF NOT EXISTS idx_project_invitations_email ON public.project_invitations(email);

-- 6. ENVIRONMENTS
CREATE TABLE IF NOT EXISTS public.environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    os TEXT,
    cpu TEXT,
    ram TEXT,
    runtime TEXT,
    tools TEXT,
    description TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_environments_project ON public.environments(project_id);

-- 7. TEST SUITES
CREATE TABLE IF NOT EXISTS public.test_suites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
    is_regression BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_suites_project ON public.test_suites(project_id);

-- Backward compatibility alias
CREATE OR REPLACE VIEW public.suites AS SELECT * FROM public.test_suites;

-- 8. TEST CASES
CREATE TABLE IF NOT EXISTS public.test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    suite_id UUID REFERENCES public.test_suites(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    severity TEXT NOT NULL DEFAULT 'major' CHECK (severity IN ('blocker', 'critical', 'major', 'minor', 'trivial')),
    type TEXT NOT NULL DEFAULT 'functional' CHECK (type IN ('functional', 'integration', 'system', 'regression', 'performance', 'security', 'recovery', 'compatibility', 'stress', 'fuzz', 'exploratory', 'manual', 'automated', 'other')),
    preconditions TEXT,
    test_data TEXT,
    expected_result TEXT NOT NULL,
    is_regression BOOLEAN DEFAULT FALSE,
    requirement_refs TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'deprecated')),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (project_id, key)
);

CREATE INDEX IF NOT EXISTS idx_test_cases_project ON public.test_cases(project_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_suite ON public.test_cases(suite_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_key ON public.test_cases(key);

-- 9. TEST STEPS
CREATE TABLE IF NOT EXISTS public.test_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_case_id UUID NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
    step_number INT NOT NULL,
    action TEXT NOT NULL,
    expected_result TEXT,
    notes TEXT,
    UNIQUE (test_case_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_test_steps_case ON public.test_steps(test_case_id);

-- 10. TEST RUNS (IMMUTABLE HISTORICAL RECORDS)
CREATE TABLE IF NOT EXISTS public.test_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_number INT NOT NULL,
    test_case_id UUID NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    environment_id UUID REFERENCES public.environments(id) ON DELETE SET NULL,
    tester_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    executed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    application_version TEXT,
    build_number TEXT,
    branch TEXT,
    commit_sha TEXT,
    status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'blocked', 'skipped', 'in_progress')),
    duration_ms INT DEFAULT 0,
    actual_result TEXT,
    notes TEXT,
    execution_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (test_case_id, run_number)
);

CREATE INDEX IF NOT EXISTS idx_test_runs_case ON public.test_runs(test_case_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_project ON public.test_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON public.test_runs(status);

-- Automatic run_number sequence per test case
CREATE OR REPLACE FUNCTION public.set_next_run_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.run_number IS NULL OR NEW.run_number <= 0 THEN
        SELECT COALESCE(MAX(run_number), 0) + 1 INTO NEW.run_number
        FROM public.test_runs
        WHERE test_case_id = NEW.test_case_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_run_number ON public.test_runs;
CREATE TRIGGER trigger_set_run_number
    BEFORE INSERT ON public.test_runs
    FOR EACH ROW EXECUTE FUNCTION public.set_next_run_number();

-- 11. TEST STEP RESULTS
CREATE TABLE IF NOT EXISTS public.test_step_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id UUID NOT NULL REFERENCES public.test_runs(id) ON DELETE CASCADE,
    step_id UUID REFERENCES public.test_steps(id) ON DELETE SET NULL,
    step_number INT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'blocked', 'skipped')),
    actual_result TEXT,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_step_results_run ON public.test_step_results(test_run_id);

-- 12. ISSUES
CREATE TABLE IF NOT EXISTS public.issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_key TEXT NOT NULL,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    test_case_id UUID REFERENCES public.test_cases(id) ON DELETE SET NULL,
    test_run_id UUID REFERENCES public.test_runs(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL DEFAULT 'major' CHECK (severity IN ('blocker', 'critical', 'major', 'minor', 'trivial')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'in_progress', 'fixed', 'retesting', 'closed', 'rejected', 'wont_fix')),
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    root_cause TEXT,
    fix_description TEXT,
    related_commit TEXT,
    resolution TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (project_id, issue_key)
);

CREATE INDEX IF NOT EXISTS idx_issues_project ON public.issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_test_run ON public.issues(test_run_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON public.issues(status);

-- 13. ISSUE HISTORY
CREATE TABLE IF NOT EXISTS public.issue_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES auth.users(id),
    old_status TEXT,
    new_status TEXT NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_history_issue ON public.issue_history(issue_id);

-- 14. EVIDENCE
CREATE TABLE IF NOT EXISTS public.evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    test_case_id UUID REFERENCES public.test_cases(id) ON DELETE SET NULL,
    test_run_id UUID REFERENCES public.test_runs(id) ON DELETE SET NULL,
    issue_id UUID REFERENCES public.issues(id) ON DELETE SET NULL,
    file_path TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    description TEXT,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_project ON public.evidence(project_id);
CREATE INDEX IF NOT EXISTS idx_evidence_run ON public.evidence(test_run_id);
CREATE INDEX IF NOT EXISTS idx_evidence_issue ON public.evidence(issue_id);

-- 15. TEST PLANS & ITEMS
CREATE TABLE IF NOT EXISTS public.test_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('planning', 'in_progress', 'completed', 'archived')),
    milestone_id UUID,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.test_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_plan_id UUID NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
    test_case_id UUID NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (test_plan_id, test_case_id)
);

-- 16. MILESTONES
CREATE TABLE IF NOT EXISTS public.milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'delayed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. TEST SESSIONS & RUNS
CREATE TABLE IF NOT EXISTS public.test_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    environment_id UUID REFERENCES public.environments(id) ON DELETE SET NULL,
    application_version TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    created_by UUID REFERENCES auth.users(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.test_session_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.test_sessions(id) ON DELETE CASCADE,
    test_run_id UUID NOT NULL REFERENCES public.test_runs(id) ON DELETE CASCADE,
    UNIQUE (session_id, test_run_id)
);

-- 18. TAGS
CREATE TABLE IF NOT EXISTS public.tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#64748b',
    UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS public.test_case_tags (
    test_case_id UUID NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (test_case_id, tag_id)
);

-- 19. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_project ON public.audit_logs(project_id, created_at DESC);

-- 20. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);

-- 21. REPORT SIGNOFFS
CREATE TABLE IF NOT EXISTS public.report_signoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    role TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'conditional')),
    notes TEXT,
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_signoffs_project ON public.report_signoffs(project_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_step_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_session_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_case_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_signoffs ENABLE ROW LEVEL SECURITY;

-- 1. PROFILES POLICIES
CREATE POLICY "Public profiles viewable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 2. PROJECTS POLICIES
-- View project if member or owner
CREATE POLICY "Members can view projects"
    ON public.projects FOR SELECT
    TO authenticated
    USING (
        owner_id = auth.uid() OR
        public.is_project_member(id)
    );

-- Any authenticated user can create a project
CREATE POLICY "Authenticated users can create projects"
    ON public.projects FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

-- Owner or Admin can update project
CREATE POLICY "Owners and Admins can update project"
    ON public.projects FOR UPDATE
    TO authenticated
    USING (
        owner_id = auth.uid() OR
        public.get_project_role(id) IN ('owner', 'admin')
    );

-- Only Owner can delete project
CREATE POLICY "Only Owners can delete project"
    ON public.projects FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());

-- Automatically add project creator as 'owner' in project_members
CREATE OR REPLACE FUNCTION public.after_project_created()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner')
    ON CONFLICT (project_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_after_project_created ON public.projects;
CREATE TRIGGER trigger_after_project_created
    AFTER INSERT ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.after_project_created();

-- 3. PROJECT MEMBERS POLICIES
CREATE POLICY "Members can view project members"
    ON public.project_members FOR SELECT
    TO authenticated
    USING (public.is_project_member(project_id));

CREATE POLICY "Owners and Admins can manage members"
    ON public.project_members FOR ALL
    TO authenticated
    USING (public.get_project_role(project_id) IN ('owner', 'admin'))
    WITH CHECK (public.get_project_role(project_id) IN ('owner', 'admin'));

-- 4. PROJECT INVITATIONS POLICIES
CREATE POLICY "Members can view project invitations"
    ON public.project_invitations FOR SELECT
    TO authenticated
    USING (
        public.is_project_member(project_id) OR
        email = auth.jwt()->>'email'
    );

CREATE POLICY "Owners and Admins can create invitations"
    ON public.project_invitations FOR INSERT
    TO authenticated
    WITH CHECK (public.get_project_role(project_id) IN ('owner', 'admin'));

CREATE POLICY "Invitations can be updated (accepted/declined)"
    ON public.project_invitations FOR UPDATE
    TO authenticated
    USING (
        public.get_project_role(project_id) IN ('owner', 'admin') OR
        email = auth.jwt()->>'email'
    );

-- 5. GENERIC PROJECT RESOURCE POLICIES (Suites, Environments, Test Plans, Milestones, Tags)
-- SELECT: All project members (Owner, Admin, Tester, Viewer)
-- INSERT/UPDATE/DELETE: Owner, Admin
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY['environments', 'test_suites', 'test_plans', 'milestones', 'tags', 'test_sessions'])
    LOOP
        EXECUTE format('
            CREATE POLICY "%1$s_select_member" ON public.%1$s
                FOR SELECT TO authenticated
                USING (public.is_project_member(project_id));

            CREATE POLICY "%1$s_insert_admin" ON public.%1$s
                FOR INSERT TO authenticated
                WITH CHECK (public.get_project_role(project_id) IN (''owner'', ''admin'', ''tester''));

            CREATE POLICY "%1$s_update_admin" ON public.%1$s
                FOR UPDATE TO authenticated
                USING (public.get_project_role(project_id) IN (''owner'', ''admin''));

            CREATE POLICY "%1$s_delete_admin" ON public.%1$s
                FOR DELETE TO authenticated
                USING (public.get_project_role(project_id) IN (''owner'', ''admin''));
        ', tbl);
    END LOOP;
END $$;

-- 6. TEST CASES & TEST STEPS POLICIES
CREATE POLICY "test_cases_select" ON public.test_cases
    FOR SELECT TO authenticated
    USING (public.is_project_member(project_id));

CREATE POLICY "test_cases_insert" ON public.test_cases
    FOR INSERT TO authenticated
    WITH CHECK (public.get_project_role(project_id) IN ('owner', 'admin', 'tester'));

CREATE POLICY "test_cases_update" ON public.test_cases
    FOR UPDATE TO authenticated
    USING (public.get_project_role(project_id) IN ('owner', 'admin', 'tester'));

CREATE POLICY "test_cases_delete" ON public.test_cases
    FOR DELETE TO authenticated
    USING (public.get_project_role(project_id) IN ('owner', 'admin'));

CREATE POLICY "test_steps_select" ON public.test_steps
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.test_cases tc
        WHERE tc.id = test_steps.test_case_id AND public.is_project_member(tc.project_id)
    ));

CREATE POLICY "test_steps_modify" ON public.test_steps
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.test_cases tc
        WHERE tc.id = test_steps.test_case_id AND public.get_project_role(tc.project_id) IN ('owner', 'admin', 'tester')
    ));

-- 7. TEST RUNS & RESULTS POLICIES (Preserve Historical Records)
CREATE POLICY "test_runs_select" ON public.test_runs
    FOR SELECT TO authenticated
    USING (public.is_project_member(project_id));

CREATE POLICY "test_runs_insert" ON public.test_runs
    FOR INSERT TO authenticated
    WITH CHECK (public.get_project_role(project_id) IN ('owner', 'admin', 'tester'));

-- Updating historical runs is restricted (only creator or admin within 1 hour, or status in_progress)
CREATE POLICY "test_runs_update" ON public.test_runs
    FOR UPDATE TO authenticated
    USING (
        public.get_project_role(project_id) IN ('owner', 'admin') OR
        (tester_id = auth.uid() AND status = 'in_progress')
    );

-- Test runs are never deleted (NO DELETE POLICY for normal users)
CREATE POLICY "test_runs_delete_restricted" ON public.test_runs
    FOR DELETE TO authenticated
    USING (public.get_project_role(project_id) = 'owner');

CREATE POLICY "test_step_results_select" ON public.test_step_results
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.test_runs tr
        WHERE tr.id = test_step_results.test_run_id AND public.is_project_member(tr.project_id)
    ));

CREATE POLICY "test_step_results_insert" ON public.test_step_results
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.test_runs tr
        WHERE tr.id = test_step_results.test_run_id AND public.get_project_role(tr.project_id) IN ('owner', 'admin', 'tester')
    ));

-- 8. ISSUES & ISSUE HISTORY POLICIES
CREATE POLICY "issues_select" ON public.issues
    FOR SELECT TO authenticated
    USING (public.is_project_member(project_id));

CREATE POLICY "issues_insert" ON public.issues
    FOR INSERT TO authenticated
    WITH CHECK (public.get_project_role(project_id) IN ('owner', 'admin', 'tester'));

CREATE POLICY "issues_update" ON public.issues
    FOR UPDATE TO authenticated
    USING (public.get_project_role(project_id) IN ('owner', 'admin', 'tester'));

CREATE POLICY "issues_delete" ON public.issues
    FOR DELETE TO authenticated
    USING (public.get_project_role(project_id) IN ('owner', 'admin'));

CREATE POLICY "issue_history_select" ON public.issue_history
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.issues i
        WHERE i.id = issue_history.issue_id AND public.is_project_member(i.project_id)
    ));

CREATE POLICY "issue_history_insert" ON public.issue_history
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.issues i
        WHERE i.id = issue_history.issue_id AND public.get_project_role(i.project_id) IN ('owner', 'admin', 'tester')
    ));

-- 9. EVIDENCE POLICIES
CREATE POLICY "evidence_select" ON public.evidence
    FOR SELECT TO authenticated
    USING (public.is_project_member(project_id));

CREATE POLICY "evidence_insert" ON public.evidence
    FOR INSERT TO authenticated
    WITH CHECK (public.get_project_role(project_id) IN ('owner', 'admin', 'tester'));

CREATE POLICY "evidence_delete" ON public.evidence
    FOR DELETE TO authenticated
    USING (public.get_project_role(project_id) IN ('owner', 'admin'));

-- 10. JUNCTION TABLES & AUX POLICIES
CREATE POLICY "test_plan_items_all" ON public.test_plan_items
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.test_plans tp
        WHERE tp.id = test_plan_items.test_plan_id AND public.is_project_member(tp.project_id)
    ));

CREATE POLICY "test_session_runs_all" ON public.test_session_runs
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.test_sessions ts
        WHERE ts.id = test_session_runs.session_id AND public.is_project_member(ts.project_id)
    ));

CREATE POLICY "test_case_tags_all" ON public.test_case_tags
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.test_cases tc
        WHERE tc.id = test_case_tags.test_case_id AND public.is_project_member(tc.project_id)
    ));

-- 11. AUDIT LOGS POLICIES (Append only, never updated or deleted)
CREATE POLICY "audit_logs_select" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.is_project_member(project_id));

CREATE POLICY "audit_logs_insert" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (public.is_project_member(project_id));

-- 12. NOTIFICATIONS POLICIES
CREATE POLICY "notifications_user_access" ON public.notifications
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 13. REPORT SIGNOFFS POLICIES
CREATE POLICY "report_signoffs_select" ON public.report_signoffs
    FOR SELECT TO authenticated
    USING (public.is_project_member(project_id));

CREATE POLICY "report_signoffs_insert" ON public.report_signoffs
    FOR INSERT TO authenticated
    WITH CHECK (public.is_project_member(project_id));

-- 14. STORAGE BUCKET FOR EVIDENCE
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'evidence',
    'evidence',
    false,
    104857600, -- 100 MB max file size
    NULL -- Allow images, text, pdfs, logs, videos, json, csv
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
CREATE POLICY "Evidence bucket authenticated select"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'evidence');

CREATE POLICY "Evidence bucket authenticated insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'evidence');

CREATE POLICY "Evidence bucket authenticated delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'evidence');
