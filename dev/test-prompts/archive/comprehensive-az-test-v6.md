# Savant-Code — Comprehensive A-Z System Test v6 (Official)

**Purpose:** Exhaustive functional test of every tool, agent, FSM gate, slash command, skill, SDK behavior, provider integration, path safety, TUI component, and CLI interaction in the Savant-Code harness. This is the official regression suite; run it after every significant change or before a release.

**Mode:** Interactive live execution inside the Savant CLI. You MUST call every tool, agent, and slash command listed below. Report PASS/FAIL for each with evidence. Do not skip any item. If a tool or agent fails, capture the exact error message and continue testing the rest.

**Environment:** The test runs inside the Savant CLI with ECHO Protocol v0.2.0 active.

**Platform notes:**
- Production runs on Linux — all tests should pass cleanly on Linux.
- Windows local dev has known pre-existing platform test infrastructure issues (see FID-015) — some SDK tool tests fail on Windows due to mock fs key mismatch. Production behavior is correct.
- For CI, run on Linux runners.
- Run on a clean working tree if possible; document any uncommitted changes in the report.

**Before you start:**
1. Confirm the CLI boots without errors.
2. Confirm you can see the right sidebar with the current FSM phase.
3. Keep a scratchpad note of every command/output for the final report.

---

## Phase 1: Boot & Identity

### Test 1: ECHO Protocol bootstrap
```bash
/scratchpad echo-bootstrap-check
```
**Expected:** Output confirms ECHO.md loaded, version v0.2.0 active, strict_mode: true, language: typescript.

### Test 2: Open FIDs scan
```bash
/scratchpad fid-scan
```
**Expected:** Lists all open FIDs in `dev/fids/` (excluding archived). Verify at least one open FID or confirm the list is empty (and why).

### Test 3: Phase display
```bash
/phase
```
**Expected:** Returns current FSM phase. Should be `idle` when no work is in progress.

### Test 4: Model metadata awareness (FID-054)
Start a new chat and ask the agent: "What model are you running on, and what is its context window?"
**Expected:** The agent reports the actual model selected in the CLI/model picker, including context-window, provider, and release info. It should NOT claim a hardcoded model such as `anthropic/claude-opus-4.8`.

---

## Phase 2: Direct Tools

### Test 5-14: Read tools (10 items)
```bash
/read_files ECHO.md
/read_files protocol.config.yaml
/read_files package.json
/read_files ARCHITECTURE.md
/read_subtree cli/src/components
/list_directory dev/fids
/list_directory agents
/glob "agents/**/*.ts"
/code_search "resolveAndContain" common/src/util
/code_search "fsmPhase" packages/agent-runtime/src
```

### Test 15-19: Write tools (FID-bound)
**Prerequisite:** Transition to GREEN phase. Open FID first.
```bash
/transition red
/transition green  # Requires open FID
/write_file test.txt "hello"  # Should succeed in GREEN
/read_files test.txt
/transition audit
/rm test.txt  # Bash allowed in AUDIT
```

### Test 20-24: FSM transitions
```bash
/transition idle→red        # Should succeed
/transition red→green       # Should succeed (open FID exists)
/transition green→audit     # Should succeed
/transition audit→complete  # Should succeed
/transition idle→audit      # Should FAIL: "INVALID FSM transition"
```

### Test 25-27: Illegal FSM transitions
```bash
/transition idle→green      # Should FAIL
/transition audit→green     # Should FAIL
/transition complete→red    # Should FAIL
```

---

## Phase 3: Dev Override (FID-003 / v4 update)

> **Note:** `/dev` no longer requires a passphrase as of this test version.

### Test 28-31: Dev mode activation (no password)
```bash
/dev on                    # Activates dev override immediately
/transition idle→green     # Should succeed without open FID (dev override bypass)
/write_file test-dev.txt "x"  # Should succeed in any phase
/dev off                   # Returns to normal FID-bound mode
/transition green          # Should FAIL (no open FID + dev mode off)
```

### Test 32: Unknown /dev subcommand
```bash
/dev password              # Should report unknown subcommand and suggest "/dev on" / "/dev off"
```

### Test 33: /dev idempotency
```bash
/dev on    # Should activate dev override
/dev on    # Should report "Dev override is already active."
/dev off   # Should deactivate dev override
/dev off   # Should report "Dev override is already off."
```

---

## Phase 4: Slash Commands

### Test 33-36: ECHO commands
```bash
/fids       # Lists open FIDs
/fid <any-open-FID>  # Shows FID details
/phase      # Shows current FSM phase
/phase red  # Transitions to red
```

### Test 37: Model command
```bash
/model  # Opens the model picker if the live catalog loaded; otherwise shows current model or a fallback message
```
**Expected:** Either a picker appears, or a system message shows the current model and a helpful fallback.

### Test 38: Bare /dev toggle
```bash
/dev      # With no argument, should activate dev override (same as "/dev on")
/dev off  # Deactivate
```
**Expected:** Bare `/dev` behaves as `/dev on` when dev mode is off.

---

## Phase 5: Agent Roster (FID-006)

### Test 39-47: 9 agents
For each agent below, verify it exists and has the correct tool set per `ARCHITECTURE.md`:

| # | Agent | Verify |
|---|-------|--------|
| 1 | Orchestrator | Has spawn_agents, read_files, transition_phase; in Hybrid Mode also has write_file, str_replace; but NOT bash |
| 2 | Detective | Has code_search, set_output; NOT write tools |
| 3 | Forge | Has write_file, str_replace; NOT bash |
| 4 | Verifier | No write tools (reads only); has Audit Checklist in prompt |
| 5 | Recorder | Has write_file, read_files, glob, grep, set_output; has transition_phase |
| 6 | Thinker | Has sequentialthinking |
| 7 | Scout | Has spawn_agents; no write tools |
| 8 | Researcher | Has web_search, read_url, read_docs; no write tools |
| 9 | Scribe | Has read_files, write_file, glob, grep, set_output |

```bash
/code_search "Orchestrator" agents/base2/base2.ts
/code_search "Detective" agents/detective/detective.ts
# ... etc for all 9
```

---

## Phase 6: Scout file-finding (FID-007 F-A)

### Test 47-49: Glob behavior
```bash
/scout "find auth files"
/scout "locate test prompts"
/scout "search FID docs"
```

---

## Phase 7: MCP proxy timeout (FID-007 F-B)

### Test 50-52: Timeout behavior
```bash
/code_search "withTimeout" common/src/mcp/client.ts
/code_search "MCP_TIMEOUT" common/src/util/protocol-config.ts
# Verify 2-second timeout for first byte, 30-second for completion
```

---

## Phase 8: FSM phase inheritance (FID-004)

### Test 53-55: Subagent inheritance
```bash
/code_search "fsmPhase" packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts
/code_search "createAgentState" packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts
# Verify subagents inherit fsmPhase from parent
```

---

## Phase 9: Perfection Loop + circuit breaker

### Test 56-59: FSM gates
```bash
# Test 10-iteration circuit breaker
# Open 10+ FIDs and cycle them through to trigger hard stop
```

---

## Phase 10: FID-013 v3 path safety

### Test 60-64: Path safety
```bash
/code_search "resolveAndContain" common/src/util/paths.ts
/code_search "resolveAndContain" packages/agent-runtime/src/tools/handlers/tool/write-file.ts
/code_search "resolveAndContain" packages/agent-runtime/src/tools/handlers/tool/str-replace.ts
/code_search "resolveAndContain" packages/agent-runtime/src/tools/handlers/tool/apply-patch.ts
/code_search "resolveAndContain" packages/agent-runtime/src/tools/tool-executor.ts
```

---

## Phase 11: FID-014 v2 SDK-side realpath

### Test 65-69: SDK-side realpath wiring
```bash
/code_search "resolveAndContain" sdk/src/tools/change-file.ts
/code_search "resolveAndContain" sdk/src/tools/apply-patch.ts
/code_search "realpathFn" common/src/util/paths.ts
/code_search "realpathFn" sdk/src/tools/change-file.ts
/code_search "realpathFn" sdk/src/tools/apply-patch.ts
# Verify realpathFn injection in SDK tools
```

### Test 70-72: SDK path safety test coverage
```bash
# Verify test #7 in change-file.test.ts asserts path-escape rejection
/scratchpath read-test "sdk/src/__tests__/change-file.test.ts"
# Look for "rejects absolute paths outside the project" test
```

---

## Phase 12: Skills system (FID-002)

### Test 73-80: 7 coding standards as skills
```bash
/list_directory .agents/skills
/code_search "skill" cli/src/chat.tsx | head -10
/code_search "skill" cli/src/utils/settings.ts | head -10
# Verify all 7 skills present: coding-typescript, coding-python, coding-rust, coding-java, coding-go, coding-csharp, release-workflow
```

---

## Phase 13: CLI/TUI edge cases (Master TUI Rebuild)

### Test 81-87: TUI behavior
- Open chat → see right sidebar with FSM phase
- Type a message → submit
- Press Ctrl+C → graceful exit
- Press `/` → slash command menu appears (CommandPalette)
- Navigate history with arrow keys
- Test tab completion for paths
- Verify tokens update in right sidebar (ContextWindow: 200k)

### Test 88: Command palette (FID-033d)
In the chat input type `/` or a slash command prefix.
**Expected:** The native OpenTUI `<select>` command palette renders inline above the input without hiding the input. Escape closes it.

### Test 89: Toast system (FID-033d)
Trigger an action that should produce a toast (e.g., invalid /dev subcommand).
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
/read_files dev/LEARNINGS.md
/code_search "LEARNINGS" common/src/util/strings.ts
/code_search "KNOWLEDGE_FILE_NAMES" common/src/util/strings.ts
# Verify LEARNINGS.md in knowledge pipeline
```

---

## Phase 15: Typecheck + Tests

### Test 96-100: Build state
```bash
cd sdk && bun run typecheck       # Should pass
cd common && bun run typecheck    # Should pass
cd packages/agent-runtime && bun run typecheck  # Should pass
cd cli && bun run typecheck       # Should pass
bun test common/src/util/__tests__/paths.test.ts  # 18 pass / 4 skip / 0 fail
```

---

## Phase 16: Rebrand readiness check

### Test 101-105: Branding consistency
```bash
# Verify "Savant" branding throughout
/code_search "Savant" cli/src/ --type tsx | wc -l
/code_search "savant-free" cli/src/ --type tsx | wc -l
# Savant count should be >> savant-free count (rebrand complete)

# Verify ECHO Protocol references
/code_search "ECHO" ECHO.md | head -5
/read_files dev/CHANGELOG.md  # Check for "Savant" branding in recent entries
```

---

## Phase 17: Code-Reviewer Agent Spawn Frequency (FID-057)

**Purpose:** Determine whether the Verifier agent is actually spawned during normal code-change flows based on the new objective trigger criteria.

### Test 106: Search for reviewer spawns in source
```bash
/code_search "spawn_agents" packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts
/code_search "code-reviewer" agents/ cli/src/ packages/agent-runtime/src/ -g *.ts -n
/code_search "verifier" agents/savant/savant.ts
```
**Expected evidence to capture:**
- List every location where any `verifier` or `code-reviewer-*` pattern is referenced.
- Note which reviewer identifiers actually exist in the codebase.
- Note the objective trigger criteria: 10+ lines, 2+ files, new API, security, user request, Forge usage.

### Test 107: Trigger a code change and observe spawned subagents
Perform a trivial, safe edit via the agent (e.g., write a comment to a scratch file in `dev/scratchpad/`).
**Expected:** The agent's own step summary lists every spawned subagent. Record whether the Verifier agent appeared.

### Test 108: Document policy recommendation
If the Verifier agent is not being spawned for trivial changes, record: "Verifier agent correctly skipped for trivial changes (< 10 lines, single file, no new imports)."
If it is spawned, record the exact trigger condition and frequency.

---

## Phase 18: Provider integration (FID-054)

### Test 109-111: OpenRouter gateway cache
```bash
# Immediately after CLI boot, the gateway catalog should be warming in the background
/code_search "fetchGatewayModels" cli/src/index.tsx
/code_search "getCachedGatewayModels" cli/src/utils/openrouter-models.ts
```
**Expected:** Boot calls `fetchGatewayModels()` non-blockingly; `use-send-message.ts` resolves the effective model and looks it up in the cached catalog.

---

## Phase 19: Hybrid Mode (FID-002, FID-003)

**Purpose:** Verify that Savant can write code directly without spawning Forge, and that Forge is only used for complex tasks.

### Test 112: Hybrid Mode system prompt
```bash
/code_search "primary coder" agents/savant/savant.ts
/code_search "write code directly" agents/savant/savant.ts
```
**Expected:** System prompt says "You are the primary coder — write code directly using write_file and str_replace."

### Test 113: Hybrid Mode instructions
```bash
/code_search "Hybrid Mode" agents/savant/savant.ts
/code_search "write ALL code changes directly" agents/savant/savant.ts
```
**Expected:** Instructions say "Write ALL code changes directly using write_file and str_replace" for most tasks.

### Test 114: Forge only for complex tasks
```bash
/code_search "Spawn Forge only" agents/savant/savant.ts
/code_search "> 3 files AND requires new imports" agents/savant/savant.ts
```
**Expected:** Forge is only spawned for complex changes (> 3 files + new APIs, novel architecture, verification fails twice, user requests Forge).

### Test 115: Direct writing test
Ask the agent: "Write a simple comment to test-sandbox/src/comment.ts saying '// Hybrid mode test'"
**Expected:** Agent writes the file directly using `write_file` without spawning Forge.

---

## Phase 20: Verifier Trigger Criteria (FID-057)

**Purpose:** Verify the Verifier agent is triggered based on objective, measurable criteria instead of subjective judgment.

### Test 116: Objective trigger criteria in prompt
```bash
/code_search "Verifier trigger" agents/savant/savant.ts
/code_search "objective criteria" agents/savant/savant.ts
```
**Expected:** Prompt contains: "Spawn the Verifier to review code changes when ANY of these apply: (1) change is 10+ lines, (2) change touches 2+ files, (3) new function or API added, (4) security-sensitive code touched, (5) user explicitly requests review, (6) when Forge was used to implement changes."

### Test 117: Skip criteria
```bash
/code_search "Skip Verifier only" agents/savant/savant.ts
```
**Expected:** "Skip Verifier only when change is < 10 lines AND single file AND no new imports."

### Test 118: noReview flag gating
```bash
/code_search "!noReview &&" agents/savant/savant.ts
```
**Expected:** The Verifier trigger instruction is gated behind `!noReview` so fast mode skips it.

### Test 119: Trivial change test
Ask the agent: "Fix the typo in test-sandbox/src/comment.ts — change 'Hybird' to 'Hybrid'"
**Expected:** Agent fixes the typo (< 10 lines, single file, no new imports) WITHOUT spawning Verifier.

### Test 120: Non-trivial change test
Ask the agent: "Add a new function `calculateSum` to test-sandbox/src/utils.ts that takes an array of numbers and returns their sum, with proper error handling and tests"
**Expected:** Agent spawns Verifier after implementation (new function added).

---

## Phase 21: Audit Checklist in Verifier (FID-057)

**Purpose:** Verify the Verifier agent checks against the ECHO Audit Checklist.

### Test 121: Audit Checklist in Verifier prompt
```bash
/code_search "ECHO Audit Checklist" agents/verifier/verifier.ts
/code_search "No magic numbers" agents/verifier/verifier.ts
/code_search "Law 14" agents/verifier/verifier.ts
/code_search "Law 6" agents/verifier/verifier.ts
/code_search "Law 5" agents/verifier/verifier.ts
```
**Expected:** Verifier's instructionsPrompt contains the 6-item ECHO Audit Checklist:
- No magic numbers or strings (all constants extracted)
- All names follow language conventions
- Error handling is comprehensive (Law 14)
- No type safety shortcuts (Law 6)
- No TODOs without FID references (Law 5)
- Implementation matches converged FID spec (if applicable)

### Test 122: Checklist items not duplicated with Guidelines
```bash
/code_search "dead code" agents/verifier/verifier.ts
/code_search "missing imports" agents/verifier/verifier.ts
```
**Expected:** "dead code" and "missing imports" appear only in the Guidelines section, NOT in the Audit Checklist (avoiding duplication).

---

## Phase 22: Batch Operations (FID-058)

**Purpose:** Verify the agent batches multiple file edits before running verification.

### Test 123: Batch operations instruction
```bash
/code_search "Batch operations" agents/savant/savant.ts
/code_search "write ALL files first" agents/savant/savant.ts
/code_search "run typecheck/lint ONCE" agents/savant/savant.ts
```
**Expected:** Instructions say: "When making multiple related file changes, write ALL files first, then run typecheck/lint ONCE at the end."

### Test 124: Batch operations test
Ask the agent: "Create test-sandbox/src/math.ts with add, subtract, multiply functions and test-sandbox/src/math.test.ts with tests for all three"
**Expected:** Agent writes both files, then runs verification once (not after each file).

---

## Phase 23: Smart Phase Transitions (FID-059)

**Purpose:** Verify the agent can skip phases when appropriate.

### Test 125: Smart Phase Transitions section
```bash
/code_search "Smart Phase Transitions" agents/savant/savant.ts
/code_search "Skip When" agents/savant/savant.ts
```
**Expected:** Section contains skip-when table for RED, GREEN deliberation, and Full AUDIT phases.

### Test 126: Law 3 never skipped
```bash
/code_search "Law 3 is NEVER skipped" agents/savant/savant.ts
```
**Expected:** "Law 3 (Verify Before Proceed) is NEVER skipped — verification always happens."

### Test 127: Skip RED when issues known
```bash
/code_search "Issues already known" agents/savant/savant.ts
```
**Expected:** RED can be skipped when "Issues already known from prior analysis."

### Test 128: Skip GREEN deliberation for obvious fixes
```bash
/code_search "Fix is obvious" agents/savant/savant.ts
```
**Expected:** GREEN deliberation can be skipped when "Fix is obvious (typo, missing import, constant change)."

### Test 129: Skip AUDIT for trivial changes
```bash
/code_search "Change is < 10 lines" agents/savant/savant.ts
```
**Expected:** Full AUDIT can be skipped when "Change is < 10 lines AND single file AND typecheck/lint already pass inline."

---

## Phase 24: Parallel Agent Batching (FID-060)

**Purpose:** Verify the agent fires all independent agents in a single spawn_agents call.

### Test 130: Parallel agent batching instruction
```bash
/code_search "Parallel agent batching" agents/savant/savant.ts
/code_search "fire them ALL in a single" agents/savant/savant.ts
/code_search "Promise.allSettled" agents/savant/savant.ts
```
**Expected:** Instructions say: "When spawning multiple agents that don't depend on each other, fire them ALL in a single spawn_agents call — they run in parallel via Promise.allSettled."

### Test 131: Dependency table
```bash
/code_search "Independent agents" agents/savant/savant.ts
/code_search "Dependent agents" agents/savant/savant.ts
```
**Expected:** Table shows: Independent (Detective + Researcher + Thinker), Dependent (Scout waits for Detective, Forge waits for Thinker, Verifier waits for Forge).

### Test 132: Sequencing guidance updated
```bash
/code_search "Sequence agents when needed" agents/savant/savant.ts
```
**Expected:** "Only sequence agents when there are data dependencies" (not "Sequence agents properly").

---

## Phase 25: Double Audit Enforcement (FID-057)

**Purpose:** Verify Hybrid Mode satisfies the Double Audit requirement via two independent methods.

### Test 133: Double Audit documentation in ECHO.md
```bash
/code_search "Double Audit" ECHO.md
/code_search "bashers.*static analysis" ECHO.md
/code_search "Verifier.*code review" ECHO.md
```
**Expected:** ECHO.md documents: "Method 1: bashers (typecheck/lint) — static analysis" and "Method 2: Verifier — independent code review."

### Test 134: Self-reporting prohibition
```bash
/code_search "Self-reporting is prohibited" ECHO.md
```
**Expected:** "Self-reporting is prohibited. The Orchestrator that writes code must not be the one to verify it."

### Test 135: Verifier trigger criteria in ECHO.md
```bash
/code_search "Verifier Trigger Criteria" ECHO.md
/code_search "objective" ECHO.md
```
**Expected:** ECHO.md contains the objective Verifier trigger criteria table matching savant.ts.

---

## Phase 26: bun dev startup (FID-055)

**Purpose:** Verify the CLI starts without errors after the unescaped backticks fix.

### Test 136: bun dev starts successfully
```bash
bun dev
```
**Expected:** CLI boots without "Expected ';'" errors. Prebuild step completes successfully.

### Test 137: Prebuild agents step
```bash
/code_search "prebuild-agents" scripts/
```
**Expected:** The prebuild step (`scripts/prebuild-agents.ts`) runs without template literal syntax errors.

---

## Reporting

After completing all tests, write a comprehensive report to `dev/scratchpad/2026-<current-month>-<current-day>-final-rebrand-qa-report.md` (substitute the current month and day) with:
- Test ID, Status (PASS/FAIL), Evidence for each item
- Summary section with total pass/fail counts
- Recommendations for any failures
- Sign-off if all critical tests pass

**Critical success criteria:**
- All typechecks pass (zero errors)
- All 9 agents present with correct tool sets
- All FSM transitions work as expected
- `/dev` activates and deactivates without a password
- Code-reviewer agent spawn behavior is documented
- All 3 FID-014 v2 fixes verified in source
- SDK-side realpath defense wired in 2 SDK files
- Cross-platform path normalization in paths.ts
- OpenRouter model metadata is dynamically injected into the orchestrator prompt (no hardcoded model claim)
- Hybrid Mode works (Savant writes code directly)
- Verifier trigger uses objective criteria
- Audit Checklist present in Verifier prompt
- Batch operations instruction present
- Smart Phase Transitions section present
- Parallel Agent Batching instruction present
- Double Audit enforced in Hybrid Mode
- bun dev starts without errors

**Acceptable caveats (document in report, don't fail):**
- Windows local dev has 18 SDK tool test failures (pre-existing platform test infra issues) — tracked as FID-015
- Token tracking in UI may not update in real-time (known UX issue)

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

Be honest and detailed. We will iterate until the workflow is perfect for both operator and user.
