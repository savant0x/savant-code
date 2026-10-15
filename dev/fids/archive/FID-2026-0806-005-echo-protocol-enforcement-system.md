# FID: ECHO Protocol Enforcement System (3-Layer)

**Filename:** `FID-2026-0806-005-echo-protocol-enforcement-system.md`
**ID:** FID-2026-0806-005
**Severity:** high
**Status:** closed — implemented + verified (2026-08-06)
**Created:** 2026-08-06
**Author:** Savant
**YAGNI-Compliance:** Verified

---

## Summary

Nova inbox request `dev/nova/inbox/2026-08-06-echo-enforcement-feature-request.md`:
the agent does not read the governing protocol at session start, and the existing
ECHO Harness Enforcement Layer (EHEL, FID-2026-0805-007) is reactive only —
it never forces the protocol into the context window. This FID converges the
design for a 3-layer enforcement system: a session-init hard gate, a 15-turn
protocol refresh, and compaction protection for protocol content, plus
session-init file requirements and subagent phase enforcement.

## Environment

- **OS:** Windows 11 (win32, bash)
- **Runtime:** Bun 1.3.14
- **Repo state:** v0.0.21 working tree (`main` + 1 local commit)
- **Governance:** Savant protocol adaptation v0.1.2 governs this session; the
  file this FID protects is `ECHO.md` (Savant harness v0.2.0) by default,
  configurable for other harnesses (Savant uses
  `dev/nova/specs/echo-v0.1.2-single-agent.md`)

## Detailed Description

### Problem

Evidence from the A-Z audit transcript (`dev/test-prompts/az-test-v0.0.21-release.md` run):

1. The agent jumped straight into tool use without reading the protocol first.
2. Basher subagents failed because `run_terminal_command` is phase-gated
   (`run_terminal_command` is only available during AUDIT or GREEN phases) and
   the parent never transitioned the phase before spawning them.
3. `AGENTS.md` says "read ECHO.md 0-EOF first" but it is a prompt-level
   suggestion, not structural enforcement — the entire governance model depends
   on the agent's willingness to comply.

### Expected Behavior

- Agent cannot make tool calls without reading the protocol first.
- Protocol summary is re-injected every 15 turns.
- Context compactor never removes protocol content.
- Subagents are in the correct phase before spawning.
- Session init reads the required files (protocol, architecture, config, lessons).

### Root Cause

EHEL is per-tool / per-turn reactive: `beforeToolCall` tracks `filesRead`
(`packages/agent-runtime/src/echo/enforcement.ts:61-67`) but never gates on a
session-init protocol read. There is no turn counter, no refresh hook, and no
compaction protection for protocol content. Subagent phase is the caller's
responsibility with no enforcement or guidance.

### Evidence

- `packages/agent-runtime/src/echo/enforcement.ts:60-108` — `beforeToolCall`
  tracks reads/searches/intent but returns `{ blocked: false }` unless a
  pre-write gate fails. No session-init gate exists.
- `packages/agent-runtime/src/echo/types.ts:14-70` — `EnforcementState` has no
  `protocolRead` or `turnCount` field.
- `packages/agent-runtime/src/echo/enforcement-state.ts:14-36` — state
  initializer confirms the missing fields.
- `packages/agent-runtime/src/run-agent-step/loop-iteration.ts:341` — the only
  EHEL touchpoint in the loop is `takeSteeringMessages()`; no refresh injection.
- `packages/agent-runtime/src/context-compactor.ts:350-390` — the preserve set
  covers first message, images, `<conversation_summary>` and
  `<structured_state>`; there is no protocol-content protection.
- Transcript: basher subagents blocked at idle phase (phase-gated terminal).
- `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts` — spawn
  handler exists; no protocol-state seeding for subagents.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/echo/types.ts` (state fields)
- `packages/agent-runtime/src/echo/enforcement-state.ts` (initializer)
- `packages/agent-runtime/src/echo/enforcement.ts` (session-init gate)
- `packages/agent-runtime/src/run-agent-step/loop-iteration.ts` (refresh hook)
- `packages/agent-runtime/src/context-compactor.ts` (protection)
- `agents/savant/system-prompt.ts` (subagent phase rule + session-init list)
- `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts` (seed state)

### Risk Level

- [x] High: Major governance gap, no workaround (protocol can be ignored)

## Proposed Solution

### Approach

Extend EHEL with three structural layers. The protocol file is configurable
(`requiredProtocolFile`, default `ECHO.md`) so the same layer serves both the
Savant harness and the Savant adaptation without forking.

### Steps

1. **Layer 1 — session-init hard gate**
   - Add `protocolRead: boolean` and `turnCount: number` to `EnforcementState`
     (`echo/types.ts`), initialize in `enforcement-state.ts`.
   - In `beforeToolCall` (`enforcement.ts`): when `!state.protocolRead`, allow
     only `read_files` / `read_subtree` / `ask_user` / `write_todos`; block all
     other tools with reason "Must read {requiredProtocolFile} 0-EOF before
     using tools". Clear the gate when a read targets the protocol file.
   - Gate applies to the Orchestrator conversation only; subagent spawn seeds
     `protocolRead = true` because the parent already read the protocol.
2. **Layer 2 — 15-turn refresh**
   - `loop-iteration.ts`: when `turnCount % 15 === 0` and protocol is read,
     inject a condensed protocol summary (new `echo-summary.ts` util, bounded
     to ~800 tokens) into the agent's history.
3. **Layer 3 — context protection**
   - `context-compactor.ts`: preserve any message containing the sentinel
     `<!--echo-critical-->` (placed around the protocol block at prompt build),
     adding it to `preservedIndices` like the existing preserved-state block
     (lines 350-390). System-prompt-injected copies need no protection (the
     compactor never touches system messages) — the sentinel covers user-message
     injection paths.
4. **Session-init files (advisory)**
   - `agents/savant/system-prompt.ts`: session-init checklist for
     `ARCHITECTURE.md`, `protocol.config.yaml`, `dev/LEARNINGS.md`; hard gate
     remains the protocol file only (avoids over-blocking non-Savant harnesses).
5. **Subagent phase enforcement**
   - `system-prompt.ts` Orchestrator rule: before spawning a terminal-capable
     subagent, ensure phase is AUDIT or GREEN (use `transition_phase`).
   - Advisory in `spawn-agents.ts`: if a spawned agent needs terminal while the
     caller phase is idle, emit a compliance warning steering the transition.
6. **Optional `/refresh-echo`** (`cli/src/commands/defs/core.ts`) — deferred:
   YAGNI, the 15-turn refresh covers the need.

### Verification

- Unit tests: `echo/__tests__/enforcement.test.ts` — gate blocks non-read tools,
  clears on protocol read, refresh fires at turn 15, subagent spawn seeds state.
- Compactor test: protocol-sentinel message survives compaction.
- Typecheck x4 (`sdk`, `common`, `agent-runtime`, `cli`) and `eslint --max-warnings 0`.

## Perfection Loop

### Loop 1

- **RED:** (1) No session-init gate; (2) no refresh; (3) no compaction
  protection; (4) subagent phase unenforced; (5) advisory-only session-init
  reads; (6) transcript evidence of both failures.
- **GREEN:** Layers 1-3 + session-init list + subagent seeding/steering above.
- **AUDIT:** All evidence claims verified against the cited `file:line`
  locations (see Evidence section; files confirmed to exist on 2026-08-06).
  `EnforcementState` fields confirmed absent (`echo/types.ts:14-70` NO-MATCH for
  `protocolRead`). Refresh hook location confirmed (`loop-iteration.ts:341`).
  Preserve-set logic confirmed (`context-compactor.ts:350-390`).
- **ADVERSARIAL:** (i) REFUTED — "a hard gate breaks first-turn user requests":
  the gate still permits `ask_user`, `write_todos` and all read-only context
  tools, so clarification and context gathering remain possible pre-read.
  (ii) CONFIRMED — gate must be configurable per harness (Savant protocol file
  differs from `ECHO.md`); default `ECHO.md` with config override. (iii)
  ADJUSTED — subagents must be seeded `protocolRead = true` at spawn or every
  spawned agent re-reads the protocol; seeding is the robust default.
  Verdicts override. No FAILs.
- **CHANGE DELTA:** N/A — design FID; implementation pending Forge.

### Missed Questions

1. Q: Which protocol file is mandatory — `ECHO.md` or the Savant spec?
   A: Configurable `requiredProtocolFile`, default `ECHO.md`; the Savant
   adaptation sets it to `dev/nova/specs/echo-v0.1.2-single-agent.md`.
2. Q: Does the gate block legitimate read-only auditors?
   A: No — all read-only context tools remain allowed; only mutating/complex
   tools are blocked until the protocol is read.
3. Q: Do subagents inherit the gate?
   A: No — spawn seeds `protocolRead = true`; the parent's read satisfies it.
4. Q: Is compaction protection even needed if the protocol is in the system
   prompt (never compacted)?
   A: Yes — the harness also injects protocol content into user/history
   messages; the sentinel covers those paths at ~zero cost.
5. Q: Should the refresh be a full re-read or a summary?
   A: Summary (≤800 tokens, distilled laws) — a full re-read burns context; the
   gate guarantees the full read happened at session start.

### Code Verification Evidence

- [x] All files cited in "Affected Components" exist (verified 2026-08-06)
- [x] Implementation matches the proposed solution (implemented 2026-08-06)
- [x] Typecheck passes: typecheck x4 exit 0 (sdk/common/agent-runtime/cli)
- [x] FID status updated to reflect actual implementation state (closed)

### Loop 2 — Final AUDIT + ADVERSARIAL (2026-08-06)

**AUDIT (double-audit via live tool output):**

| Claim | Check | Result |
|---|---|---|
| No `protocolRead`/`turnCount` in EHEL | `grep -rn 'protocolRead|turnCount' packages/agent-runtime/src/echo/` | NO-MATCH — confirmed absent |
| `beforeToolCall` tracks reads only | `enforcement.ts:60-66` | Confirmed |
| Refresh hook point | `loop-iteration.ts:338-344` | `takeSteeringMessages` drain confirmed |
| Compactor preserve set | `context-compactor.ts:350-362` | preserved-state block confirmed |
| Spawn + system-prompt files | `ls spawn-agents.ts system-prompt.ts` | Both exist |

**ADVERSARIAL verdicts (verdicts override):**

1. ADJUSTED — the 15-turn refresh message must itself carry the
   `<!--echo-critical-->` sentinel and dedupe per turn, so the compactor never
   drops the re-injected protocol. Folded into Layer 2/3.
2. CONFIRMED — the gate lives in the agent tool executor (EHEL), not the CLI
   command router; slash commands (`/help` etc.) are unaffected. NEEDS-REVIEW
   at implementation: confirm `EchoEnforcement` hooks only the agent tool path.
3. ADJUSTED — protocol-path matching must normalize (resolve + basename) so a
   lookalike file elsewhere cannot clear the gate. Folded into Layer 1.
4. ADJUSTED — if the configured protocol file is missing at session init, log
   and auto-satisfy the gate (cannot read what does not exist) with an operator
   notice. Folded into Layer 1.

**Convergence:** adjustments folded; zero actionable improvements remain (delta
< 2% — document-only additions). Nova audit: APPROVED (2026-08-06). Loop
terminated -> COMPLETE state. Awaiting operator approval for IMPLEMENT.

## Resolution

- **Fixed By:** Savant
- **Fixed Date:** 2026-08-06
- **Fix Description:** Implemented Layer 1 (protocolRead gate in
  `EchoEnforcement.beforeToolCall`, strict-only, configurable protocol file),
  Layer 2 (`onStepBoundary` 15-turn refresh wired in `loop-iteration.ts`,
  `protocol-summary.ts` condensed summary + sentinel), Layer 3 (compactor
  preserves `<!--echo-critical-->` messages), subagent pre-seeding
  (`protocolPreSeeded` from `parentId` in `native.ts`), system-prompt
  session-init + subagent phase rules.
- **Tests Added:** Yes — 8 enforcement gate/refresh tests, 1 compactor sentinel
  test, strict wiring test updated (read gate before Law 7 block)
- **Verified By:** typecheck x4 exit 0; eslint 0; lint:md clean;
  agent-runtime 755/0; echo suite 29/29; compactor 9/9
- **Status:** closed
- **Archived:** 2026-08-06

## Lessons Learned

Prompt-level suggestions are not enforcement. Structural gates must live in the
harness (EHEL), the protocol file must be configurable across harnesses, and
subagent lifecycle must seed enforcement state rather than restarting it.
