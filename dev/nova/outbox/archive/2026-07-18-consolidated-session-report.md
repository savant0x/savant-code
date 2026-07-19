# Orchestrator → Nova — Consolidated Session Report

**Date:** 2026-07-18
**From:** Orchestrator (Savant)
**To:** Nova
**Scope:** Full session summary — 4 FIDs completed, 33 files changed, 40+ questions answered via Perfection Loop

---

## Session Overview

This session implemented the ECHO Protocol across the Savant-Code agent framework. Four FIDs were opened, run through the Perfection Loop, verified, and archived. All changes are typecheck-clean and code-reviewed.

| FID | Severity | Status | Files | Key Outcome |
|-----|----------|--------|-------|-------------|
| FID-2026-0718-003 | high | ✅ Closed | 9 | Secret dev override system for testing |
| FID-2026-0718-004 | critical | ✅ Closed | 4 | FSM phase inheritance fix for subagents |
| FID-2026-0718-006 | high | ✅ Closed | 24 | Agent roster aligned to 9-agent Savant spec |
| FID-2026-0718-007 | high | ✅ Closed | 3 | Scout file-finding + MCP proxy timeout |

---

## FID-2026-0718-003 — Dev Override System

**Problem:** No way to bypass ECHO Protocol runtime restrictions during testing.

**Solution:** Secret `/dev <passphrase>` command activates dev override mode.

**What it bypasses (when active):**
1. Agent tool restrictions — any agent can use any tool
2. Write tools GREEN gate — `write_file`, `str_replace`, `apply_patch` work in any phase
3. Bash AUDIT gate — `run_terminal_command` works in any phase
4. Sequential thinking Thinker gate — any agent can use `sequentialthinking`

**Security:** Wrong passphrase shows "Command not found". NOT in `/help` or autocomplete. Session-scoped, resets on `/new`. Sidebar shows `[DEV MODE]` badge.

**Data flow:** `chat-store.devMode` → `createRunConfig` → `RunOptions` → `runOnce()` → `initialSessionState()` → `ProjectFileContext.devMode` → `tool-executor` reads `params.fileContext.devMode`

**Files changed (9):** `common/src/util/file.ts`, `cli/src/state/chat-store.ts`, `cli/src/commands/command-registry.ts`, `packages/agent-runtime/src/tools/tool-executor.ts`, `sdk/src/run-state.ts`, `sdk/src/run.ts`, `cli/src/utils/create-run-config.ts`, `cli/src/hooks/use-send-message.ts`, `cli/src/components/right-sidebar.tsx`

**Verification:** typecheck ✅ (common, agent-runtime, sdk, cli — zero errors)

---

## FID-2026-0718-004 — A-Z Test Report Findings (FSM Inheritance)

**Problem:** A-Z system test (192 items) revealed subagents always evaluate FSM phase as `idle` because `createAgentState()` didn't inherit `fsmPhase` or `iterationCount` from parent.

**Fixes (3):**
1. **FSM phase inheritance** — `createAgentState()` in `spawn-agent-utils.ts` now inherits `fsmPhase` and `iterationCount` from parent. Subagents spawned during GREEN can use write tools; during AUDIT can use bash.
2. **Test expectation corrected** — `self_correct → green` (not `→ red`) matches ECHO spec.
3. **Cleanup** — Duplicate Phase 3 section removed, scratch file deleted.

**Files changed (4):** `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts`, `dev/test-prompts/comprehensive-az-system-test.md`, `CHANGELOG.md`, `dev/test-write.txt` (deleted)

**Verification:** typecheck ✅ (agent-runtime zero errors), code review ✅

---

## FID-2026-0718-006 — Agent Roster Alignment

**Problem:** 69-agent Codebuff codebase not aligned to 9-agent Savant architecture specified in ARCHITECTURE.md.

**Solution:** 13 fixes across 24 files through full Perfection Loop (RED → GREEN → AUDIT → SELF-CORRECT → RE-AUDIT → COMPLETE).

| Fix | What | Files |
|-----|------|-------|
| 1 | Strip write tools from Orchestrator | base2.ts, base-deep.ts |
| 2 | Update spawnableAgents to Savant roster | base2.ts, base-deep.ts |
| 3 | Add search tools to Detective | detective.ts |
| 4 | Fix grep → code_search | recorder.ts, scribe.ts |
| 5-6 | Remove providerOptions from Thinker/Verifier | thinker.ts, verifier.ts |
| 7 | Update FREE_MODE_AGENT_MODELS (8 reviewers → 1 verifier) | free-agents.ts |
| 8 | Rewrite all system prompts to reference Savant agents | base2.ts, base-deep.ts |
| 9 | Update ECHO_PROTOCOL_INSTRUCTIONS to v0.2.0 | common/constants/agents.ts |
| 10 | withParentModel() inherits providerOptions | spawn-agent-utils.ts |
| 11 | Fix Scout to delegate to Detective | scout.ts |
| 12 | Fix context-pruner sentAt type error | context-pruner.ts |
| 13 | Delete 20+ absorbed Codebuff agent files | general-agent/, reviewer/*, etc. |

**Operator decisions:** Strict separation (Orchestrator has no write tools), single Thinker (inherits parent model), Verifier has NO tools (reads only), pure merge (all Codebuff capabilities absorbed into Savant agents), free-mode infrastructure preserved.

**Files deleted (20+):** `agents/general-agent/`, `agents/reviewer/` (10 variants), `agents/editor/editor-gpt-5.ts`, `agents/thinker/best-of-n/` (4 files), `agents/file-explorer/` (4 files), 2 test files.

**Verification:** typecheck ✅ (agents, common, agent-runtime — zero errors), code review ✅ (approved after 3 corrections)

---

## FID-2026-0718-007 — Scout Delegation Quality + MCP Proxy Timeout

**Problem (A):** Scout delegated file-finding to Detective (code_search/ripgrep), which searched file *contents* instead of file *names*. Zero results for most queries.

**Fix A:** Rewrote Scout to use `glob` + `list_directory` directly:
- Added `extractKeywords()` helper — strips stop words, punctuation, deduplicates
- Programmatic `glob` with `**/*keyword*` patterns per keyword
- STEP yield for LLM-driven deeper exploration
- Stripped Detective from spawnableAgents, added glob/list_directory tools

**Problem (B):** No timeout on `client.connect()`, `client.callTool()`, or `client.listTools()`. Hanging MCP server blocks agent indefinitely. One unreachable server blocks `Promise.all` for ALL servers.

**Fix B:**
- `withTimeout()` helper (Promise.race + setTimeout + .finally cleanup)
- connect: 30s default, callTool: 60s default, listTools: 60s default
- `transport.close()` in catch — prevents orphaned child processes on timeout
- `MAX_TIMEOUT_MS = 300_000` hard cap (5 minutes)
- Optional `timeout` field added to MCP config schema
- `listToolsCache` clears on rejection to allow retries

**Files changed (3):** `common/src/types/mcp.ts`, `common/src/mcp/client.ts`, `agents/scout/scout.ts`

**Perfection Loop:** 4 rounds, 22 questions answered, converged. Key edge cases resolved: orphaned child processes (transport.close), race conditions (transport death severs late-resolving connect), max timeout cap, listTools hang.

**Verification:** typecheck ✅ (common, agents — zero errors), code review ✅ (approved after 2 corrections)

---

## Pre-Existing Bugs Fixed This Session

Per ECHO Protocol: pre-existing bugs are fixed when found, not deferred.

| Bug | Location | Fix |
|-----|----------|-----|
| `grep` tool doesn't exist | recorder.ts, scribe.ts | Changed to `code_search` |
| `sentAt` type error | context-pruner.ts | `in` operator narrowing + cast |
| ECHO version mismatch (v0.1.2) | common/constants/agents.ts | Updated to v0.2.0 |
| stale `file-lister` error message | scout.ts | Removed in FID-007 rewrite |

---

## Test Prompt Updated

`dev/test-prompts/comprehensive-az-system-test.md` updated with:
- 21 new dev override tests (2B.1–2B.8)
- Corrected self_correct FSM test
- Total test items: 171 → 192

---

## Open Items for Nova

1. **Agent roster completeness** — Verify the 9-agent roster matches ARCHITECTURE.md spec
2. **FSM inheritance** — Verify `createAgentState()` correctly propagates `fsmPhase` and `iterationCount`
3. **Scout file-finding** — Verify glob-based approach produces better results than the old Detective delegation
4. **MCP timeout** — Verify timeout values (30s/60s/300s cap) are reasonable for production use
5. **Dev override security** — Verify passphrase protection and invisibility to `/help`
6. **Transport cleanup** — Verify `transport.close()` on timeout prevents orphaned processes
7. **listToolsCache retry** — Verify `.catch()` clears cache correctly on timeout

---

## Verification Summary

| Package | Typecheck | Notes |
|---------|-----------|-------|
| common/ | ✅ zero errors | MCP config, agents.ts, free-agents.ts |
| packages/agent-runtime/ | ✅ zero errors | spawn-agent-utils.ts, tool-executor.ts |
| agents/ | ✅ zero errors | scout.ts, base2.ts, base-deep.ts, detective.ts, recorder.ts, scribe.ts, thinker.ts, verifier.ts, context-pruner.ts |
| sdk/ | ✅ zero errors | run.ts, run-state.ts |
| cli/ | ✅ zero errors | chat-store.ts, right-sidebar.tsx, use-send-message.ts |

All changes code-reviewed by `code-reviewer-mimo-pro` and approved.

---

*This report consolidates 4 individual outbox files into a single audit document. Original files archived to `dev/nova/outbox/archive/`.*
