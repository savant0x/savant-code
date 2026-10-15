# Savant Agent — Full Capabilities Test

**Version:** 1.0.0
**Purpose:** Exhaustively exercise every tool, mode, phase gate, sub-agent, skill, path-safety rule, and validation path available to the Savant orchestrator. Run this prompt whenever the agent's capabilities have been changed to verify the system is production-ready.

**How to use this prompt:** Point the Savant orchestrator at this file and instruct it: *"Execute the full capabilities test in this file. Report PASS/FAIL for every test with evidence. Continue until every section is complete. Write the final report to `dev/scratchpad/agent-capabilities-test-report.md`"*.

**Quick-start for the testing agent:**
1. Read this entire file first.
2. Create a `write_todos` list with one todo per phase (Phases 1–13).
3. Use `read_files`, `code_search`, and `spawn_agents` as needed to gather evidence.
4. For every test, record: `TEST-ID`, `STATUS (PASS/FAIL/SKIP)`, `EVIDENCE`.
5. Update todos as you finish each phase.
6. Clean up temporary test artifacts at the end.
7. Write the final report to `dev/scratchpad/agent-capabilities-test-report.md`.

**Environment assumptions:**
- The test runs inside a Savant-Code/SavantFree workspace with ECHO Protocol v0.2.0 active.
- The CLI is interactive and supports the full tool set.
- `dev/fids/` and `dev/scratchpad/` exist.
- An internet connection is available for `web_search` and `read_url` tests.

**Global rules for the testing agent:**
1. Report every test with: `TEST-ID`, `STATUS (PASS/FAIL/SKIP)`, `EVIDENCE` (file path, line number, exact output, or error message).
2. Do not skip a test unless it is impossible to run in the current environment; document the reason.
3. If a test fails, continue to the next test. Do not halt the suite.
4. Use `write_todos` to track progress through the phases.
5. Preserve the git state and any user files; clean up temporary test files after each phase.
6. **Record results incrementally.** After each phase, append the phase results to `dev/scratchpad/agent-test-progress.md` using the row format: `| TEST-ID | STATUS | EVIDENCE | NOTES |`. Do not wait until the end to record evidence.

**How to enable `devMode` for Dev Override tests:**
- In the interactive CLI, run the slash command `/dev on`. Disable with `/dev off`.
- In programmatic tests, ensure the runtime sets `fileContext.devMode = true` before the test runs.
- The key observable behavior: with `devMode` active, the FSM phase gate for `write_file`/`str_replace`/`apply_patch` and the AUDIT gate for `run_terminal_command` are bypassed.

**Tests that may be skipped:**
- `read_url` / `web_search` — SKIP if the environment has no internet.
- `browser_logs` / `browser-use` — SKIP if Chrome/Chromium is not installed or no browser session exists.
- `tmux-cli` — SKIP if no tmux session is available.

**At-a-glance checklist:**
- [ ] Phase 1: Modes verified by reading `agents/savant/*.ts`.
- [ ] Phase 2: Every tool called with valid input.
- [ ] Phase 3: ECHO phase gates enforced correctly.
- [ ] Phase 4: Every sub-agent spawned and returned output.
- [ ] Phase 5: FID lifecycle works.
- [ ] Phase 6: Path safety rejects escapes and accepts exempt paths.
- [ ] Phase 7: All skills load.
- [ ] Phase 8: Dev override bypasses phase gates.
- [ ] Phase 9: Perfection Loop cycles through phases and respects circuit breaker.
- [ ] Phase 10: Sequential thinking / Thinker agent works.
- [ ] Phase 11: Typechecks and key tests pass.
- [ ] Phase 12: Error cases produce expected errors.
- [ ] Phase 13: Report written.

**Critical path (must all pass for sign-off):**
- M-01 `default` mode has the expected orchestrator tool set.
- T-07 `write_file` succeeds in GREEN phase.
- T-19 `run_terminal_command` succeeds in AUDIT phase.
- T-26 `transition_phase` succeeds for valid transitions.
- T-31 `sequentialthinking` / T-30 `think_deeply` spawns Thinker and returns reasoning.
- P-01 `write_file` in `idle` is blocked.
- P-03 `write_file` in `green` is allowed.
- P-05–P-06 exempt paths (`dev/scratchpad`, `dev/fids`) are writable in any phase.
- A-06 `thinker` agent returns a structured analysis with `<thinking>` tags.
- PL-01 Perfection Loop advances through RED → GREEN → AUDIT → COMPLETE.
- V-01..V-04 all typechecks pass.
- E-01 `spawn_agents` with invalid agent returns an error.

**Known disabled features:**
- Composio meta tools are currently disabled (`ENABLE_COMPOSIO_TOOLS = false` in `agents/savant/savant.ts`). Do not test them unless you have explicitly enabled them.
- External browser tests are optional and only run when Chrome/Chromium is available.

---

## Phase 1: Orchestrator Identity & Modes

For each Savant mode below, verify the agent can be instantiated and reports the correct identity/tool set.

| Test | Mode | Expected Behavior |
|------|------|---------------------|
| M-01 | `default` | `displayName` = "Savant the Orchestrator"; has `spawn_agents`, `read_files`, `transition_phase`, `write_file`, `str_replace`, `ask_user`, `suggest_followups` |
| M-02 | `max` | Same as default but reads more files; has `transition_phase`, `write_file`, `str_replace`, `apply_patch` |
| M-03 | `fast` | No `write_todos`, `ask_user`, `suggest_followups`; still delegates writes |
| M-04 | `free`/`lite` | Uses free-tier model; has data_collection deny; still has orchestrator tools |
| M-05 | `analyze` | Read-only: has `code_search`, `read_files`, `spawn_agents` (Detective/Scout/Thinker); does NOT have `write_file`, `str_replace`, `apply_patch`, `transition_phase` |
| M-06 | `plan` | Has `ask_user`, `spawn_agents`; does NOT have `write_file`, `str_replace`, `apply_patch` |
| M-07 | `scaffold` | Has `set_scaffold_complete`; creates one umbrella FID only |
| M-08 | `deep` | Orchestrates a 6–7 phase workflow with SPEC.md/PLAN.md; has `transition_phase` |

**Execution:**
- For each mode, read the relevant `agents/savant/*.ts` file (e.g., `savant.ts`, `savant-analyze.ts`, `savant-plan.ts`, `savant-scaffold.ts`, `savant-deep.ts`) and record the tool set.
- Verify the expected presence/absence of each tool above.

---

## Phase 2: Tool-by-Tool Functional Test

For each tool in `common/src/tools/constants.ts`, call it with a valid input and verify the result. Report PASS/FAIL per tool.

| Test | Tool | Minimal Valid Input | Expected Success Signal |
|------|------|---------------------|---------------------------|
| T-01 | `read_files` | `{ "paths": ["ECHO.md"] }` | Returns file contents |
| T-02 | `read_subtree` | `{ "paths": ["agents"] }` | Returns tree summary |
| T-03 | `list_directory` | `{ "path": "agents" }` | Returns directory entries |
| T-04 | `glob` | `{ "pattern": "agents/**/*.ts" }` | Returns matching paths |
| T-05 | `code_search` | `{ "pattern": "resolveAndContain", "flags": "-g common/src/**/*.ts" }` | Returns search results |
| T-06 | `find_files` | `{ "query": "agent runtime tool executor" }` | Returns relevant files |
| T-07 [CRITICAL] | `write_file` | Must be in GREEN phase or exempt path; write to `dev/scratchpad/tool-test.md` | File is written |
| T-08 | `str_replace` | Replace a line in `dev/scratchpad/tool-test.md` | File is updated |
| T-09 | `apply_patch` | Apply a small diff to `dev/scratchpad/tool-test.md` | File is patched |
| T-10 | `propose_write_file` | Propose writing `dev/scratchpad/proposed.md` | Proposal returned (editor best-of-n) |
| T-11 | `propose_str_replace` | Propose replacing text in `dev/scratchpad/tool-test.md` | Proposal returned (editor best-of-n) |
| T-12 [OPTIONAL] | `read_url` | `{ "url": "https://example.com" }` | Returns page text (SKIPPABLE if offline) |
| T-13 [OPTIONAL] | `web_search` | `{ "query": "OpenTUI React terminal UI" }` | Returns search results (SKIPPABLE if offline) |
| T-14 | `read_docs` | `{ "query": "React useEffect", "source": "react.dev" }` | Returns doc excerpt |
| T-15 | `skill` | `{ "name": "coding-typescript" }` | Returns skill contents |
| T-16 | `gravity_index` | `{ "action": "list_categories" }` | Returns service categories |
| T-17 | `spawn_agents` | `{ "agents": [{"agent_type": "detective", "prompt": "find tests"}] }` | Spawns Detective |
| T-18 | `spawn_agent_inline` | `{ "agent_type": "context-pruner", "params": {"maxContextLength": 400000} }` | Spawns inline context pruner |
| T-19 [CRITICAL] | `run_terminal_command` | Must be in AUDIT phase; `{ "command": "echo hello" }` | Returns `hello` |
| T-20 | `write_todos` | `{ "todos": [{"task": "test", "completed": false}] }` | Todos displayed |
| T-21 | `ask_user` | `{ "questions": [{"question": "Approve?", "options": [{"label": "Yes"}]} }` | Renders question (user may skip response) |
| T-22 | `suggest_followups` | `{ "followups": [{"prompt": "Next step", "label": "Next"}] }` | Renders followups |
| T-23 | `set_output` | `{ "data": {"status": "ok"} }` | Output stored |
| T-24 | `add_message` | `{ "role": "user", "content": "test" }` | Message added to history |
| T-25 | `set_messages` | `{ "messages": [] }` | History replaced |
| T-26 [CRITICAL] | `transition_phase` | `{"phase": "red", "reason": "test"}` in non-analyze mode | Phase transitions |
| T-27 | `update_subgoal` | `{ "id": "test", "status": "IN_PROGRESS" }` | Subgoal updated |
| T-28 | `create_plan` | `{ "path": "dev/scratchpad/test-plan.md", "plan": "test plan" }` | Plan file created |
| T-29 | `render_ui` | `{ "widget": {"type": "button", "text": "Test", "link": "https://example.com"} }` | Renders button |
| T-30 | `think_deeply` | `{ "prompt": "Think about test coverage" }` | Thinker agent spawns |
| T-31 | `sequentialthinking` | `{ "prompt": "Plan a test" }` | Thinker agent spawns |
| T-32 [OPTIONAL] | `browser_logs` | Only if browser active | Browser logs returned (SKIPPABLE if no browser session) |
| T-33 | `end_turn` | `{}` | Turn ends |
| T-34 | `task_completed` | `{}` | Task marked complete |
| T-35 | `set_scaffold_complete` | In scaffold mode | Scaffold mode ends |

---

## Phase 3: ECHO Phase Gate Tests

**Goal:** Verify that write tools are blocked outside GREEN phase and allowed inside it, and that scratchpad/FID paths are exempt.

| Test | Phase | Action | Expected |
|------|-------|--------|----------|
| P-01 | `idle` | `write_file` to `src/test.txt` | Blocked: "only available during the GREEN phase" |
| P-02 | `red` | `write_file` to `src/test.txt` | Blocked |
| P-03 | `green` | `write_file` to `src/test.txt` | Allowed (clean up after) |
| P-04 | `audit` | `write_file` to `src/test.txt` | Blocked || P-05 | `any` | `write_file` to `dev/scratchpad/any-phase.md` | Allowed (exempt path) |
| P-06 | `any` | `write_file` to `dev/fids/any-phase.md` | Allowed (exempt path) |
| P-07 | `idle` | `run_terminal_command` | Blocked: "only available during the AUDIT phase" |
| P-08 | `audit` | `run_terminal_command "echo ok"` | Allowed |
| P-09 | `analyze` | `write_file` | Tool not present; agent returns error |
| P-10 | `dev` | `write_file` to `src/test.txt` in `idle` phase with `devMode` enabled | Allowed (dev override bypasses phase gate) |

---

## Phase 4: Sub-Agent Roster Test

For each agent in the ECHO roster, spawn it with a minimal task and verify it executes without error.

| Test | Agent | Task Prompt | Expected |
|------|-------|-------------|----------|
| A-01 | `detective` | "Search for all tests of resolveAndContain" | Returns issue catalog |
| A-02 | `scout` | "Find all files related to the sidebar" | Returns file list |
| A-03 | `researcher-web` | "What is OpenTUI?" | Returns research summary |
| A-04 | `researcher-docs` | "React useEffect docs" | Returns doc summary |
| A-05 | `basher` | "Run `cd common && bun run typecheck`" | Returns command output |
| A-06 | `thinker` | "Think through the pros and cons of adding gap={1} to all sidebar components" | Returns analysis |
| A-07 | `forge` | Must be in GREEN phase; "Create a tiny test file in dev/scratchpad" | File created |
| A-08 | `verifier` | "Review the file created by forge" | Returns review |
| A-09 | `recorder` | "Create a test FID in dev/fids/" | FID created |
| A-10 | `scribe` | "Summarize this session's changes" | Returns summary |
| A-11 | `context-pruner` | (spawned automatically) | Context pruned |
| A-12 | `browser-use` | "Fetch https://example.com" | Returns page text |
| A-13 | `tmux-cli` | (if CLI interactive testing is available) | Executes command (SKIPPABLE if no tmux session available) |

**Sub-agent verification criteria:** For each spawned sub-agent, the test passes if:
- The agent runs to completion (no tool/validation error).
- The returned output contains the expected structure:
  - **Detective:** at least one issue with `file path`, `line number`, and `severity`.
  - **Scout:** a list of relevant file paths.
  - **Researcher:** a concise summary with source URLs or doc references.
  - **Basher:** the exact command output and exit code.
  - **Thinker:** `<thinking>` ... `</thinking>` tags with numbered steps and a conclusion.
  - **Forge:** the created/updated file path.
  - **Verifier:** a list of findings with at least one critical or blocking issue flagged.
  - **Recorder/Scribe:** the created/updated file path or summary text.
- No disallowed tool is called by that agent (e.g., Detective must not call `write_file`).

---

## Phase 5: FID Lifecycle

| Test | Action | Expected |
|------|--------|----------|
| FID-01 | Recorder creates a FID in `dev/fids/` | FID file exists with required metadata |
| FID-02 | Update the FID status to `in_progress` | FID status field updated |
| FID-03 | Move the FID to `dev/fids/archive/` | FID is archived |

---

## Phase 6: Path Safety & Containment

| Test | Path | Tool | Expected |
|------|------|------|----------|
| S-01 | `/etc/passwd` | `write_file` | Rejected: escapes project root |
| S-02 | `../../etc/passwd` | `write_file` | Rejected: escapes project root |
| S-03 | `dev/fids/../etc/passwd` | `write_file` | Rejected: collapses to escape |
| S-04 | `dev/scratchpad/test.md` | `write_file` | Allowed: exempt |
| S-05 | `dev/fids/test.md` | `write_file` | Allowed: exempt |
| S-06 | Absolute path to `dev/scratchpad/test.md` | `write_file` | Allowed: exempt |
| S-07 | Symlink to `/etc/passwd` | `write_file` | Rejected: symlink escape |

---

## Phase 7: Skills System

| Test | Skill | Expected |
|------|-------|----------|
| SK-01 | `coding-typescript` | Loads TypeScript conventions |
| SK-02 | `coding-python` | Loads Python conventions |
| SK-03 | `coding-rust` | Loads Rust conventions |
| SK-04 | `coding-java` | Loads Java conventions |
| SK-05 | `coding-go` | Loads Go conventions |
| SK-06 | `coding-csharp` | Loads C# conventions |
| SK-07 | `release-workflow` | Loads release workflow |

---

## Phase 8: Dev Override & FSM Bypass

| Test | Scenario | Expected |
|------|----------|----------|
| DEV-01 | Enable `devMode`, then `write_file` to `tmp/devmode-test.txt` in `idle` phase | Allowed (dev override); clean up after |
| DEV-02 | Disable `devMode`, then `write_file` to `tmp/devmode-test.txt` in `idle` phase | Blocked (phase gate active) |
| DEV-03 | With `devMode` on, `run_terminal_command` in `idle` phase | Allowed (dev override bypasses AUDIT gate) |

---

## Phase 9: Perfection Loop

**Goal:** Verify the ECHO Perfection Loop advances through phases, displays correctly in the sidebar, and respects the circuit breaker.

| Test | Action | Expected |
|------|--------|----------|
| PL-01 [CRITICAL] | Create a FID in `dev/fids/`, transition `idle` → `red` → `green` → `audit` → `self_correct` → `complete` | Each `transition_phase` succeeds and the right sidebar shows the matching phase label/color |
| PL-02 | In the sidebar, verify the Perfection Loop widget shows RED as the active phase when at least one open FID has status `created` or `analyzed` | Widget renders without overlap, current step highlighted |
| PL-03 | Verify the loop prevents invalid transitions (e.g., `idle` → `complete`) | Returns an error or is rejected by the FSM |
| PL-04 | Open more than 10 FIDs and cycle them; verify a circuit breaker/halting condition is reached (or the system degrades gracefully) | No crash; loop state remains consistent |
| PL-05 | Archive all open FIDs and confirm the loop returns to the `complete`/`idle` state | Sidebar shows loop converged |

---

## Phase 10: Sequential Thinking / Thinker Agent Deep Test

**Goal:** Verify the Thinker agent, `think_deeply`, and `sequentialthinking` produce structured reasoning and respect tool restrictions.

| Test | Action | Expected |
|------|--------|----------|
| ST-01 [CRITICAL] | Spawn the `thinker` agent with a multi-step problem (e.g., "Compare three approaches to caching in this repo") | Returns a response containing `<thinking>` ... `</thinking>` tags with numbered steps and a conclusion |
| ST-02 | Call `sequentialthinking` from the Orchestrator with a prompt that requires stepwise reasoning | Thinker agent is spawned and returns a structured answer |
| ST-03 | Call `think_deeply` with the same prompt | Returns deep reasoning; no crash |
| ST-04 | Verify `sequentialthinking` is rejected when called by a non-Thinker agent | Error: "only available to Thinker agents" |
| ST-05 | Verify the `<thinking>` block is stripped from the final user-facing output (if applicable) | Final message does not contain raw `<thinking>` tags |

---

## Phase 11: Validation Gates

| Test | Command | Expected |
|------|---------|----------|
| V-01 | `cd sdk && bun run typecheck` | Exit 0 |
| V-02 | `cd common && bun run typecheck` | Exit 0 |
| V-03 | `cd packages/agent-runtime && bun run typecheck` | Exit 0 |
| V-04 | `cd cli && bun run typecheck` | Exit 0 |
| V-05 | `bun test common/src/util/__tests__/paths.test.ts` | All pass |
| V-06 | `bun x eslint cli/src/components/right-sidebar.tsx --max-warnings 0` | Exit 0 |

---

## Phase 12: Error Handling & Edge Cases

| Test | Scenario | Expected |
|------|----------|----------|
| E-01 | Call `spawn_agents` with a non-existent agent | Error: agent does not exist |
| E-02 | Call `write_file` with missing `content` | Validation error |
| E-03 | Call `str_replace` with mismatched `oldString` | Error/patch not applied |
| E-04 | Call `read_files` with non-existent path | Error or empty result |
| E-05 | Call `run_terminal_command` with destructive command in AUDIT | Agent warns and asks user |
| E-06 | Call `transition_phase` with invalid phase | Validation error |

---

## Phase 13: Report & Cleanup

After all tests, write the report to `dev/scratchpad/agent-capabilities-test-report.md` with the following sections. You may copy the template below and fill it in.

**Cleanup — remove all temporary test artifacts:**
- `dev/scratchpad/tool-test.md`
- `dev/scratchpad/proposed.md`
- `dev/scratchpad/test-plan.md`
- `dev/scratchpad/agent-test-progress.md`
- `tmp/devmode-test.txt` (and any `tmp/` directory if created)
- Any test FIDs created in `dev/fids/` (move to `dev/fids/archive/` if they should be kept for evidence, then delete if ephemeral)
- Any files written to non-exempt source paths (e.g., `src/test.txt`) — these should NOT exist after cleanup.

**Important:** Do not delete `dev/scratchpad/agent-capabilities-test-report.md` — this is the deliverable.

**Report template:**

```markdown
# Agent Capabilities Test Report

## Summary
- **Date:**
- **Agent/Model:**
- **Total tests:**
- **PASS:**
- **FAIL:**
- **SKIP:**

## Critical Success Criteria
- [ ] All mode tests (M-01..M-08) pass.
- [ ] All core tools (T-01..T-35) pass.
- [ ] GREEN phase allows source writes; non-GREEN phases block them.
- [ ] Exempt paths (`dev/scratchpad`, `dev/fids`) are writable in any phase.
- [ ] All 9+ sub-agents spawn and execute.
- [ ] All typecheck gates (V-01..V-04) pass.

## Detailed Results
| Test ID | Section | Status | Evidence | Notes |
|---------|---------|--------|----------|-------|
| T-01    | Tools   | PASS   | `read_files` returned ECHO.md contents | - |

## Failures & Recommendations
List each FAIL/SKIP, the root cause, and the recommended fix or further investigation.

## Sign-off
The agent is / is not verified for the next run because: __________
```

---

## Appendix: Quick Reference for the Testing Agent

**Tool set to verify presence/absence:**
- Orchestrator: `spawn_agents`, `read_files`, `read_subtree`, `write_todos`, `suggest_followups`, `ask_user`, `read_url`, `skill`, `set_output`, `list_directory`, `glob`, `render_ui`, `gravity_index`, `transition_phase`, `write_file`, `str_replace`, `apply_patch`, `set_scaffold_complete` (scaffold mode).
- Read-only agents: Detective, Scout, Researcher, Verifier.
- Write agents: Forge.
- Utility agents: Basher, Thinker, Context-Pruner, Recorder, Scribe, Browser-Use, tmux-cli.

**ECHO phases:** `idle` → `red` → `green` → `audit` → `self_correct` → `complete`.

**Exempt paths (always writable):** `dev/fids/`, `dev/scratchpad/`.

**FSM rules:**
- `write_file`, `str_replace`, `apply_patch` → GREEN phase only (or exempt path / dev override / scaffold mode).
- `run_terminal_command` → AUDIT phase only.
- `sequentialthinking` → Thinker agents only.
