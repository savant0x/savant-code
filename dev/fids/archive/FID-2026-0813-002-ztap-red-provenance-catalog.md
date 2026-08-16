<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: ZTAP RED — Provenance Capture Catalog

**Filename:** `FID-2026-0813-002-ztap-red-provenance-catalog.md`
**ID:** FID-2026-0813-002
**Severity:** medium
**Status:** closed
**Planning Status:** Converged after Perfection Loop; implementation executes per Proposed Solution.
**Created:** 2026-08-13
**YAGNI-Compliance:** Complete — implementation scope delivered
**Master FID:** FID-2026-0813-001
**Depends On:** none

---

## Summary

The RED-phase catalog for ZTAP: an exhaustive, code-verified inventory of what EHEL already captures per write, what it
does not capture, and exactly where the write boundary and phase-completion hooks live. The catalog is the ground
truth that `FID-2026-0813-003` (crypto) and `FID-2026-0813-004` (interception) build against, and it produces the
`EchoComplianceTracker` field extensions needed so receipts can carry agentId, fsmPhase, and a structured FID id
instead of heuristics.

## Environment

- **OS:** Windows (`win32`); cross-platform runtime (Bun)
- **Language/Runtime:** TypeScript monorepo (`strict: true`), Bun 1.3.14
- **Targets:** `packages/agent-runtime/src/tools/tool-executor/`, `packages/agent-runtime/src/echo/`,
  `packages/agent-runtime/src/util/echo-compliance.ts`, `common/src/types/contracts/trace.ts`
- **Master:** `FID-2026-0813-001-ztap-provenance-master.md` (D9, D10, RED catalog)

## Detailed Description

### Problem

FID-2026-0813-001's RED pass found the per-write capture surface incomplete for provenance: the write record lacks
agent identity, FSM phase, and a structured FID id; law-check results are in-memory only; Verifier/Adversary verdicts
have no structured record; and the interception site naming in the source build order (`tool-executor.ts`) points at a
re-export shim rather than the real executor. Implementation of the signed chain requires an exact catalog before
wiring.

### Expected Behavior

A catalog that answers, for every agent write: what is captured today (field, source, persistence), what is missing,
and the precise call sites where write-time receipt creation and phase-completion verdict binding must hook.

### Root Cause

EHEL enforcement state is per-session and in-memory (`EnforcementState`, `EchoComplianceTracker.writes`); persistence,
identity, and structured verdicts were never part of the original enforcement design.

### Evidence

- `packages/agent-runtime/src/tools/tool-executor/native.ts:351` — `echoCompliance.recordWrite` receives
  `{path, lineDelta, contentKnowledge, isNewFile, content, securitySensitive}`; no agentId, no fsmPhase, no FID id.
- `packages/agent-runtime/src/util/echo-compliance.ts:166` — `recordWrite` definition; `:252` `getTouchedFidId` is a
  path-regex heuristic (`/(FID-\d{4}-\d{4}-\d{3})/i`).
- `packages/agent-runtime/src/echo/types.ts:9-70` — `EnforcementState` is entirely in-memory (Sets/Maps, no
  persistence).
- `packages/agent-runtime/src/tools/tool-executor/custom.ts:76` — custom tools are read/network-only; no write
  adapter exists, so the native executor is the only signing site.
- `agents/adversary/adversary.ts:64-84` — Adversary output is a text verdict list; no structured verdict type exists.
- `common/src/types/contracts/trace.ts:4` — `RuntimeTraceEvent` already records per-tool lifecycle events with
  agentId/agentType/phase; `cli/src/utils/trace-writer.ts:31` bounds events (`MAX_RUNTIME_EVENTS`).

## Catalog (Converged Output)

| Dimension | Today | Gap for ZTAP |
|---|---|---|
| Write path + tool | native executor (`native.ts:351`); write_file/str_replace/apply_patch | None — use resolved path + tool name |
| Post-write content | `getSuccessfulFileContent` via `fileProcessingState` (`native.ts:611` region) | None — hash directly |
| Writer agent id | Not in write record (trace event has it at `native.ts:99`) | Add `agentId` to write record |
| Writer agentType/role | Not in write record | Add `agentType` (drives per-role key) |
| FSM phase | `agentState.fsmPhase` available but not recorded | Add `fsmPhase` to write record |
| FID id | Path-regex heuristic (`echo-compliance.ts:252`) | Structured resolution: active-FID path set (already computed for `fidPaths`), exact match + `dev/fids/` non-archive rule |
| Law-check results | In-memory `advisoryWarnings` + `EnforcementState` | Persisted `lawChecks` per receipt: pre-write gate outcomes (law, outcome blocked\|advisory\|passed) — added to the master schema (fixes F4) |
| Verifier verdict | Text output of Verifier subagent; no record | Signed verbatim payload at AUDIT completion (D7) |
| Adversary verdict | Text verdict list (`adversary.ts:64-84`) | Signed verbatim payload at ADVERSARIAL completion (D7) |
| Event stream | `RuntimeTraceEvent`/`traceWriter` | Reuse shape; add bounded `provenance_receipt` event type |
| Ledger | None | `.savant/provenance/<sessionId>/` (D5) |

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/util/echo-compliance.ts` — `WriteRecord` + `recordWrite` signature extension
- `packages/agent-runtime/src/echo/types.ts` — provenance-relevant state additions
- `common/src/types/contracts/trace.ts` — optional `provenance_receipt` event kind (or sibling contract)
- Consumer tests: `packages/agent-runtime/src/util/__tests__/echo-compliance.test.ts`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] Medium: Feature degraded, workaround exists
- [x] Low: Catalog + field extension; no behavior change to enforcement itself

## Proposed Solution

### Approach

Produce the catalog as a committed reference (`common/src/types/` or `docs/` — decided at implementation), extend
`WriteRecord` with `agentId`, `agentType`, `fsmPhase`, `fidId` (structured), and a law-result summary; keep
`recordWrite`'s return contract unchanged for existing consumers.

### Steps

1. Add `agentId`/`agentType`/`fsmPhase` to the `recordWrite` call at `native.ts:351` (values already in scope).
2. Replace the FID heuristic with exact active-FID path resolution (reuse `fidPaths` option already passed to the
   tracker at construction).
3. Add a bounded law-result summary to the write record (laws evaluated + outcomes from the enforcement call).
4. Commit the catalog table above (updated with implementation line numbers) next to the schema.
5. Extend tracker tests; run the echo-compliance suite.

### Verification

```text
bun test packages/agent-runtime/src/util/__tests__/echo-compliance.test.ts
bun test packages/agent-runtime/src/__tests__/echo-compliance-wiring.test.ts
bun run --cwd=packages/agent-runtime typecheck
```

## Perfection Loop

### Loop 1 — RED

- **RED:** The source build order named `tool-executor.ts` as the interception point; it is a re-export shim
  (`packages/agent-runtime/src/tools/tool-executor.ts:1-18`). The write record lacks identity and phase. Verdict
  records do not exist.
- **GREEN:** Catalog produced from direct reads; gaps tabulated; field-extension plan defined; `custom.ts` confirmed
  out of scope (no write adapter, `custom.ts:76`).
- **AUDIT:** Every catalog row cites a verified file:line; tracker tests exist and will be extended;
  `bun test scripts/fid-ledger.test.ts` accepts this FID.
- **ADVERSARIAL:** "Is the heuristic FID id good enough?" → No: path regex can false-positive on non-FID paths and
  miss FIDs whose filenames deviate; exact resolution against the active-FID set is deterministic and already
  computed. Accepted.
- **CHANGE DELTA:** ~0 (converged draft).

### Missed Questions

1. **Do subagent writes (Forge/Verifier spawns) also produce receipts?** → Yes, every native write; the catalog's
   `agentId`/`agentType` fields are agent-agnostic.
2. **Does the law-result summary leak advisory text into the ledger?** → Only law numbers + severity, never message
   bodies (Law 12); message text stays in-memory.
3. **Should the catalog include the custom/MCP path?** → Cataloged as out of scope; `custom.ts` cannot write until an
   audited write adapter exists, at which point this catalog re-opens.

### Code Verification Evidence

- [x] `native.ts` read 0-EOF; write record call at :351; content resolution at :611 region; trace events at :99
- [x] `echo-compliance.ts` read 0-EOF; `WriteRecord` shape and `recordWrite` at :166; heuristic at :252
- [x] `echo/types.ts` read; `EnforcementState` in-memory-only confirmed
- [x] `custom.ts` read; write adapter absent (:76)
- [x] `adversary.ts` read; text verdict format confirmed (:64-84)
- [x] FID ledger validation passes (master + children set)
- [x] Implementation + tracker test extensions — 30/30 focused tests passed

### Loop 2 — Independent audit and self-correction

- **RED:** Second pass: `fsmPhase` may be absent for programmatic/SDK runs where the FSM is idle; the catalog assumed
  it always exists.
- **GREEN:** `fsmPhase` recorded as `agentState.fsmPhase ?? 'idle'`; schema uses the same fallback (already specified
  in the master's writer.phase field).
- **AUDIT:** Re-read confirms the fallback is consistent with the master schema and the FSM gate in
  `native.ts:279-305` (phase values 'audit'|'green'|'self_correct'|'idle').
- **ADVERSARIAL:** A missing phase could mislabel receipts from non-FSM sessions; fallback to 'idle' is honest and
  documented. Accepted.
- **CHANGE DELTA:** <2%.

### Loop 3 — Final convergence

- **RED:** No residual risks.
- **GREEN:** Catalog + field plan final.
- **AUDIT:** Converged; delta <2%.
- **ADVERSARIAL:** No unresolved challenge.
- **CHANGE DELTA:** <2%.

## Implementation Closure — COMPLETE

- **Implemented:** 2026-08-13.
- **Delivered:** `EchoComplianceTracker` and the native executor now capture agent id/type, FSM phase, structured FID id, and law-check outcomes; a read accessor supports provenance export.
- **Verification:** `packages/agent-runtime/src/util/__tests__/echo-compliance.test.ts` passed 30/30; agent-runtime typecheck passed; native call sites were re-read after wiring.

## Resolution

- **Closed Date:** 2026-08-13.
- **Fix Description:** RED catalog delivered and its field-extension plan implemented.
- **Tests Added:** Tracker identity, phase, FID, and law-check regression coverage.
- **Verification Evidence:** Focused suite 30/30 and full repository gates passed.
- **Archived:** Yes — moved to `dev/fids/archive/`.

## Lessons Learned

- Interception-point claims must name the file that owns the logic, not the shim that re-exports it.
- Heuristic identity (path regex) is acceptable for steering but not for signed provenance; receipts need resolved
  identity.
