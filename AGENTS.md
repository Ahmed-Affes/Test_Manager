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

### 1. When requested to build or modify a feature:
1. **Create a Dedicated Test Suite** named after the feature or architectural module (e.g. `Directory & Snapshot Engine`, `Authentication & Session Engine`).
2. **Break down the feature into MULTIPLE discrete Test Cases** under that suite (typically 3 to 6 test cases covering: Creation / Happy Path, Query / Inspection, Rollback / State Mutation, and Edge Cases).
   - **MANDATORY RULE:** NEVER create 1 single monolithic test case for an entire feature! Every feature MUST have multiple granular test cases.
3. **Keep newly authored test cases as `untested`** (no execution runs yet) until real execution occurs.
4. Run your local test command (e.g. `npm test` or dedicated verification script).
5. Record execution runs individually for each test case as they are verified:
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
1. **Concrete Independent Execution (Automated / Backend Tests):** The agent executed concrete test commands (e.g. `npm test`, CLI test runner, API calls, script assertions) and observed 100% success with zero errors. **When the AI can independently verify backend/code logic, it SHOULD run the test and mark `pass`** — do NOT leave easily verifiable tests as unexecuted!
2. **Explicit User Confirmation (UI/UX & Visual Testing):** For visual UI/UX, animations, styling, or workflows that an agent cannot verify 100% on its own, leave them as `untested` until the human user tests them and explicitly confirms they work.

### Untested Code = Untested Status:
- If code has been written or modified but the agent has NOT independently run verification tests, newly authored test cases MUST remain `untested` (or run status `in_progress`), **NEVER `pass`**.
- When verifying bug fixes (`tm_verify_retest` or `tm_update_issue_status`), NEVER resolve or mark pass without running a retest that proves the failure condition is gone.

---

## 4. 🧩 Test Granularity: Single-Scenario Cases vs Monolithic Anti-Pattern

**NEVER create a monolithic test case that crams multiple feature scenarios into steps of a single test case.**
Monolithic test cases destroy coverage visibility, create false 0% pass rates, and conceal which specific behavior failed.

### The Correct Hierarchy:
1. **Test Suite = The Feature / Module:** A suite (e.g. `Directory & Snapshot Engine`) groups related test cases. A suite should contain **multiple** granular test cases, not just 1 giant case.
2. **Test Case = One Specific Scenario / Behavior:** Each test case tests **ONE** discrete capability or edge case (single responsibility):
   - `Case 1`: *Create and save folder snapshot*
   - `Case 2`: *View folder history list*
   - `Case 3`: *Restore folder to older version and clean up new files*
   - `Case 4`: *Save folder while a file is being written*
3. **Test Steps = Micro-Actions for THAT Scenario:** Steps are solely the sequential commands needed to verify that *single* scenario.

### Golden Rule:
If a feature has 3 distinct behaviors (e.g. Create, List, Rollback), the agent **MUST** create 3 distinct test cases under the same suite, **NEVER** 1 test case with 3 steps.

---

## 5. 📖 Easy, Plain English Standard

**Always write test titles, descriptions, and steps in simple, everyday English.**
The dashboard must be easy and fast for anyone to read and understand without technical jargon overload.

### Good vs Bad Examples:
- ❌ **Avoid heavy jargon:** *"Deterministic Merkle root hash computation with immutable tombstone pruning"*
- ✅ **Use plain English:** *"Save folder snapshot with 3 files"*
- ❌ **Avoid heavy jargon:** *"Temporal directory traversal and inode differential reconciliation"*
- ✅ **Use plain English:** *"Restore folder to an older version and remove new files"*
- ❌ **Avoid heavy jargon:** *"Asynchronous stream concurrency contention lock verification"*
- ✅ **Use plain English:** *"Save folder while another file is actively writing"*



