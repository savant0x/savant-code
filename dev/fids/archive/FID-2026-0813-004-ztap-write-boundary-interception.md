<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: ZTAP Wiring — Write-Boundary Interception and Signed Chain

**Filename:** `FID-2026-0813-004-ztap-write-boundary-interception.md`
**ID:** FID-2026-0813-004
**Severity:** high
**Status:** closed
**Planning Status:** Converged after Perfection Loop; implementation complete.
**Created:** 2026-08-13
**YAGNI-Compliance:** Complete — implementation scope delivered
**Master FID:** FID-2026-0813-001
**Depends On:** FID-2026-0813-003

---

## Summary

Wires the ZTAP signed chain into the runtime: write-time receipt creation in `native.ts` (append-only ledger at
`.savant/provenance/<sessionId>/`), verdict binding at AUDIT/ADVERSARIAL phase completion (signed verbatim payloads per
master D7), `provenance_receipt` event emission, the `provenance.mode` config field, and the `EchoComplianceTracker`
field extensions from FID-2026-0813-002. Writes are never held; receipts are created and extended asynchronously
(D1), with `<10 ms` synchronous overhead (D8).

## Environment

- **OS:** Windows (`win32`); cross-platform (Bun)
- **Language/Runtime:** TypeScript monorepo, Bun 1.3.14; packages: `agent-runtime`, `common`
- **Master:** `FID-2026-0813-001` (D1, D5, D7, D8, D9, D10)
- **Depends on:** FID-2026-0813-003 (crypto primitives), FID-2026-0813-002 (field extensions)

## Detailed Description

### Problem

The runtime records writes in memory but persists nothing. Provenance requires the write boundary to emit a signed
receipt, the phase lifecycle to bind verdicts, and the ledger to be durable and append-only — all without disturbing
the interactive write path.

### Expected Behavior

1. Every successful native write creates a signed receipt appended to `.savant/provenance/<sessionId>/receipts.jsonl`
   (status `pending`).
2. Verifier (AUDIT) and Adversary (ADVERSARIAL) completion bind signed verdict payloads to the receipt (status
   `complete` when both present, or when the session ends with the phases that ran).
3. `provenance_receipt` events stream to the CLI for P1.C overlays (bounded, best-effort — mirroring
   `MAX_RUNTIME_EVENTS` in `cli/src/utils/trace-writer.ts:31`). **Event emission is unconditional** — the stream is a
   display/observability surface and flows in every mode (including `off`); only signing and the ledger are
   mode-gated. This is the contract FID-2026-0813-009 builds its "renders with crypto off" property on.
4. `protocol.config.yaml` gains `provenance.mode: off | record | enforce` (default `record`).
5. Synchronous overhead per write <10 ms; ledger I/O is async with a bounded queue and turn-end flush; failures in
   `record` mode are visible but non-blocking; `enforce` mode fails closed.

### Root Cause

No persistence or signing in the enforcement design; no phase-completion hook existed for verdict capture.

### Evidence

- Interception site: `packages/agent-runtime/src/tools/tool-executor/native.ts:611` (`enforcement.afterToolCall`)
  with written content already resolved via `getSuccessfulFileContent`; write path and tool name in scope at
  `native.ts:351`.
- Verdict lifecycle: Verifier/Adversary are spawned subagents (zero-tool Verifier per ECHO.md; Adversary tools at
  `agents/adversary/adversary.ts:39-44`); their final messages are the verdict payloads (D7).
- Ledger convention: `.savant/` sidecar precedent (`.savant/graph.db`, `packages/knowledge-graph/src/store.ts:14`).

## Impact Assessment

### Affected Components

- MODIFY `packages/agent-runtime/src/tools/tool-executor/native.ts` — post-write receipt creation + event emission
- MODIFY agent loop phase lifecycle — verdict binding hooks (AUDIT/ADVERSARIAL completion; exact call sites pinned
  during implementation RED against the loop-iteration modules)
- MODIFY `packages/agent-runtime/src/util/echo-compliance.ts` — `WriteRecord` extensions (agentId/agentType/fsmPhase/
  fidId/law summary) per FID-2026-0813-002
- NEW `packages/agent-runtime/src/provenance/` — ledger writer, receipt builder, session manifest, bounded event queue
- MODIFY `protocol.config.yaml` — `provenance.mode`
- NEW `.savant/provenance/` — gitignored via existing `.savant/` rule

### Risk Level

- [x] Critical: System crash, data loss, or security vulnerability (write path is production-critical; any regression
      here breaks every agent run)
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Interception is strictly additive to the write lifecycle: after a successful write (post `afterToolCall`), build the
receipt from already-resolved values, sign with the writer's role key, enqueue the ledger append, emit the event. No
write-path control flow changes; `record` mode never blocks; `enforce` mode intercepts *before* dispatch (at the
pre-write gate) when signing is unavailable.

### Steps

1. Create `provenance/` module: session manifest (sessionId, pubkeys, role map, seq counter), receipt builder,
   ledger writer (async queue + turn-end flush), event emitter.
2. Extend the write record per FID-2026-0813-002; resolve `fidId` exactly against the active-FID set; capture the
   pre-write gate outcomes (`lawChecks`: law, outcome blocked|advisory|passed) from the enforcement result into the
   receipt.
3. Hook `native.ts` post-`afterToolCall`: build + sign receipt, enqueue append, emit `provenance_receipt`.
4. Add phase-completion hooks: at the lifecycle points where the Verifier and Adversary final messages are recorded,
   bind signed verdict payloads to all open receipts for the FID/run (payload per master D7).
5. Add `provenance.mode` to config + session state; `enforce` mode adds a pre-write availability check.
6. Tests: receipt creation on all three write tools, verdict binding, seq monotonicity, mode matrix, event bounds,
   ledger append/flush; typecheck + lint.

### Verification

**Hard gate (Nova audit flag #1):** before any wiring, this FID's implementation RED must grep the agent-loop
phase-lifecycle modules and cite the exact AUDIT/ADVERSARIAL completion call sites (`file:line`) where the Verifier
and Adversary final messages are recorded; the verdict-binding hook lands at those cited sites only. Zero grep
results = not wired (Law 4).

```text
bun test packages/agent-runtime/src/provenance/
bun test packages/agent-runtime/src/util/__tests__/echo-compliance.test.ts
bun run --cwd=packages/agent-runtime typecheck
bun x eslint packages/agent-runtime/src/provenance --max-warnings 0
bunx prettier --check packages/agent-runtime/src/provenance
```

## Perfection Loop

### Loop 1 — RED

- **RED:** The build order's "hold the write until AUDIT/ADVERSARIAL sign" model is unbuildable as written (phases
  run after writes land). Verdict records do not exist; verdicts are text outputs. The interception target in the
  build order is a shim (`tool-executor.ts`).
- **GREEN:** Append-only chain design (D1): write-time `pending` receipt + phase-completion appends. Verdict binding
  via signed verbatim payloads (D7). Interception at `native.ts:611`. Mode matrix (D8). Exact phase-hook call sites
  are pinned during implementation RED against the loop modules (the master names the constraint: the hook fires at
  the same lifecycle point where Verifier/Adversary final messages are recorded).
- **AUDIT:** Flow re-traced through `native.ts` (write gate :279 → handler → `afterToolCall` :611 → content already
  resolved); no new blocking point in `record` mode; `provenance_receipt` bounded like `traceWriter`.
- **ADVERSARIAL:** "Can a failed ledger append lose the receipt?" → In `record` mode the write already succeeded; the
  receipt is retried at flush and a visible notice surfaces on failure (audit-log best effort, documented); `enforce`
  mode fails closed before dispatch. Accepted.
- **CHANGE DELTA:** ~0.

### Missed Questions

1. **Do verdict bindings target one receipt or a batch?** → A Verifier/Adversary phase can cover multiple writes; the
   hook binds the verdict payload to every open receipt sharing the run/FID context, each with its own signature
   (one verdict text, N bindings) — aggregate view per FID in the export (master D11).
2. **What happens to open receipts at session end?** → Session-close event signs the manifest (harness role) with
   final counters; receipts remain `pending` for phases that never ran — honest state, shown in the export.
3. **Is the ledger read by the runtime after write?** → No; reads happen at export (FID-2026-0813-007) and overlay
   (FID-2026-0813-009 uses the event stream, not the ledger).
4. **Does `enforce` mode apply to FID-document writes?** → Yes; provenance applies to every native write.

### Code Verification Evidence

- [x] `native.ts` read 0-EOF; hook sites :279/:351/:611 verified
- [x] Verifier/Adversary spawn lifecycle confirmed (zero-tool Verifier; `agents/adversary/adversary.ts:39-44`)
- [x] `.savant/` sidecar precedent verified (`packages/knowledge-graph/src/store.ts:14`)
- [x] FID ledger validation passes (master + children set)
- [x] Implementation + tests — 23/23 provenance tests passed; hook-site pinning satisfied

### Loop 2 — Independent audit and self-correction

- **RED:** Second pass: async queue could reorder receipts vs. `seq` (a fast write's append landing after a slower
  one's); the phase hook "pinned during implementation" is a soft spot; `provenance_receipt` events could duplicate on
  retry.
- **GREEN:** `seq` is assigned at receipt build time (synchronously) and the ledger writer sorts by `seq` at flush;
  the hook site is a named deliverable of this FID's implementation RED with a mandatory grep of the loop-iteration
  call sites before wiring (Law 4); events carry the receipt `seq` and are deduped by the emitter (per-receipt
  `emitted` set).
- **AUDIT:** Re-read confirms ordering and dedup fixes are representable without changing the schema.
- **ADVERSARIAL:** Crash between build and flush loses a receipt in `record` mode — accepted (audit-log best effort,
  documented); `enforce` mode pre-write check prevents the class where it matters.
- **SELF-CORRECT (post-write adversarial pass):** made explicit that `provenance_receipt` event emission is
  unconditional (mode-independent display stream) while signing + ledger are mode-gated (fixes F2 — resolves
  FID-2026-0813-009's crypto-off contract); added `lawChecks` capture to step 2 (fixes F4).
- **POST-NOVA (independent audit):** verdict-binding hook-site pinning elevated to a hard gate in the Verification
  section (Nova flag #1) — implementation RED must cite the exact phase-completion call sites (`file:line`) before
  wiring.
- **CHANGE DELTA:** <3%.

### Loop 3 — Final convergence

- **RED:** No residual risks.
- **GREEN:** Wiring design final.
- **AUDIT:** Converged; delta <2%.
- **ADVERSARIAL:** No unresolved challenge.
- **CHANGE DELTA:** <2%.

## Implementation Closure — COMPLETE

- **Implemented:** 2026-08-13.
- **Delivered:** Native writes now create hash-only signed receipts, append to the session ledger, emit bounded provenance events, honor `off|record|enforce`, and bind Verifier/Adversary outputs at phase-completion sites `spawn-agents.ts:266` and `spawn-agent-inline.ts:169` (`extractVerdictText` at `:163`, binding at `:169`). Session finalization closes the manifest through the loop `finally` at `loop.ts`.
- **Verification:** Provenance lifecycle and mode suite passed 23/23; agent-runtime typecheck and full test suite passed. The hard hook-site pinning gate was satisfied before wiring.
- **POST-NOVA IMPLEMENTATION AUDIT:** Nova independently re-ran the implementation suites and returned **PASS** (`100 pass / 0 fail`, 2026-08-13). Nova confirmed the actual phase-completion binding sites above; the earlier `:137`/`:135` citations were documentation inaccuracies only.

## Resolution

- **Closed Date:** 2026-08-13.
- **Fix Description:** Signed native write-boundary chain, ledger, verdict hooks, events, and configuration implemented.
- **Tests Added:** Receipt lifecycle, append-only/hash-only ledger, verdict binding, mode, latency, and finalization coverage.
- **Verification Evidence:** Focused suite 23/23 and full repository gates passed.
- **Archived:** Yes — moved to `dev/fids/archive/`.

## Lessons Learned

- Async persistence needs ordering guarantees decoupled from I/O completion; assign sequence synchronously, sort at
  flush.
- Verdict capture must bind at the lifecycle point where verdict text is recorded, or the binding can sign the wrong
  phase's output.
