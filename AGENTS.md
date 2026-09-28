# Test Manager — AI QA Agent Protocol v2.0

This repository is integrated with **Test Manager** (https://testmanger.vercel.app).
As an AI coding agent, you have the capability and responsibility to keep verification history synchronized with the codebase.

---

## 1. Interaction Modes

### Mode A: Model Context Protocol (MCP) — Preferred & Type-Safe
When connected to the Test Manager MCP server, use these native tools directly:

#### 🔍 Inspection & Coverage
* `tm_get_project_tree({ projectKey: "MORPH" })`: Inspect all test suites, cases, runs, and open bugs.
  - Optional filters: `filter_suite`, `filter_status`, `filter_priority`, `filter_run_status`
  - e.g. `tm_get_project_tree({ projectKey: "MORPH", filter_run_status: "fail" })`
* `tm_get_coverage({ projectKey: "MORPH" })`: Get pass rate, execution rate, fail/untested counts without full tree.
* `tm_list_environments({ projectKey: "MORPH" })`: List all tracked test environments (OS, CPU, runtime).

#### 🧪 Test Cases
* `tm_create_or_update_test({ projectKey: "MORPH", ... })`: Add or edit test specifications.
* `tm_delete_test({ projectKey: "MORPH", target: "3" })`: Delete a test case by index, key, or title.

#### ▶️ Test Execution
* `tm_record_test_run({ projectKey: "MORPH", target: "1", status: "pass", ... })`: Log test execution results.

#### 🐛 Bug Management
* `tm_file_defect({ projectKey: "MORPH", title: "...", severity: "critical" })`: File defects when regressions occur.
* `tm_get_issue({ projectKey: "MORPH", issue_key: "MORPH-BUG-001" })`: Fetch a single bug with full details.
* `tm_update_issue_status({ projectKey: "MORPH", issue_key: "MORPH-BUG-1", status: "in_progress", comment: "..." })`: Update status, severity, priority, or add fix description.
* `tm_add_comment({ projectKey: "MORPH", issue_key: "MORPH-BUG-1", comment: "Root cause identified..." })`: Add investigation notes without changing status.
* `tm_verify_retest({ projectKey: "MORPH", issue_key: "MORPH-BUG-1", status: "pass" })`: Verify bug fixes — passing retests automatically resolve the ticket.

#### ✅ Quality Gates
* `tm_create_signoff({ projectKey: "MORPH", gate_name: "...", decision: "approved" })`: Sign off quality gates.

To connect this project in Cursor, Claude Desktop, or Antigravity, add to your MCP config:
```json
{
  "mcpServers": {
    "testmanager": {
      "command": "node",
      "args": ["scripts/testmanager-mcp.mjs"],
      "env": {
        "TEST_MANAGER_API_URL": "https://testmanger.vercel.app",
        "TEST_MANAGER_PROJECT_KEY": "MORPH",
        "AGENT_API_KEY": "your-secret-agent-key"
      }
    }
  }
}
```

> **Security:** Set `AGENT_API_KEY` in your Vercel environment variables and match it in the MCP config above.
> The API accepts the key via `X-Agent-Key` header or `?agent_key=` query parameter.
> If `AGENT_API_KEY` is not set in the server env, the API remains open (backward compatible).

---

### Mode B: Direct REST API (Fallback / Scripts)
If MCP is not active in your current session, use the REST endpoints:

* **Inspect Project Tree**:
  ```bash
  curl -s -H "X-Agent-Key: your-key" "https://testmanger.vercel.app/api/projects/MORPH/agent-sync"
  ```

* **Filter by suite or run status**:
  ```bash
  curl -s -H "X-Agent-Key: your-key" "https://testmanger.vercel.app/api/projects/MORPH/agent-sync?filter_run_status=fail"
  ```

* **Sync Results / Tests / Defects**:
  ```bash
  curl -X POST "https://testmanger.vercel.app/api/projects/MORPH/agent-sync" \
    -H "Content-Type: application/json" \
    -H "X-Agent-Key: your-key" \
    -d @payload.json
  ```

* **Add comment to a bug**:
  ```json
  { "comments": [{ "issue_key": "MORPH-BUG-001", "comment": "Investigated — root cause is X" }] }
  ```

* **Update issue status**:
  ```json
  { "update_issues": [{ "issue_key": "MORPH-BUG-001", "status": "in_progress", "comment": "Fix in progress" }] }
  ```

---

## 2. Standard Autonomous Workflows

### 1. After writing or modifying features:
1. Generate or update corresponding test cases in Test Manager with explicit test steps.
2. Run your local test command (e.g. `npm test` or dedicated verification script).
3. Record the execution run:
   - **ONLY** record `status: "pass"` if the test was executed with 100% success and 0 errors, OR if the user explicitly confirmed it.
   - If the code has not yet been executed, leave the test case as `"untested"` or run status as `"in_progress"`. **NEVER assume a pass!**

### 2. When a test fails:
1. Log the test run as `"fail"` with duration and error traces.
2. File a defect (`severity: "major" | "critical" | "blocker"`).
3. Investigate and apply the fix to the source code.
4. Execute a retest targeting the defect. Passing retests automatically resolve the ticket.

### 3. During active investigation:
1. Use `tm_add_comment` to log investigation progress on the bug.
2. Use `tm_update_issue_status` to move the bug through `investigating → in_progress → fixed`.
3. Run `tm_get_coverage` to see overall project health at any time.

### 4. Before a release:
1. Run `tm_get_project_tree({ filter_run_status: "fail" })` to check for open failures.
2. Run `tm_get_coverage` to verify pass rate.
3. If all gates pass, submit `tm_create_signoff` with `decision: "approved"`.

---

## 3. ⚠️ Critical QA Discipline: Zero-Assumption "Pass" Rule

**NEVER mark a test run or bug retest as `pass` based on code inspection, optimism, or assumption.**
Prematurely declaring a `pass` conceals bugs, ruins test suite integrity, and creates false confidence.

### The Golden Verification Protocol:
An AI agent is strictly permitted to record `status: "pass"` **ONLY** when one of these two conditions is met:
1. **Concrete Independent Execution:** The agent executed concrete test commands (e.g. `npm test`, automated test suite, CLI commands, HTTP request verification) and observed 100% success with zero errors.
2. **Explicit User Confirmation:** The human user explicitly tested the feature/fix and told the agent it works (e.g. "it works", "it's passing now").

### Untested Code = Untested Status:
- If code has been written or modified but the agent has NOT independently run verification tests, newly authored test cases MUST remain `untested` (or run status `in_progress`), **NEVER `pass`**.
- When verifying bug fixes (`tm_verify_retest` or `tm_update_issue_status`), NEVER resolve or mark pass without running a retest that proves the failure condition is gone.

