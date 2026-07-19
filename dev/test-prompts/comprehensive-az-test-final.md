# Savant-Code — Comprehensive A-Z System Test v3 (FID-014 v3 Edition)

**Purpose:** Exhaustive functional test of every tool, agent, FSM gate, slash command, skill, SDK behavior, path safety, and CLI interaction in the Savant-Code harness for rebrand QA.

**Mode:** Interactive live execution inside the Savant CLI. You MUST call every tool, agent, and slash command listed below. Report PASS/FAIL for each with evidence. Do not skip any item. If a tool or agent fails, capture the exact error message and continue testing the rest.

**Environment:** The test runs inside the Savant CLI with ECHO Protocol v0.2.0 active.

**Platform notes:**
- Production runs on Linux — all tests should pass cleanly on Linux
- Windows local dev has known pre-existing platform test infrastructure issues (see FID-015) — some SDK tool tests fail on Windows due to mock fs key mismatch. Production behavior is correct.
- For CI, run on Linux runners

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
**Expected:** Lists all open FIDs in `dev/fids/` (excluding archived). Currently open: FID-2026-0718-015.

### Test 3: Phase display
```bash
/phase
```
**Expected:** Returns current FSM phase. Should be `idle` when no work in progress.

---

## Phase 2: Direct Tools

### Test 4-13: Read tools (10 items)
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

### Test 14-18: Write tools (FID-bound)
**Prerequisite:** Transition to GREEN phase. Open FID first.
```bash
/transition red
/transition green  # Requires open FID
/write_file test.txt "hello"  # Should succeed in GREEN
/read_files test.txt
/transition audit
/rm test.txt  # Bash allowed in AUDIT
```

### Test 19-23: FSM transitions
```bash
/transition idle→red        # Should succeed
/transition red→green       # Should succeed (open FID exists)
/transition green→audit     # Should succeed
/transition audit→complete  # Should succeed
/transition idle→audit      # Should FAIL: "INVALID FSM transition"
```

### Test 24-26: Illegal FSM transitions
```bash
/transition idle→green      # Should FAIL
/transition audit→green     # Should FAIL
/transition complete→red    # Should FAIL
```

---

## Phase 3: Dev Override (FID-003)

### Test 27-30: Dev mode activation
```bash
/dev on                    # Activates dev override
/transition idle→green     # Should succeed without open FID (dev override bypass)
/write_file test-dev.txt "x"  # Should succeed in any phase
/dev off                   # Returns to normal FID-bound mode
/transition green          # Should FAIL (no open FID + dev mode off)
```

---

## Phase 4: Slash Commands

### Test 31-35: ECHO commands
```bash
/fids       # Lists open FIDs
/fid FID-2026-0718-015  # Shows FID details
/phase      # Shows current FSM phase
/phase red  # Transitions to red
```

---

## Phase 5: Agent Roster (FID-006)

### Test 36-44: 9 agents
For each agent below, verify it exists and has the correct tool set per `ARCHITECTURE.md`:

| # | Agent | Verify |
|---|-------|--------|
| 1 | Orchestrator | Has spawn_agents, read_files, transition_phase, but NOT write_file/str_replace/bash |
| 2 | Detective | Has code_search, set_output; NOT write tools |
| 3 | Forge | Has write_file, str_replace; NOT bash |
| 4 | Verifier | No write tools (reads only) |
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

### Test 45-47: Glob behavior
```bash
/scout "find auth files"
/scout "locate test prompts"
/scout "search FID docs"
```

---

## Phase 7: MCP proxy timeout (FID-007 F-B)

### Test 48-50: Timeout behavior
```bash
/code_search "withTimeout" common/src/mcp/client.ts
/code_search "MCP_TIMEOUT" common/src/util/protocol-config.ts
# Verify 2-second timeout for first byte, 30-second for completion
```

---

## Phase 8: FSM phase inheritance (FID-004)

### Test 51-53: Subagent inheritance
```bash
/code_search "fsmPhase" packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts
/code_search "createAgentState" packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts
# Verify subagents inherit fsmPhase from parent
```

---

## Phase 9: Perfection Loop + circuit breaker

### Test 54-57: FSM gates
```bash
# Test 10-iteration circuit breaker
# Open 10+ FIDs and cycle them through to trigger hard stop
```

---

## Phase 10: FID-013 v3 path safety

### Test 58-62: Path safety
```bash
/code_search "resolveAndContain" common/src/util/paths.ts
/code_search "resolveAndContain" packages/agent-runtime/src/tools/handlers/tool/write-file.ts
/code_search "resolveAndContain" packages/agent-runtime/src/tools/handlers/tool/str-replace.ts
/code_search "resolveAndContain" packages/agent-runtime/src/tools/handlers/tool/apply-patch.ts
/code_search "resolveAndContain" packages/agent-runtime/src/tools/tool-executor.ts
```

---

## Phase 11: FID-014 v2 SDK-side realpath

### Test 63-67: SDK-side realpath wiring
```bash
/code_search "resolveAndContain" sdk/src/tools/change-file.ts
/code_search "resolveAndContain" sdk/src/tools/apply-patch.ts
/code_search "realpathFn" common/src/util/paths.ts
/code_search "realpathFn" sdk/src/tools/change-file.ts
/code_search "realpathFn" sdk/src/tools/apply-patch.ts
# Verify realpathFn injection in SDK tools
```

### Test 68-70: SDK path safety test coverage
```bash
# Verify test #7 in change-file.test.ts asserts path-escape rejection
/scratchpath read-test "sdk/src/__tests__/change-file.test.ts"
# Look for "rejects absolute paths outside the project" test
```

---

## Phase 12: Skills system (FID-002)

### Test 71-78: 7 coding standards as skills
```bash
/list_directory .agents/skills
/code_search "skill" cli/src/chat.tsx | head -10
/code_search "skill" cli/src/utils/settings.ts | head -10
# Verify all 7 skills present: coding-typescript, coding-python, coding-rust, coding-java, coding-go, coding-csharp, release-workflow
```

---

## Phase 13: CLI edge cases

### Test 79-85: TUI behavior
- Open chat → see right sidebar with FSM phase
- Type a message → submit
- Press Ctrl+C → graceful exit
- Press / → slash command menu
- Navigate history with arrow keys
- Test tab completion for paths
- Verify tokens update in right sidebar (ContextWindow: 200k)

---

## Phase 14: Knowledge files (FID-005)

### Test 86-90: LEARNINGS wiring
```bash
/read_files dev/LEARNINGS.md
/code_search "LEARNINGS" common/src/util/strings.ts
/code_search "KNOWLEDGE_FILE_NAMES" common/src/util/strings.ts
# Verify LEARNINGS.md in knowledge pipeline
```

---

## Phase 15: Typecheck + Tests

### Test 91-95: Build state
```bash
cd sdk && bun run typecheck       # Should pass
cd common && bun run typecheck    # Should pass
cd packages/agent-runtime && bun run typecheck  # Should pass
cd cli && bun run typecheck       # Should pass
bun test common/src/util/__tests__/paths.test.ts  # 18 pass / 4 skip / 0 fail
```

---

## Phase 16: Rebrand readiness check

### Test 96-100: Branding consistency
```bash
# Verify "Savant" branding throughout
/code_search "Savant" cli/src/ --type tsx | wc -l
/code_search "freebuff" cli/src/ --type tsx | wc -l
# Savant count should be >> freebuff count (rebrand complete)

# Verify ECHO Protocol references
/code_search "ECHO" ECHO.md | head -5
/read_files dev/CHANGELOG.md  # Check for "Savant" branding in recent entries
```

---

## Reporting

After completing all tests, write a comprehensive report to `dev/nova/inbox/2026-07-18-final-rebrand-qa-report.md` with:
- Test ID, Status (PASS/FAIL), Evidence for each item
- Summary section with total pass/fail counts
- Recommendations for any failures
- Sign-off if all critical tests pass

**Critical success criteria:**
- All typechecks pass (zero errors)
- All 9 agents present with correct tool sets
- All FSM transitions work as expected
- All 3 FID-014 v2 fixes verified in source
- SDK-side realpath defense wired in 2 SDK files
- Cross-platform path normalization in paths.ts

**Acceptable caveats (document in report, don't fail):**
- Windows local dev has 18 SDK tool test failures (pre-existing platform test infra issues) — tracked as FID-015
- Token tracking in UI may not update in real-time (known UX issue)
