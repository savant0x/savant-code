# Savant-Code Rebrand QA — Comprehensive A-Z Live Test

**Purpose:** Final verification pass before public rebrand of SavantCode → Savant-Code. Covers every change from FID-001 through FID-016 plus end-to-end CLI/SDK/agent-runtime integration.

**Mode:** Interactive live execution inside the Savant CLI. Drive the actual chat session, run real commands, exercise real tools. Report PASS/FAIL/SKIP with evidence for each item.

**Environment:** `strict_mode: true`, `language: typescript`, `protocol.config.yaml` active, ECHO v0.2.0 loaded.

**Skip Rules:**
- Items marked `[LIVE]` require interactive CLI drives — execute in tmux.
- Items marked `[SOURCE]` require code-verification only — read the file + grep.
- Skip any item that fails on the first try — do not retry. Capture the exact error.

---

## Section 1: Boot & Identity (FID-008)

1. `[LIVE]` Drive `/help` → verify all 9 ECHO agents listed in `Ecosystem`
2. `[SOURCE]` Read `ECHO.md` lines 1-50 → confirm "Savant" identity, v0.2.0, ECHO loaded
3. `[LIVE]` Confirm `strict_mode: true` injected into system prompt (no `strict_mode=false` disclaimer)
4. `[LIVE]` Confirm `language: typescript` present in agent boot
5. `[LIVE]` Confirm ECHO_BOOT_CONTEXT shows open FIDs from `dev/fids/`
6. `[LIVE]` Confirm session summary auto-created at `dev/session-summaries/<date>.md`
7. `[LIVE]` Drive `/fids` → list all open FIDs with status (OPEN / ARCHIVED)

---

## Section 2: Slash Commands (FID-012)

8. `[LIVE]` Drive `/phase` → print current FSM phase
9. `[LIVE]` Drive `/phase green` → transition illegal → expect "INVALID FSM transition: idle → green"
10. `[LIVE]` Drive `/phase red` → transition legal (from idle) → expect "FSM phase: red"
11. `[LIVE]` Drive `/fid FID-2026-0718-016` → show FID summary (was pre-existing test failures)
12. `[LIVE]` Drive `/dev` → toggle dev mode (FID-003)
13. `[LIVE]` With dev mode ON, drive a write_file from Orchestrator to `dev/scratchpad/test.md` → expect succeeds
14. `[LIVE]` With dev mode OFF, drive same write_file → expect BLOCKED unless path is dev/scratchpad or dev/fids

---

## Section 3: FSM Phase Tracking & SYNCHRONIZATION (FID-009 + FID-008 F10)

15. `[LIVE]` Confirm right sidebar `phase` indicator matches runtime FSM (idle by default)
16. `[LIVE]` Drive `/phase red` → confirm sidebar updates to `[RED]` (no refresh needed)
17. `[LIVE]` Drive `/phase green` → confirm sidebar → `[GREEN]`
18. `[LIVE]` Drive a write_file from Orchestrator during GREEN → expect succeeds to non-system path
19. `[LIVE]` Drive `/phase audit` → confirm sidebar → `[AUDIT]`
20. `[LIVE]` Drive `run_terminal_command` during AUDIT → expect succeeds
21. `[LIVE]` Drive same tool during RED → expect BLOCKED with "INVALID FSM transition: terminal commands available during AUDIT"
22. `[LIVE]` Drive `/phase complete` → confirm sidebar resets to `[IDLE]` after FID archive
23. `[LIVE]` Confirm status banner above input also resets from "working" to idle (per FID-008 F10)
24. `[LIVE]` Confirm `/phase idle` auto-fires on new user message after complete

---

## Section 4: Agent Roster & Separation of Duties (FID-006)

25. `[SOURCE]` Read `agents/orchestrator/base2.ts` → confirm tools: spawn_agents, read_files, transition_phase, write_todos, render_ui, etc. NO write_file for production paths (only via Forge). WRITE TO SCRATCHPAD OK (FID-008).
26. `[SOURCE]` Read `agents/detective/detective.ts` → confirm tools: code_search, set_output ONLY. No write.
27. `[SOURCE]` Read `agents/forge/forge.ts` → confirm tools: write_file, str_replace, set_output. No bash.
28. `[SOURCE]` Read `agents/verifier/verifier.ts` → confirm NO write tools. Reads via message history.
29. `[SOURCE]` Read `agents/recorder/recorder.ts` → confirm transition_phase tool available.
30. `[SOURCE]` Read `agents/thinker/thinker.ts` → confirm sequentialthinking tool, no writes.
31. `[SOURCE]` Read `agents/scout/scout.ts` → confirm read-only tools only.
32. `[SOURCE]` Read `agents/researcher/researcher.ts` → confirm web_search, read_url.
33. `[SOURCE]` Read `agents/scribe/scribe.ts` → confirm docs tools.

---

## Section 5: Subagent FSM Inheritance (FID-004)

34. `[SOURCE]` Read `packages/agent-runtime/src/tools/spawn-agent-utils.ts` `createAgentState()` → confirm fsmPhase + iterationCount inherited from parent.
35. `[SOURCE]` Confirm subagents DO inherit strictMode, fsmPhase, iterationCount.
36. `[LIVE]` Spawn Detective from Orchestrator (during RED) → confirm Detective's fsmPhase = RED (not idle).
37. `[LIVE]` Spawn Forge during GREEN → confirm Forge can write (subagent fsmPhase = GREEN).

---

## Section 6: Tool Gating & Strict Mode (FID-001 + FID-004)

38. `[LIVE]` During RED, drive Orchestrator write_file to `src/example.ts` → expect BLOCKED.
39. `[LIVE]` During GREEN, same write_file → expect succeeds.
40. `[LIVE]` During RED, drive run_terminal_command `ls` → expect BLOCKED.
41. `[LIVE]` During AUDIT, same → expect succeeds.
42. `[LIVE]` Confirm `strict_mode: true` set globally (`protocol.config.yaml`).
43. `[SOURCE]` Read `packages/agent-runtime/src/tools/tool-executor.ts` lines 339-362 → confirm gate logic.

---

## Section 7: FID-Bound Execution & Snapshots (FID-001 + FID-005)

44. `[LIVE]` Drive `/phase red` → confirm gate blocks write_file even if no FID open.
45. `[LIVE]` Drive `/phase green` with no FID open → confirm blocked (hasOpenFids check).
46. `[LIVE]` Create FID-2026-0718-017 manually, then drive `/phase green` → confirm succeeds.
47. `[LIVE]` During GREEN, Forge writes `src/example.ts` → confirm snapshot stored at `dev/scratchpad/.snapshots/`.
48. `[LIVE]` During self_correct → green (after audit fail), confirm original `src/example.ts` restored.
49. `[LIVE]` After green passes, confirm file content matches new version.
50. `[LIVE]` After complete, confirm snapshot cleared.

---

## Section 8: Circuit Breakers (FID-007)

51. `[LIVE]` Drive 11 iterations of self_correct → green → confirm hard stop at iteration 10.
52. `[LIVE]` Drive 11 iterations of red → green → confirm same stop.
53. `[SOURCE]` Read `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts` → confirm iterationCount enforcement.

---

## Section 9: MCP Proxy Timeout & Fallback (FID-007)

54. `[SOURCE]` Read `common/src/mcp/client.ts` → confirm withTimeout per-server (2s default).
55. `[SOURCE]` Read for fallback logic when MCP server disables proxy.
56. `[LIVE]` Drive `get_mcp_tools` against slow server → confirm timeout error surfaces.
57. `[LIVE]` Drive same with proxy disabled → confirm fallback path works.

---

## Section 10: Skills System (FID-002)

58. `[SOURCE]` Read `.agents/skills/` → confirm all 7 SKILL.md present (typescript, python, rust, java, go, csharp, release-workflow).
59. `[SOURCE]` Each SKILL.md has YAML frontmatter (name, description).
60. `[LIVE]` Trigger codebase task with `.py` files → confirm Python skill loaded by agent.
61. `[LIVE]` Trigger codebase task with `.ts` files → confirm TypeScript skill loaded.
62. `[LIVE]` Confirm loaded skills list visible in right sidebar (if shown) or session context.

---

## Section 11: Knowledge Files (FID-005)

63. `[LIVE]` Confirm `LEARNINGS.md`, `CLAUDE.md`, `AGENTS.md` loaded into agent context.
64. `[LIVE]` Confirm `dev/session-summaries/*.md` referenced in agent boot.
65. `[LIVE]` Confirm `dev/fids/open/` listed in agent boot (open FIDs).
66. `[LIVE]` Confirm KNOWLEDGE_FILE_NAMES filter works (no subdirectory injection).

---

## Section 12: Path Normalization & Cross-Platform (FID-015 + FID-016)

67. `[SOURCE]` Read `sdk/src/tools/path-utils.ts` → confirm toPosix helper.
68. `[LIVE]` Run `bun test sdk/src/__tests__/user-knowledge-files.test.ts` → 15/15 pass.
69. `[LIVE]` Run `bun test sdk/src/__tests__/code-search.test.ts -t 'cwd'` → 3/3 pass.
70. `[LIVE]` Run `bun test sdk/src/__tests__/database.test.ts` → 3/3 pass.
71. `[LIVE]` Run `bun test sdk/src/__tests__/initial-session-state.test.ts -t 'discovers'` → 1/1 pass.
72. `[LIVE]` Run `bun test sdk/src/__tests__/load-agents.test.ts -t 'verbose'` → 1/1 pass.
73. `[LIVE]` Run `bun test sdk/src/__tests__/load-skills.test.ts -t 'malformed'` → 1/1 pass.
74. `[LIVE]` Run `bun test sdk/e2e/custom-agents/apply-patch-tool.e2e.test.ts` → 1/1 pass (or skip).
75. `[LIVE]` Run `bun test sdk/src/**/*` full suite → 488/488 expected pass.

---

## Section 13: Typecheck (FID-015 + FID-016 regression)

76. `[LIVE]` `bun run --cwd=common typecheck` → exit 0, no errors.
77. `[LIVE]` `bun run --cwd=agent-runtime typecheck` → exit 0.
78. `[LIVE]` `bun run --cwd=cli typecheck` → exit 0.
79. `[LIVE]` `bun run --cwd=sdk typecheck` → exit 0.

---

## Section 14: Right Sidebar (FID-016 visual)

80. `[LIVE]` Confirm "One Mind. A Thousand Faces." tagline visible (single line).
81. `[LIVE]` Confirm TokenMeter shows inline (single row).
82. `[LIVE]` Confirm Model name shows full (20 chars, not 14).
83. `[LIVE]` Confirm Context section has own bordered sub-section.
84. `[LIVE]` Confirm ECHO Protocol section above Session.
85. `[LIVE]` Drive transition → confirm phase color updates (red=#ef4444, green=#39ff14, audit=#eab308).

---

## Section 15: Status Banner & Working Indicator (FID-008 F10)

86. `[LIVE]` During thinking → confirm banner shows "thinking..." (not just "working").
87. `[LIVE]` During tool execution → confirm banner shows tool name.
88. `[LIVE]` During subagent spawn → confirm banner shows agent name.
89. `[LIVE]` After idle → confirm banner resets to ready/prompt.

---

## Section 16: ECHO Roster Fidelity (ECHO.md ↔ agent runtime)

90. `[SOURCE]` Confirm ECHO.md agent table matches all 9 directories in `agents/`.
91. `[SOURCE]` Confirm savant-free-legacy agents removed (any in `agents/` not listed in ECHO.md is a violation).
92. `[SOURCE]` Confirm 4 FREEBUFF_GEMINI_THINKER_* variants consolidated into Verifier (FID-006).

---

## Section 17: CLI Edge Cases

93. `[LIVE]` Drive `/exit` → confirm clean shutdown, session summary saved.
94. `[LIVE]` Drive empty message → confirm ignored (no error).
95. `[LIVE]` Drive very long message → confirm streamed back.
96. `[LIVE]` Drive message with markdown → confirm rendered correctly.
97. `[LIVE]` Drive multi-line agent output → confirm pagination/scroll works.

---

## Section 18: Database & Persistence (FID-005)

98. `[SOURCE]` Read `packages/database/` → confirm `~/.savant/data.db` path (not savant-free).
99. `[LIVE]` Confirm session state persists across restarts.
100. `[LIVE]` Confirm cost/tokens tracked across sessions in DB.

---

## Section 19: Bundled Agents (FID-007 + FID-006 sync)

101. `[SOURCE]` Read `packages/agent-runtime/src/tools/handlers/tool/bundled-agents.generated.ts` → confirm Scout + Detective + Verifier + Forge + Recorder + Scribe all present.
102. `[SOURCE]` Confirm Scout + MCP timeout changes reflected (rebuild if needed).
103. `[LIVE]` Drive spawn_agents with each type → confirm all return valid results.

---

## Section 20: End-to-End Coding Flow

104. `[LIVE]` Start session, describe simple feature → confirm Orchestrator creates FID.
105. `[LIVE]` FID goes RED → GREEN → AUDIT → COMPLETE → confirm all phases visible.
106. `[LIVE]` Confirm file Git diff shows only approved changes.
107. `[LIVE]` Drive tool failure (e.g., invalid path) → confirm error caught + agent retries or self-corrects.
108. `[LIVE]` Drive oscillation (same error 3x) → confirm circuit breaker detects.

---

## Section 21: Free-Buff Mode Considerations (future)

109. `[SOURCE]` Confirm IS_FREEBUFF constant exists.
110. `[SOURCE]` Confirm savant-free-model-store.ts present (uses model selection).
111. `[SOURCE]` Confirm ad-supported flow paths marked but not blocking paid free flow.

---

## Reporting Format

For each item, output:
```
### Item N: [SHORT_TITLE]
**Status:** PASS / FAIL / SKIP
**Mode:** [LIVE] / [SOURCE]
**Evidence:** [file path, line number, or command output]
**Error:** [exact error message if FAIL]
**Timestamp:** [HH:MM]
```

End with summary table: passes count, fails count, skips count, blockers list.

---

## Pre-Rebrand Blockers

Any FAIL in Sections 3 (FSM sync), 6 (tool gating), 8 (circuit breakers), 12-13 (tests/typecheck), or 15 (banner sync) IS A BLOCKER. Fix before rebrand.

All other FAILs are release candidates - triage and ship with known issues list.

---

**Run by:** Savant Orchestrator (you)
**Audited by:** Nova (external ECHO compliance review)
**Approved by:** Creator (user)
