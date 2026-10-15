# Savant-Code — Comprehensive A-Z System Test v12 (Official)
# Updated: 2026-07-25 — test-and-report format, automated runner v11, FID-066/067/068/069/070/071/072, v0.0.6 release checks

**Purpose:** Exhaustive functional test of every tool, agent, FSM gate, slash command, skill, SDK behavior, provider integration, path safety, TUI component, and CLI interaction in the Savant-Code harness. This is the official regression suite for the v0.0.6 release; run it after every significant change or before the next release.

**Two-mode execution:**
1. **Automated (script):** Run `bash scripts/run-az-test.sh` first. This covers all code-level (grep/pattern-checkable) tests — Phases 1-2, 5, 7-8, 10-12, 14-25, 27-31. Produces `dev/scratchpad/az-test-results.json` and `.md`.
2. **Interactive (manual):** The tests below that require a running CLI (slash commands, TUI, `/dev`, agent spawning, FSM transitions). Run these after the script completes.

**Environment:** The test runs inside the Savant CLI with ECHO Protocol v0.2.0 active.

**Platform notes:**
- Production runs on Linux — all tests should pass cleanly on Linux.
- Windows local dev has known pre-existing platform test infrastructure issues — some SDK tool tests may fail on Windows due to mock fs/path normalization. Production behavior is correct.
- For CI, run on Linux runners.
- Run on a clean working tree if possible; document any uncommitted changes in the report.

**Test classification:**
- 🤖 **Automated (script):** `bash scripts/run-az-test.sh` — covers grep patterns, typechecks, agent roster, FID-066/067 renames.
- 🖥️ **Interactive-only:** Slash commands (`/model`, `/verify`, etc.), TUI interactions, `bun dev` startup, agent spawning.
-  **Phase-dependent:** `write_file`, `str_replace`, `run_terminal_command`, and destructive operations require `green` or `audit` phase.
- 🐧 **Linux-only (or may fail on Windows):** `read_subtree` with relative paths; use `glob` as a cross-platform fallback.

**Output destination (IMPORTANT):**
- All test reports, scratch notes, evidence screenshots, and the agent feedback file MUST be saved under `dev/scratchpad/`.
- **Do NOT save any test output to `dev/nova/`.** The `dev/nova/` channel is reserved exclusively for third-party Nova audits, not for routine test output.

**Before you start:**
1. Run `bash scripts/run-az-test.sh` and confirm all automated tests pass.
2. Confirm the CLI boots without errors (`bun dev`).
3. Confirm you can see the right sidebar with the current FSM phase and model info.
4. Keep a scratchpad note of every command/output for the final report.

---

## Phase 1: Boot & Identity (🤖 automated tests 1-2 in script)

### Test 1-2: [AUTOMATED] ECHO Protocol bootstrap + FIDs scan
These are covered by `bash scripts/run-az-test.sh` (Tests T1, T2). Review the script output for PASS/FAIL.

### Test 3: Phase display (🖥️ interactive)
Observe the right sidebar after the CLI boots.
**Expected:** The current FSM phase is visible. When no work is in progress it should be `idle`.

### Test 4: Model metadata awareness (🖥️ interactive, FID-054)
Start a new chat and ask the agent: "What model are you running on, and what is its context window?"
**Expected:** The agent reports the actual model selected in the CLI/model picker, including provider and context-window info. It should NOT claim a hardcoded model such as `anthropic/claude-opus-4.8`.

### Test 5: Direct-provider mode (🖥️ interactive)
If the environment has `DIRECT_PROVIDER=openrouter` and `INFERENCE_BASE_URL` set, boot the CLI without a valid `SAVANT_CODE_API_KEY`.
**Expected:** The CLI boots and routes inference directly to the provider. No backend ping or auth failure blocks startup.

---

## Phase 2: Direct Tools (🤖 automated tests in script)

> The automated script covers Tests 6-16 (read tools, detective searches, run_readonly_command). The interactive tests below require a running CLI.

### Test 6-16: [AUTOMATED] Read tools, detective searches, run_readonly_command
These are covered by `bash scripts/run-az-test.sh` (Tests T6-T16). Review the script output.

### Test 17-21: Write tools (🖥️ interactive, FID-bound)
**Prerequisite:** Create or open a FID first, then transition to `green` phase. The Orchestrator can write to scratchpad/FID paths only when a FID is open (or dev override is active).
```text
transition_phase    {"phase":"red"}
transition_phase    {"phase":"green"}   # Requires an open FID
write_file          dev/scratchpad/test-tool-write.txt  "hello"
read_files          dev/scratchpad/test-tool-write.txt
transition_phase    {"phase":"audit"}
run_terminal_command: { "command": "rm dev/scratchpad/test-tool-write.txt", "process_type": "SYNC" }
```
**Expected:** `write_file` succeeds in `green`; `read_files` returns the content; the file can be removed in `audit` via `run_terminal_command`.

### Test 22-26: FSM transitions (🖥️ interactive)
```text
transition_phase    {"phase":"red"}
transition_phase    {"phase":"green"}
transition_phase    {"phase":"audit"}
transition_phase    {"phase":"complete"}
transition_phase    {"phase":"audit"}   # Should FAIL: cannot go complete→audit
```
**Expected:** The first four transitions succeed; the last one is rejected as an invalid FSM transition.

### Test 27-29: Illegal FSM transitions (🖥️ interactive)
```text
transition_phase    {"phase":"green"}   # from idle → should FAIL
transition_phase    {"phase":"green"}   # from audit → should FAIL
transition_phase    {"phase":"red"}     # from complete → should FAIL
```

---

## Phase 3: Dev Override (🖥️ interactive, FID-003)

> **Note:** `/dev` no longer requires a passphrase. It is a secret slash command not shown in `/help` or autocomplete.

### Test 29-32: Dev mode activation (no password)
```bash
/dev on
/dev on    # Should report "Dev override is already active."
/dev off   # Should report "Dev override deactivated."
/dev off   # Should report "Dev override is already off."
/dev       # Bare `/dev` should activate dev override (same as `/dev on`)
/dev off   # Deactivate
```

### Test 33: Unknown /dev subcommand
```bash
/dev password
```
**Expected:** Reports unknown subcommand and suggests `/dev on` / `/dev off`.

---

## Phase 4: Slash Commands (🖥️ interactive)

> These are actual CLI slash commands from `cli/src/data/slash-commands.ts` and `cli/src/commands/command-registry.ts`. Run them by typing into the chat input.

### Test 34-43: Available slash commands
Run each command below and confirm it does not crash. Capture the behavior:
```bash
/model  # Opens the model picker or shows current model / fallback
/theme:toggle
/new
/bash echo hello  # Expected: the CLI runs `echo hello` and prints `hello`
/help
/plan
/review
/history
/copy
/diagnostics
/verify  # Runs all four workspace typechecks concurrently and reports PASS/FAIL
/exit   # Optional — run last, it quits the CLI
```

### Test 44: /model free-text selection
```bash
/model openai/gpt-4o
```
**Expected:** Model preference is updated and a system message confirms the switch (or falls back gracefully if the catalog is unavailable).

### Test 45: /verify slash command (FID-065)
Run each variant and record the result:
```bash
/verify
/verify cli
/verify unknown
```
**Expected:**
- `/verify` runs typechecks for `sdk`, `common`, `packages/agent-runtime`, and `cli` concurrently and prints a PASS/FAIL summary.
- `/verify cli` runs only the `cli` typecheck and reports its result.
- `/verify unknown` reports an invalid workspace and lists valid workspaces.

---

## Phase 5: Agent Roster (🤖 automated tests in script)

> The automated script covers Tests 46-59 (agent file existence, tool sets, code-reviewer-kimi retirement). Review the script output.

For each agent below, verify it exists in the codebase and has the correct `toolNames`:

| # | Agent | File | Verify |
|---|-------|------|--------|
| 1 | Orchestrator (Savant) | `agents/savant/savant.ts` | Has `spawn_agents`, `read_files`, `write_file`, `str_replace`, `transition_phase`, etc. |
| 2 | Detective | `agents/detective/detective.ts` | `code_search`, `set_output`, `list_directory`, `glob`, `read_files`, `read_subtree`; no write tools |
| 3 | Forge | `agents/forge/forge.ts` | `write_file`, `str_replace`, `set_output`; no bash |
| 4 | Verifier | `agents/verifier/verifier.ts` | `toolNames: []` (read-only review, inherits parent prompt); contains the ECHO Audit Checklist |
| 5 | Recorder | `agents/recorder/recorder.ts` | `write_file`, `read_files`, `glob`, `code_search`, `set_output` |
| 6 | Thinker | `agents/thinker/thinker.ts` | `sequentialthinking` |
| 7 | Scout | `agents/scout/scout.ts` | `glob`, `list_directory`, `read_files`, `read_subtree`, `set_output`; no write tools |
| 8 | Researcher | `agents/researcher/researcher-web.ts` and `researcher-docs.ts` | `web_search`, `read_url` (web); `read_docs` (docs) |
| 9 | Scribe | `agents/scribe/scribe.ts` | `read_files`, `write_file`, `glob`, `code_search`, `set_output` |

> **Note:** `code-reviewer-kimi` is fully retired (only present in blacklists and comments). Use `code-reviewer-mimo` if needed as an orchestrator subagent.

```bash
spawn detective: { "searchQueries": [{ "pattern": "toolNames:", "flags": "agents/savant/savant.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "toolNames:", "flags": "agents/detective/detective.ts -n" }] }
# ... etc for all 9
```

---

## Phase 6: Scout file-finding (🖥️ interactive, FID-007 F-A)

Spawn the `scout` agent directly with specific file patterns or directory hints:
```text
spawn scout with prompt: "Find auth-related files. Use glob for patterns like *auth*.ts and list_directory on cli/src. Return the full file paths."
spawn scout with prompt: "Locate test prompt files in dev/test-prompts/. Use list_directory and glob for *.md. Return the full file paths."
spawn scout with prompt: "Search open FID documents in dev/fids/ matching FID-*.md. Use glob and read_files. Return the full file paths and summaries."
```
**Expected:** Scout returns up to 12 relevant file paths with short summaries for each.

---

## Phase 7: MCP proxy timeout (🤖 automated test in script)

> The automated script covers Test 50 (withTimeout check). Review the script output.

### Test 50-52: Timeout behavior
```bash
spawn detective: { "searchQueries": [{ "pattern": "withTimeout", "flags": "common/src/mcp/client.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "clientTimeouts", "flags": "common/src/mcp/client.ts -n" }] }
```
**Expected:** Verify `withTimeout` is used for connect, listTools, and callTool; confirm timeout values are configurable.

---

## Phase 8: FSM phase inheritance (🤖 automated tests in script)

> The automated script covers Tests 53-54 (createAgentState, fsmPhase). Review the script output.

### Test 53-55: Subagent inheritance
```bash
spawn detective: { "searchQueries": [{ "pattern": "createAgentState", "flags": "packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "fsmPhase", "flags": "packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts -n" }] }
```
**Expected:** Subagents inherit `fsmPhase` from the parent agent state.

---

## Phase 9: Perfection Loop + circuit breaker (🖥️ interactive)

### Test 56-59: FSM gates
```text
# Optional / advanced: open 10+ FIDs and cycle them to confirm the hard stop at 10 iterations.
# If not performed, document "skipped" with a reason.
```

---

## Phase 10: FID-013 v3 path safety (🤖 automated tests in script)

> The automated script covers Tests 60-64 (resolveAndContain in all handler files). Review the script output.

### Test 60-64: Path safety
```bash
spawn detective: { "searchQueries": [{ "pattern": "resolveAndContain", "flags": "common/src/util/paths.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "resolveAndContain", "flags": "packages/agent-runtime/src/tools/handlers/tool/write-file.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "resolveAndContain", "flags": "packages/agent-runtime/src/tools/handlers/tool/str-replace.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "resolveAndContain", "flags": "packages/agent-runtime/src/tools/handlers/tool/apply-patch.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "resolveAndContain", "flags": "packages/agent-runtime/src/tools/tool-executor.ts -n" }] }
```

---

## Phase 11: FID-014 v2 SDK-side realpath (🤖 automated tests in script)

> The automated script covers Tests 65-69 (resolveAndContain + realpathFn in SDK files). Review the script output.

### Test 65-69: SDK-side realpath wiring
```bash
spawn detective: { "searchQueries": [{ "pattern": "resolveAndContain", "flags": "sdk/src/tools/change-file.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "resolveAndContain", "flags": "sdk/src/tools/apply-patch.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "realpathFn", "flags": "common/src/util/paths.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "realpathFn", "flags": "sdk/src/tools/change-file.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "realpathFn", "flags": "sdk/src/tools/apply-patch.ts -n" }] }
```

### Test 70-72: SDK path safety test coverage
```bash
# Verify the change-file test asserts path-escape rejection
spawn detective: { "searchQueries": [{ "pattern": "rejects absolute paths outside the project", "flags": "sdk/src/__tests__/change-file.test.ts -n" }] }
```

---

## Phase 12: Skills system (🤖 automated test in script)

> The automated script covers Test 73 (skills directory check). Review the script output.

### Test 73-80: 7 coding standards as skills
```bash
list_directory tool: .agents/skills
spawn detective: { "searchQueries": [{ "pattern": "skill", "flags": "cli/src/chat.tsx -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "skill", "flags": "cli/src/utils/settings.ts -n" }] }
```
**Expected:** The 7 skills present: `coding-typescript`, `coding-python`, `coding-rust`, `coding-java`, `coding-go`, `coding-csharp`, `release-workflow`.

---

## Phase 13: CLI/TUI edge cases (🖥️ interactive, Master TUI Rebuild)

### Test 81-87: TUI behavior
- Open chat → see right sidebar with FSM phase and model info.
- Type a message → submit.
- Press Ctrl+C → graceful exit.
- Press `/` → slash command palette renders inline above the input; Escape closes it.
- Navigate history with arrow keys.
- Test tab completion for paths.
- Verify the right sidebar shows the actual model context window after the gateway catalog loads (not a hardcoded 200k).

### Test 88: Command palette (FID-033d)
In the chat input type `/` or a slash command prefix.
**Expected:** The native OpenTUI `<select>` command palette renders inline above the input without hiding the input. Escape closes it.

### Test 89: Toast system (FID-033d)
Trigger an action that should produce a toast (e.g., invalid `/dev` subcommand).
**Expected:** A toast appears in the bottom-right, can be dismissed, and does not stack beyond `MAX_TOASTS`.

### Test 90: Theme toggle
```bash
/theme:toggle
```
**Expected:** Theme switches between dark and light; sidebar and syntax highlighting update accordingly.

---

## Phase 14: Knowledge files (🤖 automated tests in script)

> The automated script covers Tests 91-92 (LEARNINGS.md existence, LEARNINGS in scribe.ts). Review the script output.

### Test 91-95: LEARNINGS wiring
```bash
read_files tool: dev/LEARNINGS.md
spawn detective: { "searchQueries": [{ "pattern": "LEARNINGS", "flags": "agents/scribe/scribe.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "KNOWLEDGE_FILE_NAMES", "flags": "common/src/constants/knowledge.ts -n" }] }
```

---

## Phase 15: Typecheck + Tests (🤖 automated tests in script)

> The automated script covers Tests 96-99 (x4 workspace typechecks). Review the script output.

### Test 96-100: Build state
```bash
run_readonly_command: { "command": "bun run typecheck", "cwd": "sdk" }
run_readonly_command: { "command": "bun run typecheck", "cwd": "common" }
run_readonly_command: { "command": "bun run typecheck", "cwd": "packages/agent-runtime" }
run_readonly_command: { "command": "bun run typecheck", "cwd": "cli" }
run_readonly_command: { "command": "bun test common/src/util/__tests__/paths.test.ts" }
```

---

## Phase 16: Rebrand readiness check (🤖 automated tests in script)

> The automated script covers Tests 101, 104-105 (Savant branding count, CHANGELOG branding, code-reviewer-kimi retirement). Review the script output.

### Test 101-105: Branding consistency
```bash
# Verify "Savant" branding throughout
spawn detective: { "searchQueries": [{ "pattern": "Savant", "flags": "cli/src/ -g *.tsx -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "savant-free", "flags": "cli/src/ -g *.tsx -n" }] }
# Savant count should be >> savant-free count (rebrand complete)

spawn detective: { "searchQueries": [{ "pattern": "ECHO", "flags": "ECHO.md -n" }] }
read_files tool: CHANGELOG.md  # Check for "Savant" branding in recent entries
```

---

## Phase 17: Verifier Spawn Frequency (🤖 automated test in script + 🖥️ interactive)

> The automated script covers Test 106 (verifier in savant.ts). The interactive tests below require a running CLI.

**Purpose:** Determine whether the Verifier agent is actually spawned during normal code-change flows based on the objective trigger criteria.

### Test 106: Search for reviewer spawns in source
```bash
spawn detective: { "searchQueries": [{ "pattern": "verifier", "flags": "agents/savant/savant.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "spawn_agents", "flags": "packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "code-reviewer-kimi", "flags": "agents/savant/savant.ts -n" }] }
```
**Expected evidence to capture:**
- List every location where `verifier` is referenced.
- Confirm `code-reviewer-kimi` is fully retired (should only appear in blacklists or comments, not in spawn logic).
- Note the objective trigger criteria: 10+ lines, 2+ files, new API, security, user request, Forge usage.

### Test 107: Trigger a code change and observe spawned subagents
Perform a trivial, safe edit via the agent (e.g., write a comment to a scratch file in `dev/scratchpad/`).
**Expected:** The agent's own step summary lists every spawned subagent. Record whether the Verifier appeared.

### Test 108: Document policy recommendation
If the Verifier is not spawned for trivial changes, record: "Reviewer correctly skipped for trivial changes (< 10 lines, single file, no new imports)."
If spawned, record the exact trigger condition and frequency.

---

## Phase 18: Provider integration (🤖 automated test in script + 🖥️ interactive)

> The automated script covers Test 109 (gateway catalog hooks). The interactive test below requires a running CLI.

### Test 109-111: OpenRouter gateway cache and reactive catalog
```bash
spawn detective: { "searchQueries": [{ "pattern": "fetchGatewayModels", "flags": "cli/src/index.tsx -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "subscribeGatewayCatalog", "flags": "cli/src/utils/openrouter-models.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "useGatewayCatalogStore", "flags": "cli/src/chat.tsx -n" }] }
```
**Expected:**
- Boot warms the gateway catalog non-blockingly.
- The catalog supports subscriptions so the sidebar refreshes when it loads.
- `use-send-message.ts` resolves the effective model and looks it up in the cached catalog.

### Test 112: Dynamic model metadata injection
Ask the agent: "What model am I running, what is its context window, and what provider is it from?"
**Expected:** The answer uses the live gateway catalog data, not a hardcoded string.

---

## Phase 19: Hybrid Mode (🤖 automated tests in script + 🖥️ interactive)

> The automated script covers Tests 113, 115 (primary coder, Forge threshold). The interactive test below requires a running CLI.

**Purpose:** Verify that Savant can write code directly without spawning Forge, and that Forge is only used for complex tasks.

### Test 113: Hybrid Mode system prompt
```bash
spawn detective: { "searchQueries": [{ "pattern": "primary coder", "flags": "agents/savant/savant.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "write code directly", "flags": "agents/savant/savant.ts -n" }] }
```
**Expected:** System prompt says "You are the primary coder — write code directly using write_file and str_replace."

### Test 114: Hybrid Mode instructions
```bash
spawn detective: { "searchQueries": [{ "pattern": "write ALL code changes directly", "flags": "agents/savant/savant.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "Hybrid Mode", "flags": "agents/savant/savant.ts -n" }] }
```
**Expected:** Instructions say "Write ALL code changes directly using write_file and str_replace" for most tasks.

### Test 115: Forge only for complex tasks
```bash
spawn detective: { "searchQueries": [{ "pattern": "Spawn Forge only", "flags": "agents/savant/savant.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "> 3 files AND requires new imports", "flags": "agents/savant/savant.ts -n" }] }
```
**Expected:** Forge is only spawned for complex changes (> 3 files + new APIs, novel architecture, verification fails twice, user requests Forge).

### Test 116: Direct writing test
Ask the agent: "Write a simple comment to test-sandbox/src/comment.ts saying '// Hybrid mode test'"
**Expected:** Agent writes the file directly using `write_file` without spawning Forge.

---

## Phase 20: Verifier Trigger Criteria (🤖 automated tests in script + 🖥️ interactive)

> The automated script covers Tests 117, 119 (trigger criteria, noReview gating). The interactive tests below require a running CLI.

### Test 117: Objective trigger criteria in prompt
```bash
spawn detective: { "searchQueries": [{ "pattern": "Verifier trigger", "flags": "agents/savant/savant.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "objective criteria", "flags": "agents/savant/savant.ts -n" }] }
```
**Expected:** Prompt contains the objective criteria and skip rule.

### Test 118: Skip criteria
```bash
spawn detective: { "searchQueries": [{ "pattern": "Skip Verifier only", "flags": "agents/savant/savant.ts -n" }] }
```
**Expected:** "Skip Verifier only when change is < 10 lines AND single file AND no new imports."

### Test 119: noReview flag gating
```bash
spawn detective: { "searchQueries": [{ "pattern": "!noReview", "flags": "agents/savant/savant.ts -n" }] }
```
**Expected:** The Verifier trigger instruction is gated behind `!noReview` so fast mode skips it.

### Test 120: Trivial change test
Ask the agent: "Fix the typo in test-sandbox/src/comment.ts — change 'Hybird' to 'Hybrid'"
**Expected:** Agent fixes the typo (< 10 lines, single file, no new imports) WITHOUT spawning Verifier.

### Test 121: Non-trivial change test
Ask the agent: "Add a new function `calculateSum` to test-sandbox/src/utils.ts that takes an array of numbers and returns their sum, with proper error handling and tests"
**Expected:** Agent spawns Verifier after implementation (new function added).

---

## Phase 21: Audit Checklist in Verifier (🤖 automated tests in script)

> The automated script covers Tests 122, 122b (Audit Checklist, Law references). Review the script output.

### Test 122: Audit Checklist in Verifier prompt
```bash
spawn detective: { "searchQueries": [{ "pattern": "ECHO Audit Checklist", "flags": "agents/verifier/verifier.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "No magic numbers", "flags": "agents/verifier/verifier.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "Law 14", "flags": "agents/verifier/verifier.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "Law 6", "flags": "agents/verifier/verifier.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "Law 5", "flags": "agents/verifier/verifier.ts -n" }] }
```
**Expected:** Verifier's instructionsPrompt contains the 6-item ECHO Audit Checklist.

### Test 123: Checklist items not duplicated with Guidelines
```bash
spawn detective: { "searchQueries": [{ "pattern": "dead code", "flags": "agents/verifier/verifier.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "missing imports", "flags": "agents/verifier/verifier.ts -n" }] }
```
**Expected:** "dead code" and "missing imports" appear only in the Guidelines section, NOT in the Audit Checklist.

---

## Phase 22: Batch Operations (🤖 automated test in script + 🖥️ interactive)

> The automated script covers Test 124 (batch ops instruction). The interactive test below requires a running CLI.

### Test 124: Batch operations instruction
```bash
spawn detective: { "searchQueries": [{ "pattern": "Batch operations", "flags": "agents/savant/savant.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "write ALL files first", "flags": "agents/savant/savant.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "run typecheck/lint ONCE", "flags": "agents/savant/savant.ts -n" }] }
```
**Expected:** Instructions say: "When making multiple related file changes, write ALL files first, then run typecheck/lint ONCE at the end."

### Test 125: Batch operations test
Ask the agent: "Create test-sandbox/src/math.ts with add, subtract, multiply functions and test-sandbox/src/math.test.ts with tests for all three"
**Expected:** Agent writes both files, then runs verification once (not after each file).

---

## Phase 23: Smart Phase Transitions (🤖 automated tests in script)

> The automated script covers Tests 126-127 (section presence, Law 3). Review the script output.

### Test 126: Smart Phase Transitions section
```bash
spawn detective: { "searchQueries": [{ "pattern": "Smart Phase Transitions", "flags": "agents/savant/savant.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "Skip When", "flags": "agents/savant/savant.ts -n" }] }
```
**Expected:** Section contains skip-when table for RED, GREEN deliberation, and Full AUDIT phases.

### Test 127: Law 3 never skipped
```bash
spawn detective: { "searchQueries": [{ "pattern": "Law 3 is NEVER skipped", "flags": "agents/savant/savant.ts -n" }] }
```
**Expected:** "Law 3 (Verify Before Proceed) is NEVER skipped — verification always happens."

### Test 128: Skip RED when issues known
```bash
spawn detective: { "searchQueries": [{ "pattern": "Issues already known", "flags": "agents/savant/savant.ts -n" }] }
```
**Expected:** RED can be skipped when "Issues already known from prior analysis."

### Test 129: Skip GREEN deliberation for obvious fixes
```bash
spawn detective: { "searchQueries": [{ "pattern": "Fix is obvious", "flags": "agents/savant/savant.ts -n" }] }
```
**Expected:** GREEN deliberation can be skipped when "Fix is obvious (typo, missing import, constant change)."

### Test 130: Skip AUDIT for trivial changes
```bash
spawn detective: { "searchQueries": [{ "pattern": "Change is < 10 lines", "flags": "agents/savant/savant.ts -n" }] }
```
**Expected:** Full AUDIT can be skipped when "Change is < 10 lines AND single file AND typecheck/lint already pass inline."

---

## Phase 24: Parallel Agent Batching (🤖 automated test in script)

> The automated script covers Test 131 (parallel batching instruction). Review the script output.

### Test 131: Parallel agent batching instruction
```bash
spawn detective: { "searchQueries": [{ "pattern": "Parallel agent batching", "flags": "agents/savant/savant.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "fire them ALL in a single", "flags": "agents/savant/savant.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "Promise.allSettled", "flags": "agents/savant/savant.ts -n" }] }
```
**Expected:** Instructions say: "When spawning multiple agents that don't depend on each other, fire them ALL in a single spawn_agents call — they run in parallel via Promise.allSettled."

### Test 132: Dependency table
```bash
spawn detective: { "searchQueries": [{ "pattern": "Independent agents", "flags": "agents/savant/savant.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "Dependent agents", "flags": "agents/savant/savant.ts -n" }] }
```
**Expected:** Table shows independent and dependent agent groups.

### Test 133: Sequencing guidance updated
```bash
spawn detective: { "searchQueries": [{ "pattern": "Sequence agents when needed", "flags": "agents/savant/savant.ts -n" }] }
```
**Expected:** "Only sequence agents when there are data dependencies."

---

## Phase 25: Double Audit Enforcement (🤖 automated tests in script)

> The automated script covers Tests 134-135 (Double Audit, self-reporting prohibition). Review the script output.

### Test 134: Double Audit documentation in ECHO.md
```bash
spawn detective: { "searchQueries": [{ "pattern": "Double Audit", "flags": "ECHO.md -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "bashers.*static analysis", "flags": "ECHO.md -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "Verifier.*code review", "flags": "ECHO.md -n" }] }
```
**Expected:** ECHO.md documents: "Method 1: bashers (typecheck/lint) — static analysis" and "Method 2: Verifier — independent code review."

### Test 135: Self-reporting prohibition
```bash
spawn detective: { "searchQueries": [{ "pattern": "Self-reporting is prohibited", "flags": "ECHO.md -n" }] }
```
**Expected:** "Self-reporting is prohibited. The Orchestrator that writes code must not be the one to verify it."

### Test 136: Verifier trigger criteria in ECHO.md
```bash
spawn detective: { "searchQueries": [{ "pattern": "Verifier Trigger Criteria", "flags": "ECHO.md -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "objective", "flags": "ECHO.md -n" }] }
```
**Expected:** ECHO.md contains the objective Verifier trigger criteria table matching savant.ts.

---

## Phase 26: bun dev startup (🖥️ interactive, FID-055)

### Test 137: bun dev starts successfully
Start the CLI dev server manually or run the startup command in a terminal.
**Expected:** CLI boots without "Expected ';'" errors. Prebuild step completes successfully.

### Test 138: Prebuild agents step
```text
spawn detective: { "searchQueries": [{ "pattern": "prebuild-agents", "flags": "scripts/ -n" }] }
```
**Expected:** The prebuild step (`scripts/prebuild-agents.ts`) runs without template literal syntax errors.

---

## Phase 27: Legacy Template Type Cleanup (🤖 automated tests in script)

> The automated script covers Tests 139-142 (dead types removed, baseAgentSubagents, ORCHESTRATOR_IDS, dead personas). Review the script output.

**Purpose:** Verify that 10 dead entries were removed from `AgentTemplateTypeList` in both `common/src/types/session-state.ts` and `agents/types/secret-agent-definition.ts`, and that `baseAgentSubagents` was updated to use live agent IDs.

### Test 139: Dead template types removed
```bash
spawn detective: { "searchQueries": [{ "pattern": "AgentTemplateTypeList", "flags": "common/src/types/session-state.ts -n -A 15" }] }
spawn detective: { "searchQueries": [{ "pattern": "AgentTemplateTypeList", "flags": "agents/types/secret-agent-definition.ts -n -A 15" }] }
```
**Expected:** Both lists contain ONLY: `thinker`, `scout`, `verifier`, `forge`, `recorder`, `scribe`, `ask`, `planner`, `dry_run`, `file_explorer`, `researcher`, `code_searcher`. No `base`, `base_free`, `base_max`, `base_lite`, `base_experimental`, `claude4_gemini_thinking`, `superagent`, `base_agent_builder`, `file_picker`, `reviewer`, `example_programmatic`, or `dry_run` duplicates.

### Test 140: baseAgentSubagents updated
```bash
spawn detective: { "searchQueries": [{ "pattern": "baseAgentSubagents", "flags": "packages/agent-runtime/src/templates/types.ts -n -A 5" }] }
```
**Expected:** Contains `scout`, `thinker`, `verifier`. No `file_picker`, `reviewer`, or `researcher`.

### Test 141: ORCHESTRATOR_IDS replaces startsWith('base')
```bash
spawn detective: { "searchQueries": [{ "pattern": "ORCHESTRATOR_IDS", "flags": "cli/src/utils/local-agent-registry.ts -n -B 1 -A 5" }] }
spawn detective: { "searchQueries": [{ "pattern": "startsWith\('base'\)", "flags": "cli/src/utils/local-agent-registry.ts -n" }] }
```
**Expected:** `ORCHESTRATOR_IDS` is a module-level `Set` containing `savant`, `savant-free`, `savant-lite`, `savant-max`, `savant-plan`, `savant-analyze`. Zero matches for `startsWith('base')`.

### Test 142: Dead personas removed from AGENT_PERSONAS
```bash
spawn detective: { "searchQueries": [{ "pattern": "AGENT_PERSONAS", "flags": "common/src/constants/agents.ts -n -A 20" }] }
```
**Expected:** No `base` or `agent-builder` persona entries. Remaining personas are for live agents only.

---

## Phase 28: Rename Legacy Aliases (🤖 automated tests in script)

> The automated script covers Tests 143-148 (file_picker/reviewer removal, free-agents preservation, production code checks). Review the script output.

**Purpose:** Verify that `file_picker` → `scout` and `reviewer` → `verifier` renames are complete across the codebase, and that `file-picker-max` / `file-lister` were NOT accidentally renamed.

### Test 143: No file_picker in type definitions
```bash
spawn detective: { "searchQueries": [{ "pattern": "file_picker|file-picker", "flags": "common/src/types/session-state.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "file_picker|file-picker", "flags": "agents/types/secret-agent-definition.ts -n" }] }
```
**Expected:** Zero matches in both files (legacy aliases fully removed).

### Test 144: No reviewer in type definitions
```bash
spawn detective: { "searchQueries": [{ "pattern": "reviewer", "flags": "common/src/types/session-state.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "reviewer", "flags": "agents/types/secret-agent-definition.ts -n" }] }
```
**Expected:** Zero matches in both files.

### Test 145: free-agents.ts preserved correctly
```bash
spawn detective: { "searchQueries": [{ "pattern": "file-picker-max|file-lister", "flags": "common/src/constants/free-agents.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "scout", "flags": "common/src/constants/free-agents.ts -n" }] }
```
**Expected:** `file-picker-max` and `file-lister` still present (different agents, NOT renamed). `scout` present as the renamed alias.

### Test 146: spawn-agents.ts description updated
```bash
spawn detective: { "searchQueries": [{ "pattern": "Directories to search within", "flags": "common/src/tools/params/tool/spawn-agents.ts -n" }] }
```
**Expected:** Description says `scout` (not `file-picker`).

### Test 147: No stale file_picker in production code
```bash
spawn detective: { "searchQueries": [{ "pattern": "file_picker|file-picker", "flags": "packages/agent-runtime/src/ -g *.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "file_picker|file-picker", "flags": "cli/src/ -g *.ts -n" }] }
```
**Expected:** Zero matches in production code (only test mock data and comments may remain).

### Test 148: No stale reviewer in production code
```bash
spawn detective: { "searchQueries": [{ "pattern": "reviewer", "flags": "packages/agent-runtime/src/ -g *.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "reviewer", "flags": "cli/src/ -g *.ts -n" }] }
```
**Expected:** Zero matches in production code.

---

## Agent input

When you complete your entire run, create another report from **YOUR viewpoint** as the operator. Save it to `dev/scratchpad/agent-feedback-<YYYYMMDD>.md` and include:

1. **Pain points:** Anything that slowed you down, confused you, or felt broken.
2. **Tool failures:** Which tools failed, why, and what error text you saw. Include exact messages.
3. **Wasted steps:** Commands or tool calls that gave no useful information.
4. **Missing context:** Files, docs, or state you wish had been available up front.
5. **Workflow friction:** Anything about the FSM, slash commands, or UI that made testing harder.
6. **Quality of outputs:** Which outputs were excellent, which were noisy, and which were wrong.
7. **Suggestions:** Concrete changes to prompts, tools, or the CLI that would make your job easier.
8. **One thing to add/remove to this test prompt:** Based on this run, what single test or check should be added, removed, or changed?

**Reminder:** Save all outputs to `dev/scratchpad/`. Do not use `dev/nova/`.

---

## Phase 29: ECHO Compliance — Type Safety, Lint Zero-Warnings, Utility Deduplication (v0.0.6)

### Test 149-156: ECHO Law 6 / 13 / 15 compliance (FID-068/069/070/071)
Verify the core production code no longer relies on loose `any` or `Record<string, unknown>` for tool/JSON payloads and that the v0.0.6 cleanup/deduplication work is intact.

```bash
# JSON value domain type exists and is used across workspaces
spawn detective: { "searchQueries": [{ "pattern": "export type JSONValue", "flags": "common/src/types/json.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "safeParseJSONObject", "flags": "common/src/util/type-narrowing.ts -n" }] }

# No remaining production `any` or `Record<string, unknown>` in high-traffic files
spawn detective: { "searchQueries": [{ "pattern": "Record\\s*<\\s*string\\s*,\\s*unknown\\s*>", "flags": "cli/src -g *.ts -g *.tsx -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "Record\\s*<\\s*string\\s*,\\s*unknown\\s*>", "flags": "sdk/src -g *.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "Record\\s*<\\s*string\\s*,\\s*unknown\\s*>", "flags": "packages/agent-runtime/src -g *.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "Record\\s*<\\s*string\\s*,\\s*unknown\\s*>", "flags": "common/src -g *.ts -n" }] }
```

**Expected:**
- `common/src/types/json.ts` defines `JSONValue`, `JSONObject`, `JSONArray`.
- `common/src/util/type-narrowing.ts` exports `safeParseJSONObject` / `isJSONObject`.
- The four regex searches return no production matches (test files and `eslint-disable` comments may still contain the pattern).

**Test ID mapping (script source of truth):**
- T149 — `JSONValue` type defined in `common/src/types/json.ts`.
- T150 — `safeParseJSONObject` helper exists.
- T151 — No `Record<string, unknown>` shortcuts in production source.
- T152 — Dead utility files removed (FID-071).
- T153 — `getSimpleAgentId` canonical location.
- T154 — `pluralize` canonical location.
- T155 — `formatTimeUntil` canonical location.
- T156 — ESLint `--max-warnings 0` passes across four core workspaces (covers FID-069/070).

---

## Phase 30: Cloudflare Workers AI Provider (v0.0.6, FID-072)

### Test 171-176: Cloudflare gateway provider wiring
Verify Cloudflare Workers AI is wired like the other gateway providers (TokenRouter, NVIDIA, OpenCode Go).

```bash
spawn detective: { "searchQueries": [{ "pattern": "cloudflare", "flags": "common/src/constants/model-config.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "isCloudflareModel", "flags": "sdk/src/impl/model-provider.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "createCloudflareModel", "flags": "sdk/src/impl/model-provider.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "getCloudflareApiTokenFromEnv", "flags": "sdk/src/env.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "getCloudflareAccountIdFromEnv", "flags": "sdk/src/env.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "isCloudflareModel", "flags": "sdk/src/index.ts -n" }] }
```

**Expected:**
- `common/src/constants/model-config.ts` contains a `cloudflareModels` catalog and adds `cloudflare` to `ALLOWED_MODEL_PREFIXES`/`providerDomains`.
- `sdk/src/impl/model-provider.ts` defines `isCloudflareModel()` and `createCloudflareModel()` and routes them in `getModelForRequest()`.
- `sdk/src/env.ts` exposes the account ID and API token getters.
- `sdk/src/index.ts` re-exports `isCloudflareModel`.

### Test 177-178: Model catalog integration (deferred for CLI)
Verify the SDK and common layers recognize the new provider prefix. CLI picker integration is deferred to a follow-up FID.

```bash
spawn detective: { "searchQueries": [{ "pattern": "cloudflare", "flags": "common/src/constants/model-config.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "cloudflare", "flags": "sdk/src/impl/model-provider.ts -n" }] }
```

**Expected:**
- At least one reference in `common/src/constants/model-config.ts`.
- At least one reference in `sdk/src/impl/model-provider.ts`.
- CLI wiring (`cli/src/utils/openrouter-models.ts`, `cli/src/components/model-picker.tsx`) is intentionally out of scope for v0.0.6.

---

## Phase 31: Release metadata (v0.0.6)

### Test 179-181: Version bump and changelog
Verify the release metadata is consistent across the repo.

```bash
run_readonly_command: { "command": "cat VERSION" }
run_readonly_command: { "command": "node -p \"require('./package.json').version\"" }
run_readonly_command: { "command": "node -p \"require('./cli/package.json').version\"" }
```

**Expected:**
- `VERSION` reads `0.0.6`.
- `package.json` version is `0.0.6`.
- `cli/package.json` version is `0.0.6`.

---

## Phase 32: Test & Report (Final)

### Step 1 — Run the automated baseline
Run the automated regression runner first. It is the source of truth for every code-level check.

```bash
bash scripts/run-az-test.sh
```

The runner writes its own machine/human-readable output to `dev/scratchpad/az-test-results.json` and `dev/scratchpad/az-test-results.md`. Capture the final summary line from that output.

### Step 2 — Run interactive-only tests
Execute every `🖥️ interactive` test above that you can perform safely. For each one, record:
- Test ID(s)
- Status (PASS / FAIL / SKIP)
- Evidence (exact command, tool call, or observation)
- Any blocking issue or workaround

You do **not** need to run tests that require production credentials or destructive writes that are not covered by a FID/dev override. Mark those as SKIP and note why.

### Step 3 — Produce the Test Results Report
Write a single test results report to `dev/scratchpad/az-test-v12-results.md`.

**Report template:**

```markdown
# A-Z Test Report v12 — v0.0.6 Release

**Date:** <YYYY-MM-DD>
**Runner:** <version from scripts/run-az-test.sh>
**Agent:** <your name / model>
**Branch/Commit:** <git ref if available>

## Executive Summary
- Total automated tests: <X>
- Automated PASS: <X>
- Automated FAIL: <X>
- Automated SKIP: <X>
- Interactive PASS: <X>
- Interactive FAIL: <X>
- Interactive SKIP: <X>
- **Overall release readiness:** GO / NO-GO / GO WITH CAVEATS

## Automated Baseline Results
Paste the final summary table from `dev/scratchpad/az-test-results.md`.

## Interactive Test Results
| Phase | Test ID(s) | Status | Evidence |
|-------|------------|--------|----------|
| ...   | ...        | ...    | ...      |

## Findings
### Blockers (FAIL items that must be fixed before release)
- <item>

### Warnings (SKIP or flaky tests that should be tracked)
- <item>

### Acceptable caveats
- <item>

## Critical Success Criteria Verification
- [ ] All typechecks pass
- [ ] All 9 agents present with correct tool sets
- [ ] Valid FSM transitions work; illegal transitions rejected
- [ ] `/dev` activates/deactivates without password
- [ ] code-reviewer-kimi fully retired in production
- [ ] `file_picker`/`reviewer` aliases removed from production
- [ ] `Record<string, unknown>` eliminated from production source
- [ ] ESLint `--max-warnings 0` passes on four core workspaces
- [ ] Cloudflare provider wired in SDK/common
- [ ] Version files consistent at 0.0.6
- [ ] ...add any release-specific criteria from the release FID

## Sign-off
- Tester: <name>
- Recommendation: GO / NO-GO / GO WITH CAVEATS
- Notes: <anything else the release manager needs to know>
```

### Step 4 — Produce the Agent Feedback Report
From **your viewpoint** as the operator, create `dev/scratchpad/agent-feedback-<YYYYMMDD>.md` with:

1. **Pain points:** Anything that slowed you down, confused you, or felt broken.
2. **Tool failures:** Which tools failed, why, and what error text you saw. Include exact messages.
3. **Wasted steps:** Commands or tool calls that gave no useful information.
4. **Missing context:** Files, docs, or state you wish had been available up front.
5. **Workflow friction:** Anything about the FSM, slash commands, or UI that made testing harder.
6. **Quality of outputs:** Which outputs were excellent, which were noisy, and which were wrong.
7. **Suggestions:** Concrete changes to prompts, tools, or the CLI that would make your job easier.
8. **One thing to add/remove to this test prompt:** Based on this run, what single test or check should be added, removed, or changed?

**Reminder:** Save all outputs to `dev/scratchpad/`. Do not use `dev/nova/` for routine test output.

### Step 5 — Final hand-off
After both reports are written, report back with:
- The final A-Z runner summary line
- The overall GO / NO-GO / GO WITH CAVEATS verdict
- The file paths of the two reports
- A one-paragraph summary of the biggest risk or blocker, if any
