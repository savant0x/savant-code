# Savant-Code — Comprehensive A-Z System Test v7 (Official)

**Purpose:** Exhaustive functional test of every tool, agent, FSM gate, slash command, skill, SDK behavior, provider integration, path safety, TUI component, and CLI interaction in the Savant-Code harness. This is the official regression suite; run it after every significant change or before a release.

**Mode:** Interactive live execution inside the Savant CLI. You MUST call every tool, agent, and slash command listed below. Report PASS/FAIL for each with evidence. Do not skip any item. If a tool or agent fails, capture the exact error message and continue testing the rest.

**Environment:** The test runs inside the Savant CLI with ECHO Protocol v0.2.0 active.

**Platform notes:**
- Production runs on Linux — all tests should pass cleanly on Linux.
- Windows local dev has known pre-existing platform test infrastructure issues — some SDK tool tests may fail on Windows due to mock fs/path normalization. Production behavior is correct.
- For CI, run on Linux runners.
- Run on a clean working tree if possible; document any uncommitted changes in the report.

**Output destination (IMPORTANT):**
- All test reports, scratch notes, evidence screenshots, and the agent feedback file MUST be saved under `dev/scratchpad/`.
- **Do NOT save any test output to `dev/nova/`.** The `dev/nova/` channel is reserved exclusively for third-party Nova audits, not for routine test output.

**Before you start:**
1. Confirm the CLI boots without errors.
2. Confirm you can see the right sidebar with the current FSM phase and model info.
3. Keep a scratchpad note of every command/output for the final report.

---

## Phase 1: Boot & Identity

### Test 1: ECHO Protocol bootstrap
Call the `read_files` tool on `ECHO.md`.
**Expected:** Confirms ECHO Protocol v0.2.0 is loaded, the 15 Laws are present, and the Perfection Loop FSM is documented.

### Test 2: Open FIDs scan
Call `list_directory` on `dev/fids/` and `dev/fids/archive/`.
**Expected:** Distinguishes open FIDs from archived ones. If no open FIDs exist, record that explicitly.

### Test 3: Phase display
Observe the right sidebar after the CLI boots.
**Expected:** The current FSM phase is visible. When no work is in progress it should be `idle`.

### Test 4: Model metadata awareness (FID-054)
Start a new chat and ask the agent: "What model are you running on, and what is its context window?"
**Expected:** The agent reports the actual model selected in the CLI/model picker, including provider and context-window info. It should NOT claim a hardcoded model such as `anthropic/claude-opus-4.8`.

### Test 5: Direct-provider mode (no backend)
If the environment has `DIRECT_PROVIDER=openrouter` and `INFERENCE_BASE_URL` set, boot the CLI without a valid `SAVANT_CODE_API_KEY`.
**Expected:** The CLI boots and routes inference directly to the provider. No backend ping or auth failure blocks startup.

---

## Phase 2: Direct Tools

> These are **tool calls** (not slash commands). Invoke them directly through the agent's available tools.

**Legend:**
- `read_files <path>` / `list_directory <path>` / `glob <pattern>` — call these tools directly.
- `spawn code-searcher: { "pattern": "...", "flags": "..." }` — spawn the `code-searcher` agent with a ripgrep-style query.
- `transition_phase {"phase":"..."}` — call the `transition_phase` tool.

### Test 6-15: Read tools (10 items)
Call the following tools directly and record that each returns successfully:
```text
read_files          ECHO.md
read_files          protocol.config.yaml
read_files          package.json
read_files          ARCHITECTURE.md
read_subtree        cli/src/components
list_directory      dev/fids
list_directory      agents
glob                "agents/**/*.ts"
spawn code-searcher: { "pattern": "resolveAndContain", "flags": "-g common/src/util -n" }
spawn code-searcher: { "pattern": "fsmPhase", "flags": "-g packages/agent-runtime/src -n" }
```

### Test 16-20: Write tools (FID-bound)
**Prerequisite:** Create or open a FID first, then transition to `green` phase. The Orchestrator can write to scratchpad/FID paths only when a FID is open (or dev override is active).
```text
transition_phase    {"phase":"red"}
transition_phase    {"phase":"green"}   # Requires an open FID
write_file          dev/scratchpad/test-tool-write.txt  "hello"
read_files          dev/scratchpad/test-tool-write.txt
bash (in audit)     rm dev/scratchpad/test-tool-write.txt
```
**Expected:** `write_file` succeeds in `green`; `read_files` returns the content; the file can be removed in `audit`.

### Test 21-25: FSM transitions
```text
transition_phase    {"phase":"red"}
transition_phase    {"phase":"green"}
transition_phase    {"phase":"audit"}
transition_phase    {"phase":"complete"}
transition_phase    {"phase":"audit"}   # Should FAIL: cannot go complete→audit
```
**Expected:** The first four transitions succeed; the last one is rejected as an invalid FSM transition.

### Test 26-28: Illegal FSM transitions
```text
transition_phase    {"phase":"green"}   # from idle → should FAIL
transition_phase    {"phase":"green"}   # from audit → should FAIL
transition_phase    {"phase":"red"}     # from complete → should FAIL
```

---

## Phase 3: Dev Override (FID-003 / v4 update)

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

## Phase 4: Slash Commands

> These are actual CLI slash commands from `cli/src/data/slash-commands.ts` and `cli/src/commands/command-registry.ts`. Run them by typing into the chat input.

### Test 34-42: Available slash commands
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
/exit  # Optional — run last, it quits the CLI
```

### Test 43: /model free-text selection
```bash
/model openai/gpt-4o
```
**Expected:** Model preference is updated and a system message confirms the switch (or falls back gracefully if the catalog is unavailable).

---

## Phase 5: Agent Roster (FID-006)

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

> **Note:** `code-reviewer-kimi` is an orchestrator subagent, not one of the 9 canonical ECHO agents.

```bash
spawn code-searcher: { "pattern": "toolNames:", "flags": "agents/savant/savant.ts -n" }
spawn code-searcher: { "pattern": "toolNames:", "flags": "agents/detective/detective.ts -n" }
# ... etc for all 9
```

---

## Phase 6: Scout file-finding (FID-007 F-A)

Spawn the `scout` agent directly:
```text
spawn scout with prompt: "find auth files"
spawn scout with prompt: "locate test prompts"
spawn scout with prompt: "search FID docs"
```
**Expected:** Scout returns up to 12 relevant file paths with short summaries for each.

---

## Phase 7: MCP proxy timeout (FID-007 F-B)

### Test 50-52: Timeout behavior
```bash
spawn code-searcher: { "pattern": "withTimeout", "flags": "common/src/mcp/client.ts -n" }
spawn code-searcher: { "pattern": "clientTimeouts", "flags": "common/src/mcp/client.ts -n" }
```
**Expected:** Verify `withTimeout` is used for connect, listTools, and callTool; confirm timeout values are configurable.

---

## Phase 8: FSM phase inheritance (FID-004)

### Test 53-55: Subagent inheritance
```bash
spawn code-searcher: { "pattern": "createAgentState", "flags": "packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts -n" }
spawn code-searcher: { "pattern": "fsmPhase", "flags": "packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts -n" }
```
**Expected:** Subagents inherit `fsmPhase` from the parent agent state.

---

## Phase 9: Perfection Loop + circuit breaker

### Test 56-59: FSM gates
```text
# Optional / advanced: open 10+ FIDs and cycle them to confirm the hard stop at 10 iterations.
# If not performed, document "skipped" with a reason.
```

---

## Phase 10: FID-013 v3 path safety

### Test 60-64: Path safety
```bash
spawn code-searcher: { "pattern": "resolveAndContain", "flags": "common/src/util/paths.ts -n" }
spawn code-searcher: { "pattern": "resolveAndContain", "flags": "packages/agent-runtime/src/tools/handlers/tool/write-file.ts -n" }
spawn code-searcher: { "pattern": "resolveAndContain", "flags": "packages/agent-runtime/src/tools/handlers/tool/str-replace.ts -n" }
spawn code-searcher: { "pattern": "resolveAndContain", "flags": "packages/agent-runtime/src/tools/handlers/tool/apply-patch.ts -n" }
spawn code-searcher: { "pattern": "resolveAndContain", "flags": "packages/agent-runtime/src/tools/tool-executor.ts -n" }
```

---

## Phase 11: FID-014 v2 SDK-side realpath

### Test 65-69: SDK-side realpath wiring
```bash
spawn code-searcher: { "pattern": "resolveAndContain", "flags": "sdk/src/tools/change-file.ts -n" }
spawn code-searcher: { "pattern": "resolveAndContain", "flags": "sdk/src/tools/apply-patch.ts -n" }
spawn code-searcher: { "pattern": "realpathFn", "flags": "common/src/util/paths.ts -n" }
spawn code-searcher: { "pattern": "realpathFn", "flags": "sdk/src/tools/change-file.ts -n" }
spawn code-searcher: { "pattern": "realpathFn", "flags": "sdk/src/tools/apply-patch.ts -n" }
```

### Test 70-72: SDK path safety test coverage
```bash
# Verify the change-file test asserts path-escape rejection
spawn code-searcher: { "pattern": "rejects absolute paths outside the project", "flags": "sdk/src/__tests__/change-file.test.ts -n" }
```

---

## Phase 12: Skills system (FID-002)

### Test 73-80: 7 coding standards as skills
```bash
list_directory tool: .agents/skills
spawn code-searcher: { "pattern": "skill", "flags": "cli/src/chat.tsx -n" }
spawn code-searcher: { "pattern": "skill", "flags": "cli/src/utils/settings.ts -n" }
```
**Expected:** The 7 skills present: `coding-typescript`, `coding-python`, `coding-rust`, `coding-java`, `coding-go`, `coding-csharp`, `release-workflow`.

---

## Phase 13: CLI/TUI edge cases (Master TUI Rebuild)

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

## Phase 14: Knowledge files (FID-005)

### Test 91-95: LEARNINGS wiring
```bash
read_files tool: dev/LEARNINGS.md
spawn code-searcher: { "pattern": "LEARNINGS", "flags": "common/src/util/strings.ts -n" }
spawn code-searcher: { "pattern": "KNOWLEDGE_FILE_NAMES", "flags": "common/src/util/strings.ts -n" }
```

---

## Phase 15: Typecheck + Tests

### Test 96-100: Build state
```bash
bash: cd sdk && bun run typecheck
bash: cd common && bun run typecheck
bash: cd packages/agent-runtime && bun run typecheck
bash: cd cli && bun run typecheck
bash: bun test common/src/util/__tests__/paths.test.ts
```

---

## Phase 16: Rebrand readiness check

### Test 101-105: Branding consistency
```bash
# Verify "Savant" branding throughout
spawn code-searcher: { "pattern": "Savant", "flags": "cli/src/ -g *.tsx -n" }
spawn code-searcher: { "pattern": "savant-free", "flags": "cli/src/ -g *.tsx -n" }
# Savant count should be >> savant-free count (rebrand complete)

spawn code-searcher: { "pattern": "ECHO", "flags": "ECHO.md -n" }
read_files tool: CHANGELOG.md  # Check for "Savant" branding in recent entries
```

---

## Phase 17: Verifier & code-reviewer-kimi Spawn Frequency (FID-057)

**Purpose:** Determine whether the Verifier agent and/or `code-reviewer-kimi` are actually spawned during normal code-change flows based on the objective trigger criteria.

### Test 106: Search for reviewer spawns in source
```bash
spawn code-searcher: { "pattern": "verifier", "flags": "agents/savant/savant.ts -n" }
spawn code-searcher: { "pattern": "spawn_agents", "flags": "packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts -n" }
spawn code-searcher: { "pattern": "code-reviewer-kimi", "flags": "agents/savant/savant.ts cli/src/ packages/agent-runtime/src/ -g *.ts -n" }
```
**Expected evidence to capture:**
- List every location where `verifier` or `code-reviewer-kimi` is referenced.
- Note the objective trigger criteria: 10+ lines, 2+ files, new API, security, user request, Forge usage.

### Test 107: Trigger a code change and observe spawned subagents
Perform a trivial, safe edit via the agent (e.g., write a comment to a scratch file in `dev/scratchpad/`).
**Expected:** The agent's own step summary lists every spawned subagent. Record whether the Verifier or `code-reviewer-kimi` appeared.

### Test 108: Document policy recommendation
If the Verifier/`code-reviewer-kimi` is not spawned for trivial changes, record: "Reviewer correctly skipped for trivial changes (< 10 lines, single file, no new imports)."
If spawned, record the exact trigger condition and frequency.

---

## Phase 18: Provider integration (FID-054, FID-062)

### Test 109-111: OpenRouter gateway cache and reactive catalog
```bash
spawn code-searcher: { "pattern": "fetchGatewayModels", "flags": "cli/src/index.tsx -n" }
spawn code-searcher: { "pattern": "subscribeGatewayCatalog", "flags": "cli/src/utils/openrouter-models.ts -n" }
spawn code-searcher: { "pattern": "useGatewayCatalogStore", "flags": "cli/src/chat.tsx -n" }
```
**Expected:**
- Boot warms the gateway catalog non-blockingly.
- The catalog supports subscriptions so the sidebar refreshes when it loads.
- `use-send-message.ts` resolves the effective model and looks it up in the cached catalog.

### Test 112: Dynamic model metadata injection
Ask the agent: "What model am I running, what is its context window, and what provider is it from?"
**Expected:** The answer uses the live gateway catalog data, not a hardcoded string.

---

## Phase 19: Hybrid Mode (FID-002, FID-003)

**Purpose:** Verify that Savant can write code directly without spawning Forge, and that Forge is only used for complex tasks.

### Test 113: Hybrid Mode system prompt
```bash
spawn code-searcher: { "pattern": "primary coder", "flags": "agents/savant/savant.ts -n" }
spawn code-searcher: { "pattern": "write code directly", "flags": "agents/savant/savant.ts -n" }
```
**Expected:** System prompt says "You are the primary coder — write code directly using write_file and str_replace."

### Test 114: Hybrid Mode instructions
```bash
spawn code-searcher: { "pattern": "write ALL code changes directly", "flags": "agents/savant/savant.ts -n" }
spawn code-searcher: { "pattern": "Hybrid Mode", "flags": "agents/savant/savant.ts -n" }
```
**Expected:** Instructions say "Write ALL code changes directly using write_file and str_replace" for most tasks.

### Test 115: Forge only for complex tasks
```bash
spawn code-searcher: { "pattern": "Spawn Forge only", "flags": "agents/savant/savant.ts -n" }
spawn code-searcher: { "pattern": "> 3 files AND requires new imports", "flags": "agents/savant/savant.ts -n" }
```
**Expected:** Forge is only spawned for complex changes (> 3 files + new APIs, novel architecture, verification fails twice, user requests Forge).

### Test 116: Direct writing test
Ask the agent: "Write a simple comment to test-sandbox/src/comment.ts saying '// Hybrid mode test'"
**Expected:** Agent writes the file directly using `write_file` without spawning Forge.

---

## Phase 20: Verifier Trigger Criteria (FID-057)

### Test 117: Objective trigger criteria in prompt
```bash
spawn code-searcher: { "pattern": "Verifier trigger", "flags": "agents/savant/savant.ts -n" }
spawn code-searcher: { "pattern": "objective criteria", "flags": "agents/savant/savant.ts -n" }
```
**Expected:** Prompt contains the objective criteria and skip rule.

### Test 118: Skip criteria
```bash
spawn code-searcher: { "pattern": "Skip Verifier only", "flags": "agents/savant/savant.ts -n" }
```
**Expected:** "Skip Verifier only when change is < 10 lines AND single file AND no new imports."

### Test 119: noReview flag gating
```bash
spawn code-searcher: { "pattern": "!noReview", "flags": "agents/savant/savant.ts -n" }
```
**Expected:** The Verifier trigger instruction is gated behind `!noReview` so fast mode skips it.

### Test 120: Trivial change test
Ask the agent: "Fix the typo in test-sandbox/src/comment.ts — change 'Hybird' to 'Hybrid'"
**Expected:** Agent fixes the typo (< 10 lines, single file, no new imports) WITHOUT spawning Verifier.

### Test 121: Non-trivial change test
Ask the agent: "Add a new function `calculateSum` to test-sandbox/src/utils.ts that takes an array of numbers and returns their sum, with proper error handling and tests"
**Expected:** Agent spawns Verifier after implementation (new function added).

---

## Phase 21: Audit Checklist in Verifier (FID-057)

### Test 122: Audit Checklist in Verifier prompt
```bash
spawn code-searcher: { "pattern": "ECHO Audit Checklist", "flags": "agents/verifier/verifier.ts -n" }
spawn code-searcher: { "pattern": "No magic numbers", "flags": "agents/verifier/verifier.ts -n" }
spawn code-searcher: { "pattern": "Law 14", "flags": "agents/verifier/verifier.ts -n" }
spawn code-searcher: { "pattern": "Law 6", "flags": "agents/verifier/verifier.ts -n" }
spawn code-searcher: { "pattern": "Law 5", "flags": "agents/verifier/verifier.ts -n" }
```
**Expected:** Verifier's instructionsPrompt contains the 6-item ECHO Audit Checklist.

### Test 123: Checklist items not duplicated with Guidelines
```bash
spawn code-searcher: { "pattern": "dead code", "flags": "agents/verifier/verifier.ts -n" }
spawn code-searcher: { "pattern": "missing imports", "flags": "agents/verifier/verifier.ts -n" }
```
**Expected:** "dead code" and "missing imports" appear only in the Guidelines section, NOT in the Audit Checklist.

---

## Phase 22: Batch Operations (FID-058)

### Test 124: Batch operations instruction
```bash
spawn code-searcher: { "pattern": "Batch operations", "flags": "agents/savant/savant.ts -n" }
spawn code-searcher: { "pattern": "write ALL files first", "flags": "agents/savant/savant.ts -n" }
spawn code-searcher: { "pattern": "run typecheck/lint ONCE", "flags": "agents/savant/savant.ts -n" }
```
**Expected:** Instructions say: "When making multiple related file changes, write ALL files first, then run typecheck/lint ONCE at the end."

### Test 125: Batch operations test
Ask the agent: "Create test-sandbox/src/math.ts with add, subtract, multiply functions and test-sandbox/src/math.test.ts with tests for all three"
**Expected:** Agent writes both files, then runs verification once (not after each file).

---

## Phase 23: Smart Phase Transitions (FID-059)

### Test 126: Smart Phase Transitions section
```bash
spawn code-searcher: { "pattern": "Smart Phase Transitions", "flags": "agents/savant/savant.ts -n" }
spawn code-searcher: { "pattern": "Skip When", "flags": "agents/savant/savant.ts -n" }
```
**Expected:** Section contains skip-when table for RED, GREEN deliberation, and Full AUDIT phases.

### Test 127: Law 3 never skipped
```bash
spawn code-searcher: { "pattern": "Law 3 is NEVER skipped", "flags": "agents/savant/savant.ts -n" }
```
**Expected:** "Law 3 (Verify Before Proceed) is NEVER skipped — verification always happens."

### Test 128: Skip RED when issues known
```bash
spawn code-searcher: { "pattern": "Issues already known", "flags": "agents/savant/savant.ts -n" }
```
**Expected:** RED can be skipped when "Issues already known from prior analysis."

### Test 129: Skip GREEN deliberation for obvious fixes
```bash
spawn code-searcher: { "pattern": "Fix is obvious", "flags": "agents/savant/savant.ts -n" }
```
**Expected:** GREEN deliberation can be skipped when "Fix is obvious (typo, missing import, constant change)."

### Test 130: Skip AUDIT for trivial changes
```bash
spawn code-searcher: { "pattern": "Change is < 10 lines", "flags": "agents/savant/savant.ts -n" }
```
**Expected:** Full AUDIT can be skipped when "Change is < 10 lines AND single file AND typecheck/lint already pass inline."

---

## Phase 24: Parallel Agent Batching (FID-060)

### Test 131: Parallel agent batching instruction
```bash
spawn code-searcher: { "pattern": "Parallel agent batching", "flags": "agents/savant/savant.ts -n" }
spawn code-searcher: { "pattern": "fire them ALL in a single", "flags": "agents/savant/savant.ts -n" }
spawn code-searcher: { "pattern": "Promise.allSettled", "flags": "agents/savant/savant.ts -n" }
```
**Expected:** Instructions say: "When spawning multiple agents that don't depend on each other, fire them ALL in a single spawn_agents call — they run in parallel via Promise.allSettled."

### Test 132: Dependency table
```bash
spawn code-searcher: { "pattern": "Independent agents", "flags": "agents/savant/savant.ts -n" }
spawn code-searcher: { "pattern": "Dependent agents", "flags": "agents/savant/savant.ts -n" }
```
**Expected:** Table shows independent and dependent agent groups.

### Test 133: Sequencing guidance updated
```bash
spawn code-searcher: { "pattern": "Sequence agents when needed", "flags": "agents/savant/savant.ts -n" }
```
**Expected:** "Only sequence agents when there are data dependencies."

---

## Phase 25: Double Audit Enforcement (FID-057)

### Test 134: Double Audit documentation in ECHO.md
```bash
spawn code-searcher: { "pattern": "Double Audit", "flags": "ECHO.md -n" }
spawn code-searcher: { "pattern": "bashers.*static analysis", "flags": "ECHO.md -n" }
spawn code-searcher: { "pattern": "Verifier.*code review", "flags": "ECHO.md -n" }
```
**Expected:** ECHO.md documents: "Method 1: bashers (typecheck/lint) — static analysis" and "Method 2: Verifier — independent code review."

### Test 135: Self-reporting prohibition
```bash
spawn code-searcher: { "pattern": "Self-reporting is prohibited", "flags": "ECHO.md -n" }
```
**Expected:** "Self-reporting is prohibited. The Orchestrator that writes code must not be the one to verify it."

### Test 136: Verifier trigger criteria in ECHO.md
```bash
spawn code-searcher: { "pattern": "Verifier Trigger Criteria", "flags": "ECHO.md -n" }
spawn code-searcher: { "pattern": "objective", "flags": "ECHO.md -n" }
```
**Expected:** ECHO.md contains the objective Verifier trigger criteria table matching savant.ts.

---

## Phase 26: bun dev startup (FID-055)

### Test 137: bun dev starts successfully
```text
bash: bun dev
```
**Expected:** CLI boots without "Expected ';'" errors. Prebuild step completes successfully.

### Test 138: Prebuild agents step
```text
spawn code-searcher: { "pattern": "prebuild-agents", "flags": "scripts/ -n" }
```
**Expected:** The prebuild step (`scripts/prebuild-agents.ts`) runs without template literal syntax errors.

---

## Reporting

After completing all tests, write a comprehensive report to `dev/scratchpad/2026-<current-month>-<current-day>-az-test-report.md` with:
- Test ID, Status (PASS/FAIL/SKIP), Evidence for each item
- Summary section with total pass/fail/skip counts
- Recommendations for any failures
- Sign-off if all critical tests pass

**Critical success criteria:**
- All typechecks pass (zero errors)
- All 9 agents present with correct tool sets
- All valid FSM transitions work; invalid transitions are rejected
- `/dev` activates and deactivates without a password
- Verifier/code-reviewer-kimi spawn behavior is documented
- All path-safety fixes verified in source
- SDK-side realpath defense wired in 2 SDK files
- OpenRouter model metadata is dynamically injected into the orchestrator prompt (no hardcoded model claim)
- Direct-provider mode boots without a backend API key (when configured)
- Hybrid Mode works (Savant writes code directly)
- Verifier trigger uses objective criteria
- Audit Checklist present in Verifier prompt
- Batch operations instruction present
- Smart Phase Transitions section present
- Parallel Agent Batching instruction present
- Double Audit enforced in Hybrid Mode
- bun dev starts without errors

**Acceptable caveats (document in report, don't fail):**
- Windows local dev has pre-existing platform test infrastructure issues — some SDK tests may fail on Windows due to mock fs/path normalization. Document exact failures.
- Token tracking in UI may not update in real-time (known UX issue).

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

Be honest and detailed. We will iterate until the workflow is perfect for both operator and user.
