# Test Manager — AI QA Agent Protocol

This repository is integrated with **Test Manager** (https://testmanger.vercel.app).
As an AI coding agent, you have the capability and responsibility to keep verification history synchronized with the codebase.

---

## 1. Interaction Modes

### Mode A: Model Context Protocol (MCP) — Preferred & Type-Safe
When connected to the Test Manager MCP server, use these native tools directly:
* `tm_get_project_tree({ projectKey: "MORPH" })`: Inspect all test suites, cases, runs, and open bugs.
* `tm_create_or_update_test({ projectKey: "MORPH", ... })`: Add or edit test specifications.
* `tm_record_test_run({ projectKey: "MORPH", target: "1", status: "pass", ... })`: Log test execution results.
* `tm_file_defect({ projectKey: "MORPH", title: "...", severity: "critical" })`: File defects when regressions occur.
* `tm_verify_retest({ projectKey: "MORPH", issue_key: "MORPH-BUG-1", status: "pass" })`: Verify bug fixes.
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
        "TEST_MANAGER_PROJECT_KEY": "MORPH"
      }
    }
  }
}
```

---

### Mode B: Direct REST API (Fallback / Scripts)
If MCP is not active in your current session, use the REST endpoints:

* **Inspect Project Tree**:
  ```bash
  curl -s "https://testmanger.vercel.app/api/projects/MORPH/agent-sync"
  ```

* **Sync Results / Tests / Defects**:
  ```bash
  curl -X POST "https://testmanger.vercel.app/api/projects/MORPH/agent-sync" \
    -H "Content-Type: application/json" \
    -d @payload.json
  ```

---

## 2. Standard Autonomous Workflows

### 1. After writing or modifying features:
1. Generate or update corresponding test cases in Test Manager with explicit test steps.
2. Run your local test command (e.g. `npm test`).
3. Record the execution run (`status: "pass"` or `"fail"`).

### 2. When a test fails:
1. Log the test run as `"fail"` with duration and error traces.
2. File a defect (`severity: "major" | "critical" | "blocker"`).
3. Investigate and apply the fix to the source code.
4. Execute a retest targeting the defect. Passing retests automatically resolve the ticket.
