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
- `spawn code-searcher: <query> [flags]` — spawn the `code-searcher` agent with the given ripgrep-style query.
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
spawn code-searcher: "resolveAndContain" -g common/src/util -n
spawn code-searcher: "fsmPhase" -g packages/agent-runtime/src -n
```

### Test 16-20: Write tools (FID-bound)
**Prerequisite:** Transition to `green` phase first. Open a FID if needed.
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
/bash echo hello
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
spawn code-searcher: "toolNames:" agents/savant/savant.ts
spawn code-searcher: "toolNames:" agents/detective/detective.ts
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
spawn code-searcher: "withTimeout" common/src/mcp/client.ts
spawn code-searcher: "clientTimeouts" common/src/mcp/client.ts
```
**Expected:** Verify `withTimeout` is used for connect, listTools, and callTool; confirm timeout values are configurable.

---

## Phase 8: FSM phase inheritance (FID-004)

### Test 53-55: Subagent inheritance
```bash
spawn code-searcher: "createAgentState" packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts
spawn code-searcher: "fsmPhase" packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts
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
spawn code-searcher: "resolveAndContain" common/src/util/paths.ts
spawn code-searcher: "resolveAndContain" packages/agent-runtime/src/tools/handlers/tool/write-file.ts
spawn code-searcher: "resolveAndContain" packages/agent-runtime/src/tools/handlers/tool/str-replace.ts
spawn code-searcher: "resolveAndContain" packages/agent-runtime/src/tools/handlers/tool/apply-patch.ts
spawn code-searcher: "resolveAndContain" packages/agent-runtime/src/tools/tool-executor.ts
```

---

## Phase 11: FID-014 v2 SDK-side realpath

### Test 65-69: SDK-side realpath wiring
```bash
spawn code-searcher: "resolveAndContain" sdk/src/tools/change-file.ts
spawn code-searcher: "resolveAndContain" sdk/src/tools/apply-patch.ts
spawn code-searcher: "realpathFn" common/src/util/paths.ts
spawn code-searcher: "realpathFn" sdk/src/tools/change-file.ts
spawn code-searcher: "realpathFn" sdk/src/tools/apply-patch.ts
```

### Test 70-72: SDK path safety test coverage
```bash
# Verify the change-file test asserts path-escape rejection
spawn code-searcher: "rejects absolute paths outside the project" sdk/src/__tests__/change-file.test.ts
```

---

## Phase 12: Skills system (FID-002)

### Test 73-80: 7 coding standards as skills
```bash
list_directory tool: .agents/skills
spawn code-searcher: "skill" cli/src/chat.tsx | head -10
spawn code-searcher: "skill" cli/src/utils/settings.ts | head -10
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
spawn code-searcher: "LEARNINGS" common/src/util/strings.ts
spawn code-searcher: "KNOWLEDGE_FILE_NAMES" common/src/util/strings.ts
```

---

## Phase 15: Typecheck + Tests

### Test 96-100: Build state
```bash
cd sdk && bun run typecheck
cd common && bun run typecheck
cd packages/agent-runtime && bun run typecheck
cd cli && bun run typecheck
bun test common/src/util/__tests__/paths.test.ts
```

---

## Phase 16: Rebrand readiness check

### Test 101-105: Branding consistency
```bash
# Verify "Savant" branding throughout
spawn code-searcher: "Savant" cli/src/ -g *.tsx -n | wc -l
spawn code-searcher: "savant-free" cli/src/ -g *.tsx -n | wc -l
# Savant count should be >> savant-free count (rebrand complete)

spawn code-searcher: "ECHO" ECHO.md | head -5
read_files tool: CHANGELOG.md  # Check for "Savant" branding in recent entries
```

---

## Phase 17: Verifier & code-reviewer-kimi Spawn Frequency (FID-057)

**Purpose:** Determine whether the Verifier agent and/or `code-reviewer-kimi` are actually spawned during normal code-change flows based on the objective trigger criteria.

### Test 106: Search for reviewer spawns in source
```bash
spawn code-searcher: "verifier" agents/savant/savant.ts
spawn code-searcher: "spawn_agents" packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts
spawn code-searcher: "code-reviewer-kimi" agents/savant/savant.ts cli/src/ packages/agent-runtime/src/ -g *.ts -n
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
spawn code-searcher: "fetchGatewayModels" cli/src/index.tsx
spawn code-searcher: "subscribeGatewayCatalog" cli/src/utils/openrouter-models.ts
spawn code-searcher: "useGatewayCatalogStore" cli/src/chat.tsx
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
spawn code-searcher: "primary coder" agents/savant/savant.ts
spawn code-searcher: "write code directly" agents/savant/savant.ts
```
**Expected:** System prompt says "You are the primary coder — write code directly using write_file and str_replace."

### Test 114: Hybrid Mode instructions
```bash
spawn code-searcher: "write ALL code changes directly" agents/savant/savant.ts
spawn code-searcher: "Hybrid Mode" agents/savant/savant.ts
```
**Expected:** Instructions say "Write ALL code changes directly using write_file and str_replace" for most tasks.

### Test 115: Forge only for complex tasks
```bash
spawn code-searcher: "Spawn Forge only" agents/savant/savant.ts
spawn code-searcher: "> 3 files AND requires new imports" agents/savant/savant.ts
```
**Expected:** Forge is only spawned for complex changes (> 3 files + new APIs, novel architecture, verification fails twice, user requests Forge).

### Test 116: Direct writing test
Ask the agent: "Write a simple comment to test-sandbox/src/comment.ts saying '// Hybrid mode test'"
**Expected:** Agent writes the file directly using `write_file` without spawning Forge.

---

## Phase 20: Verifier Trigger Criteria (FID-057)

### Test 117: Objective trigger criteria in prompt
```bash
spawn code-searcher: "Verifier trigger" agents/savant/savant.ts
spawn code-searcher: "objective criteria" agents/savant/savant.ts
```
**Expected:** Prompt contains the objective criteria and skip rule.

### Test 118: Skip criteria
```bash
spawn code-searcher: "Skip Verifier only" agents/savant/savant.ts
```
**Expected:** "Skip Verifier only when change is < 10 lines AND single file AND no new imports."

### Test 119: noReview flag gating
```bash
spawn code-searcher: "!noReview" agents/savant/savant.ts
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
spawn code-searcher: "ECHO Audit Checklist" agents/verifier/verifier.ts
spawn code-searcher: "No magic numbers" agents/verifier/verifier.ts
spawn code-searcher: "Law 14" agents/verifier/verifier.ts
spawn code-searcher: "Law 6" agents/verifier/verifier.ts
spawn code-searcher: "Law 5" agents/verifier/verifier.ts
```
**Expected:** Verifier's instructionsPrompt contains the 6-item ECHO Audit Checklist.

### Test 123: Checklist items not duplicated with Guidelines
```bash
spawn code-searcher: "dead code" agents/verifier/verifier.ts
spawn code-searcher: "missing imports" agents/verifier/verifier.ts
```
**Expected:** "dead code" and "missing imports" appear only in the Guidelines section, NOT in the Audit Checklist.

---

## Phase 22: Batch Operations (FID-058)

### Test 124: Batch operations instruction
```bash
spawn code-searcher: "Batch operations" agents/savant/savant.ts
spawn code-searcher: "write ALL files first" agents/savant/savant.ts
spawn code-searcher: "run typecheck/lint ONCE" agents/savant/savant.ts
```
**Expected:** Instructions say: "When making multiple related file changes, write ALL files first, then run typecheck/lint ONCE at the end."

### Test 125: Batch operations test
Ask the agent: "Create test-sandbox/src/math.ts with add, subtract, multiply functions and test-sandbox/src/math.test.ts with tests for all three"
**Expected:** Agent writes both files, then runs verification once (not after each file).

---

## Phase 23: Smart Phase Transitions (FID-059)

### Test 126: Smart Phase Transitions section
```bash
spawn code-searcher: "Smart Phase Transitions" agents/savant/savant.ts
spawn code-searcher: "Skip When" agents/savant/savant.ts
```
**Expected:** Section contains skip-when table for RED, GREEN deliberation, and Full AUDIT phases.

### Test 127: Law 3 never skipped
```bash
spawn code-searcher: "Law 3 is NEVER skipped" agents/savant/savant.ts
```
**Expected:** "Law 3 (Verify Before Proceed) is NEVER skipped — verification always happens."

### Test 128: Skip RED when issues known
```bash
spawn code-searcher: "Issues already known" agents/savant/savant.ts
```
**Expected:** RED can be skipped when "Issues already known from prior analysis."

### Test 129: Skip GREEN deliberation for obvious fixes
```bash
spawn code-searcher: "Fix is obvious" agents/savant/savant.ts
```
**Expected:** GREEN deliberation can be skipped when "Fix is obvious (typo, missing import, constant change)."

### Test 130: Skip AUDIT for trivial changes
```bash
spawn code-searcher: "Change is < 10 lines" agents/savant/savant.ts
```
**Expected:** Full AUDIT can be skipped when "Change is < 10 lines AND single file AND typecheck/lint already pass inline."

---

## Phase 24: Parallel Agent Batching (FID-060)

### Test 131: Parallel agent batching instruction
```bash
spawn code-searcher: "Parallel agent batching" agents/savant/savant.ts
spawn code-searcher: "fire them ALL in a single" agents/savant/savant.ts
spawn code-searcher: "Promise.allSettled" agents/savant/savant.ts
```
**Expected:** Instructions say: "When spawning multiple agents that don't depend on each other, fire them ALL in a single spawn_agents call — they run in parallel via Promise.allSettled."

### Test 132: Dependency table
```bash
spawn code-searcher: "Independent agents" agents/savant/savant.ts
spawn code-searcher: "Dependent agents" agents/savant/savant.ts
```
**Expected:** Table shows independent and dependent agent groups.

### Test 133: Sequencing guidance updated
```bash
spawn code-searcher: "Sequence agents when needed" agents/savant/savant.ts
```
**Expected:** "Only sequence agents when there are data dependencies."

---

## Phase 25: Double Audit Enforcement (FID-057)

### Test 134: Double Audit documentation in ECHO.md
```bash
spawn code-searcher: "Double Audit" ECHO.md
spawn code-searcher: "bashers.*static analysis" ECHO.md
spawn code-searcher: "Verifier.*code review" ECHO.md
```
**Expected:** ECHO.md documents: "Method 1: bashers (typecheck/lint) — static analysis" and "Method 2: Verifier — independent code review."

### Test 135: Self-reporting prohibition
```bash
spawn code-searcher: "Self-reporting is prohibited" ECHO.md
```
**Expected:** "Self-reporting is prohibited. The Orchestrator that writes code must not be the one to verify it."

### Test 136: Verifier trigger criteria in ECHO.md
```bash
spawn code-searcher: "Verifier Trigger Criteria" ECHO.md
spawn code-searcher: "objective" ECHO.md
```
**Expected:** ECHO.md contains the objective Verifier trigger criteria table matching savant.ts.

---

## Phase 26: bun dev startup (FID-055)

### Test 137: bun dev starts successfully
```bash
bun dev
```
**Expected:** CLI boots without "Expected ';'" errors. Prebuild step completes successfully.

### Test 138: Prebuild agents step
```bash
spawn code-searcher: "prebuild-agents" scripts/
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
