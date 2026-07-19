# FID: A–Z Feature Test Report — 7 Code Findings

**Filename:** `FID-2026-0718-002-feature-test-report.md`
**ID:** FID-2026-0718-002
**Severity:** high
**Status:** closed
**Created:** 2026-07-18
**Closed:** 2026-07-18
**Author:** Orchestrator
**Source:** `dev/FEATURE-TEST-REPORT.md` (A–Z Feature Test Report, 2026-07-18)

---

## Summary

A comprehensive A–Z feature test of the Savant-Code runtime (16 sub-agents, all direct tools, FSM gating, render_ui widgets, skill loading) surfaced 7 code/documentation findings. 21 tests passed, 4 failed due to environmental issues (no network, no tmux, unprovisioned docs backend), 3 were degenerate/partial. The 7 code findings are all fixable and concentrated in `transition-phase.ts` (FSM handler) and `README.md`.

**Root-cause cluster:** Two features claimed in CHANGELOG (FID-2026-0717-009 and FID-2026-0717-007) were never actually implemented in the handler code — `hasOpenFids()` gate and `iterationCount` enforcement were documented as complete but absent from `transition-phase.ts`.

## Environment

- **OS:** Windows 11
- **Language/Runtime:** TypeScript / Bun 1.3.11
- **Branch:** main
- **Report:** `dev/FEATURE-TEST-REPORT.md`

---

## Detailed Description

### Findings Overview

| ID | Severity | Finding | File | Status |
|----|----------|---------|------|--------|
| C1 | 🔴 High | `hasOpenFids()` FSM gate absent | `transition-phase.ts` | ✅ Fixed |
| C2 | 🟡 Medium | `Promise<any>` violates Law 6 | `transition-phase.ts:20` | ✅ Fixed |
| C3 | 🟡 Medium | Rejected FSM transitions logged at `debug` only | `transition-phase.ts:31` | ✅ Fixed |
| C4 | 🟢 Low | `reason` field accepted but never stored | `transition-phase.ts:27` | ✅ Fixed |
| C5 | 🟢 Low | FSM phase non-durable (in-memory only) | `transition-phase.ts` | ✅ Documented |
| C6 | 🟢 Low | Stale README link: `sst/opentui` → `anomalyco/opentui` | `README.md` | ✅ Fixed |
| C7 | 🟢 Low | `bun run dev --version` emits no version string | CLI | ⏭️ Deferred |

---

## Perfection Loop

### RED Phase — Issue Identification

**R1 — `hasOpenFids()` FSM gate is absent (C1) — HIGH**

CHANGELOG entry for FID-2026-0717-009 claims:
> *"Added hasOpenFids() check in transition-phase.ts — blocks red→green transition if no FID-*.md files exist in dev/fids/. Uses fs.readdirSync for simplicity."*

Evidence — current handler at `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts` (57 lines):
- Does NOT import `fs` or `path`
- Does NOT check for FID files on disk
- Does NOT block `red→green` when no FIDs exist
- `common/src/util/protocol-config.ts` has `scanOpenFids()` which reads `dev/fids/` and returns `openFids: string[]`, but NOT called from transition handler
- Call-graph grep for `hasOpenFids` returns 0 matches across all `.ts` files

**R2 — `iterationCount` enforcement is absent (C1 related) — HIGH**

CHANGELOG entry for FID-2026-0717-007 claims:
> *"Added iterationCount field to AgentState with default 0. Enforced hard stop at 10 iterations in transition-phase.ts"*

Evidence — grep for `iterationCount` in `transition-phase.ts` returns 0 matches. The only `iterationCount` usage is in `truncate-file-tree.ts` (unrelated).

**R3 — `Promise<any>` violates Law 6 (C2) — MEDIUM**

File: `transition-phase.ts:20` — `previousToolCallFinished: Promise<any>`. Compare with `tool-executor.ts:189` which passes `Promise<void>`.

**R4 — Rejected transitions logged at `debug` only (C3) — MEDIUM**

File: `transition-phase.ts:31` — `logger.debug(...)` for both successful and rejected transitions.

**R5 — `reason` field unused (C4) — LOW**

File: `transition-phase.ts:27` — `reason` extracted but only included in response message string, not logged.

**R6 — FSM phase non-durable (C5) — LOW**

Handler only mutates in-memory `agentState.fsmPhase`. No persistence across restart.

**R7 — Stale README link (C6) — LOW**

`README.md` references `github.com/sst/opentui` which redirects to `github.com/anomalyco/opentui`.

**R8 — `--version` emits no output (C7) — LOW**

`bun run dev --version` accepts flag but emits no version string. Deferred to separate investigation.

---

### GREEN Phase — Proposed Fixes (Refined by Thinker)

**G1 — Restore `hasOpenFids()` gate (fixes R1)**

Read FIDs dynamically from filesystem via `readProtocolConfig(fileContext.cwd).openFids` (not AgentState — FIDs change during sessions). Block ALL entries to `green` when no FIDs (both `red→green` AND `self_correct→green`).

**G2 — Restore `iterationCount` enforcement (fixes R2)**

Add `iterationCount: number` to `AgentState` (default 0). NOT inherited by subagents (only Orchestrator runs Perfection Loop). Hard stop at 10 on `self_correct→green`. Increment on valid `self_correct→green`. Reset on `audit→complete`. Polite rejection message directing agent to transition to `complete`.

**G3 — Fix `Promise<any>` → `Promise<void>` (fixes R3)**

**G4 — Elevate rejection logging (fixes R4)**

`logger.warn` for rejections, `logger.debug` for successes.

**G5 — Log `reason` in structured output (fixes R5)**

Include `reason` in logger fields on success path.

**G6 — Document FSM non-durability (fixes R6)**

Add doc comment explaining session-scoped design.

**G7 — Update README opentui link (fixes R7)**

**G8 — Defer `--version` fix (fixes R8)** — separate FID.

---

### AUDIT Phase — Verification

| # | Check | Result |
|---|-------|--------|
| 1 | `readProtocolConfig` gate blocks `green` when no FIDs | ✅ Verified in handler |
| 2 | `iterationCount` enforced at 10 | ✅ Verified in handler |
| 3 | `Promise<void>` type | ✅ Verified — no `any` |
| 4 | Rejection logging at `warn` | ✅ `logger.warn` for invalid transitions |
| 5 | `reason` in structured log | ✅ Included in success `logger.debug` fields |
| 6 | FSM non-durability documented | ✅ Doc comment present |
| 7 | README link updated | ✅ `anomalyco/opentui` |
| 8 | common typecheck | ✅ Pass (zero errors) |
| 9 | agent-runtime typecheck | ✅ Pass (pre-existing `agents-graveyard` only) |
| 10 | Code review | ✅ Approved (3 corrections applied) |

---

### SELF-CORRECT Phase

**Finding 1:** Duplicated `scanOpenFids` function in handler.

**Correction:** Removed local copy, imported `readProtocolConfig` from `@savant-code/common/util/protocol-config` instead.

**Finding 2:** Inline `fileContext: { cwd: string }` type.

**Correction:** Changed to `ProjectFileContext` import from `@savant-code/common/util/file`.

**Finding 3:** `reason` not in structured log data on success path.

**Correction:** Already included — `logger.debug({ transition, reason, iterationCount }, 'FSM transition OK')`. Verified by code reviewer.

---

### COMPLETE Phase

FID converged. All 6 actionable findings (C1–C6) fixed. C7 deferred.

---

## Resolution

- **Fixed By:** Orchestrator (GREEN) + Forge (implementation)
- **Verified By:** typecheck (common ✅, agent-runtime ✅), code-reviewer-mimo-pro (approved)
- **Archived:** 2026-07-18

## Lessons Learned

1. **CHANGELOG ≠ Code** — Two features were documented as complete but never implemented. AUDIT must verify code existence, not just documentation.
2. **`scanOpenFids` existed but wasn't wired** — Infrastructure for FID-Bound Execution existed in `protocol-config.ts` but was never connected to the FSM handler. Wiring gaps are the hardest to catch.
3. **Feature test reports are invaluable** — The A–Z test surfaced issues that static analysis and unit tests would miss.
4. **Read FIDs dynamically** — FIDs change during sessions (create, rename, archive). Boot-time population becomes stale. Dynamic filesystem reads in the handler are the correct approach.
5. **Circuit breakers need polite rejections** — When hitting the iteration limit, the rejection message must direct the agent to `complete`, not just deny the transition.
