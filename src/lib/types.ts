// ==============================================================================
// TEST MANAGER PLATFORM — DOMAIN TYPES & INTERFACES
// ==============================================================================

export type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed' | 'archived';

export type ProjectRole = 'owner' | 'admin' | 'tester' | 'viewer';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';

export type TestPriority = 'critical' | 'high' | 'medium' | 'low';

export type TestSeverity = 'blocker' | 'critical' | 'major' | 'minor' | 'trivial';

export type TestType =
  | 'functional'
  | 'integration'
  | 'system'
  | 'regression'
  | 'performance'
  | 'security'
  | 'recovery'
  | 'compatibility'
  | 'stress'
  | 'fuzz'
  | 'exploratory'
  | 'manual'
  | 'automated'
  | 'other';

export type TestCaseStatus = 'active' | 'draft' | 'deprecated';

export type TestRunStatus = 'pass' | 'fail' | 'blocked' | 'skipped' | 'in_progress';

export type StepStatus = 'pass' | 'fail' | 'blocked' | 'skipped';

export type IssueStatus =
  | 'open'
  | 'investigating'
  | 'in_progress'
  | 'fixed'
  | 'retesting'
  | 'closed'
  | 'rejected'
  | 'wont_fix';

export type TestPlanStatus = 'planning' | 'in_progress' | 'completed' | 'archived';

export type MilestoneStatus = 'in_progress' | 'completed' | 'delayed';

export type SessionStatus = 'active' | 'completed';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role_title?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  owner_id: string | null;
  icon: string;
  accent_color: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // Computed / joined fields
  role?: ProjectRole;
  member_count?: number;
  test_count?: number;
  pass_rate?: number;
  open_issues_count?: number;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  invited_by: string | null;
  created_at: string;
  user?: UserProfile;
}

export interface ProjectInvitation {
  id: string;
  project_id: string;
  email: string;
  role: ProjectRole;
  token: string;
  status: InvitationStatus;
  expires_at: string;
  created_by: string | null;
  created_at: string;
  project?: {
    id: string;
    name: string;
    key: string;
  };
}

export interface Environment {
  id: string;
  project_id: string;
  name: string;
  os: string | null;
  cpu: string | null;
  ram: string | null;
  runtime: string | null;
  tools: string | null;
  description: string | null;
  is_archived: boolean;
  created_at: string;
}

export interface TestSuite {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: 'active' | 'draft' | 'archived';
  is_regression: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Computed
  test_count?: number;
}

export interface TestCase {
  id: string;
  key: string;
  project_id: string;
  suite_id: string | null;
  title: string;
  description: string | null;
  priority: TestPriority;
  severity: TestSeverity;
  type: TestType;
  preconditions: string | null;
  test_data: string | null;
  expected_result: string;
  is_regression: boolean;
  requirement_refs: string | null;
  status: TestCaseStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  suite?: TestSuite | null;
  steps?: TestStep[];
  latest_run?: TestRun | null;
  runs_count?: number;
  tags?: Tag[];
}

export interface TestStep {
  id: string;
  test_case_id: string;
  step_number: number;
  action: string;
  expected_result: string | null;
  notes: string | null;
}

export interface TestRun {
  id: string;
  run_number: number;
  test_case_id: string;
  project_id: string;
  environment_id: string | null;
  tester_id: string | null;
  executed_by?: string | null;
  application_version: string | null;
  build_number: string | null;
  branch: string | null;
  commit_sha: string | null;
  status: TestRunStatus;
  duration_ms: number;
  actual_result: string | null;
  notes: string | null;
  execution_date: string;
  created_at: string;
  // Joined
  test_case?: TestCase;
  environment?: Environment;
  tester?: UserProfile;
  step_results?: TestStepResult[];
  evidence?: Evidence[];
  linked_issue?: Issue | null;
}

export interface TestStepResult {
  id: string;
  test_run_id: string;
  step_id: string | null;
  step_number: number;
  status: StepStatus;
  actual_result: string | null;
  notes: string | null;
}

export interface Issue {
  id: string;
  issue_key: string;
  project_id: string;
  test_case_id: string | null;
  test_run_id: string | null;
  title: string;
  description: string | null;
  severity: TestSeverity;
  priority: TestPriority;
  status: IssueStatus;
  assigned_to: string | null;
  created_by: string | null;
  root_cause: string | null;
  fix_description: string | null;
  related_commit: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  test_case?: TestCase;
  test_run?: TestRun;
  assignee?: UserProfile;
  creator?: UserProfile;
  history?: IssueHistory[];
}

export interface IssueHistory {
  id: string;
  issue_id: string;
  changed_by: string | null;
  old_status: string | null;
  new_status: string;
  comment: string | null;
  created_at: string;
  user?: UserProfile;
}

export interface Evidence {
  id: string;
  project_id: string;
  test_case_id: string | null;
  test_run_id: string | null;
  issue_id: string | null;
  file_path: string;
  original_file_name: string;
  file_name?: string;
  file_type: string;
  file_size: number;
  file_size_bytes?: number;
  description: string | null;
  caption?: string | null;
  uploaded_by: string | null;
  created_at: string;
  uploader?: UserProfile;
  signed_url?: string;
}

export interface TestPlan {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: TestPlanStatus;
  milestone_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  total_tests?: number;
  completed_tests?: number;
  passed_tests?: number;
  failed_tests?: number;
  blocked_tests?: number;
}

export interface Milestone {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  due_date: string | null;
  status: MilestoneStatus;
  created_at: string;
  required_tests?: number;
  passed_tests?: number;
  failed_tests?: number;
}

export interface TestSession {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  environment_id: string | null;
  application_version: string | null;
  status: SessionStatus;
  created_by: string | null;
  started_at: string;
  ended_at: string | null;
  runs_count?: number;
  passed_count?: number;
  failed_count?: number;
}

export interface Tag {
  id: string;
  project_id: string;
  name: string;
  color: string;
}

export interface AuditLog {
  id: string;
  project_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata?: Record<string, unknown>;
  details?: Record<string, unknown>;
  created_at: string;
  user?: UserProfile;
  actor?: UserProfile;
}

export interface Notification {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// Verification Report structure matching Section 41
export interface VerificationReportData {
  project: Project;
  period: {
    start: string;
    end: string;
  };
  summary: {
    total_tests: number;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
    pass_rate: number;
    open_issues: number;
    closed_issues: number;
    total_runs: number;
  };
  suites_breakdown: Array<{
    suite: TestSuite;
    total_tests: number;
    passed: number;
    failed: number;
    blocked: number;
    pass_rate: number;
    tests: Array<{
      key: string;
      title: string;
      type: TestType;
      priority: TestPriority;
      last_run_status: TestRunStatus;
      runs_count: number;
      application_version: string | null;
      commit_sha: string | null;
      execution_date: string | null;
    }>;
  }>;
  recent_issues: Issue[];
  environments_used: Environment[];
  generated_at: string;
  generated_by: UserProfile | null;
}
