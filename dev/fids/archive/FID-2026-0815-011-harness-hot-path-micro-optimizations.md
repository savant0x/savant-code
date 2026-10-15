<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Harness hot-path micro-optimizations (4 candidates)

**Filename:** `FID-2026-0815-011-harness-hot-path-micro-optimizations.md`
**ID:** FID-2026-0815-011
**Severity:** medium
**Status:** closed
**Created:** 2026-08-15
**YAGNI-Compliance:** Verified — removes redundant work and a duplicate disk probe;
no new store, no new authority (Law 13).

**Parent:** none (follow-on scan after the harness-speed master FID-2026-0815-002 closed)

---

## Summary

A follow-on scan of the runtime hot path (per-step loop, per-write gates, and the
dev trace writer) surfaced four independent inefficiencies. Two are per-step
(repeated tokenization of the invariant system prompt; synchronous trace
serialization in dev), two are per-write (a redundant sync `existsSync` probe and
an O(n) read-set lookup with an unbounded pattern list). All four are behavior-
preserving and self-contained.

## RED — Issue catalog

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| E-01 | med | The session-invariant system prompt is tokenized **twice per step**: once in `estimateContextTokensLocally` and again in `runAgentStep`. `system` is built once per session, so this is redundant O(len) work on every LLM round-trip. | `packages/agent-runtime/src/run-agent-step/context-tokens.ts:88` (`countTokens(system)` inside `estimateContextTokensLocally`); `packages/agent-runtime/src/run-agent-step/step.ts:166` (`const systemTokens = countTokens(system)`) |
| E-02 | med | The dev trace writer appends asynchronously (FID-2026-0815-003) but still **serializes** each step's messages synchronously: `recordStep` builds `lines` via `JSON.stringify` in a loop and only then calls `enqueueWrite`. `recordStep` runs **twice per step** (`step.ts` start + end), so message serialization blocks the event loop in dev (`IS_DEV`). | `cli/src/utils/trace-writer.ts:148` (`lines.push(JSON.stringify({ timestamp, ...record }))` inside `appendLine`, called synchronously in the `for` loop before `enqueueWrite`); callers `step.ts` (two `params.traceWriter?.recordStep({...})` sites) |
| E-03 | low | A brand-new-file write still triggers a **synchronous** `existsSync` in the EHEL pre-write gate, duplicating the `isNewFile` probe that FID-2026-0815-005 already made async (`fs.promises.access`) in the native executor. Same write, two disk checks — one sync, one async. | `packages/agent-runtime/src/echo/pre-write-gates.ts:266` (`return !existsSync(path)` in `isNewFile`, reached from `runPreWriteGates` → `enforcement.ts` `beforeToolCall`); async counterpart `packages/agent-runtime/src/tools/tool-executor/native.ts:404` (`await fs.promises.access(resolvedWritePath)`) |
| E-04 | low | `EchoComplianceTracker.hasRead` performs an O(readDirs + readPatterns) scan per eligible write — iterating `readDirs` with string `startsWith` and `readPatterns` with `includes`. `readPatterns` grows unboundedly (every `recordPatternRead` push) over the session. | `packages/agent-runtime/src/util/echo-compliance.ts` — `hasRead` (loops `readDirs` + `readPatterns`), `recordPatternRead` (`this.readPatterns.push(pattern)`, unbounded) |

## GREEN — Proposed fix (converged)

1. **E-01:** compute `systemTokens = countTokens(system)` once per step in
   `prepareStepContext` (which already runs first and receives `system`), return it
   alongside `stepPrompt`, and forward it to `runAgentStep` through the same
   threading already used for `stepPrompt` (`loop-iteration.ts:139` destructures
   `{ stepPrompt }` and `loop-iteration.ts:299` forwards `stepPrompt` to
   `runAgentStep`). `runAgentStep` then uses `params.systemTokens ??
   countTokens(system)` so direct callers (tests) keep working. Net: 2 system
   tokenizations/step → 1; no store, no cache, no invalidation.
2. **E-02:** move the `lines` construction (the `JSON.stringify` loop) into the
   async write chain (`enqueueWrite`), so serialization happens off the step hot
   path. The role-sequence bookkeeping (`writtenRoles`) must be captured
   synchronously at enqueue time (the array is built incrementally and mutated),
   but the string serialization can be deferred into the chain. Preserve ordering
   and the `history_rewritten` detection exactly.
3. **E-03:** gate the Law-1 block (and its `isNewFile` → `existsSync` probe)
   behind `tier === 'all_15'`. In the default `hybrid` mode
   (`resolveEnforcementMode` returns `'hybrid'` when `enforcementMode` is
   undefined, `enforcement.ts:33`) the block is already inert — the sync
   `existsSync` runs and its result is discarded. Moving the tier check first
   removes the probe from the default path with zero behavior change; strict
   (`all_15`) mode keeps the exact block.
4. **E-04:** replace the `readDirs` string-prefix scan and the unbounded
   `readPatterns` array with a normalized lowercase `Set` plus a bounded prefix
   lookup (e.g. cap `readPatterns` at a fixed bound and/or store normalized
   patterns in a `Set`). Preserve the exact match/prefix/includes semantics as
   recorded in `hasRead`.

**Net:** removes two full system-prompt tokenizations per step, moves dev trace
serialization off the hot path, and removes a duplicate disk probe + an O(n)
unbounded read-set scan per write. No observable behavior change.

## Perfection Loop

### Loop 1 — RED

E-01…E-04 cataloged with `file:line` evidence from a full scan of the hot path.
**Exit: all issues cataloged.**

### Loop 1 — GREEN

Four-part minimal fix documented (threading + deferral + dedupe + bounded lookup).
**Exit: fixes documented.**

### Loop 1 — AUDIT (planning)

- **Law 4 (grep-verified call sites):** `countTokens(system)` has exactly two
  call sites (`context-tokens.ts:88`, `step.ts:166`) — verified by grep; both are
  the same per-step hot path, so memoizing is safe. `recordStep` is called twice
  per step in `step.ts` (grep-verified). `isNewFile`/`existsSync` in
  `pre-write-gates.ts` is reachable only via `runPreWriteGates` from
  `enforcement.ts` `beforeToolCall` (single caller). `hasRead` is private to
  `EchoComplianceTracker` with two call paths (`recordWrite`).
- **Behavior preservation:** E-01 is a pure dedupe (same value, computed once).
  E-02 preserves trace ordering + `history_rewritten` semantics (only the
  serialization timing moves). E-03 preserves the strict-mode Law-1 block and the
  native receipt. E-04 preserves `hasRead`'s match semantics.
- **Verification plan:** `bun run --cwd=packages/agent-runtime typecheck`,
  `bun run --cwd=cli typecheck`; agent-runtime full suite; trace-writer tests;
  ESLint `--max-warnings 0`; Prettier.
- **AUDIT finding → SELF-CORRECT:** E-03's original "thread the async isNewFile"
  fix was more invasive than necessary. Grep confirmed `resolveEnforcementMode`
  defaults to `hybrid` (`enforcement.ts:33`), where the Law-1 block is inert — the
  sync `existsSync` is dead weight by default. The fix is simplified to gating the
  probe behind `tier === 'all_15'` (strict mode keeps the exact block). E-01's
  threading path was also grep-verified (`loop-iteration.ts:139` / `:299` already
  forward `stepPrompt` the same way). GREEN updated.
- **AUDIT passes (planning) → SELF-CORRECT applied → COMPLETE (converged —
  present for approval, no code written yet).**

### Missed Questions

1. **Is `system` truly invariant per run?** Yes — it is built once per session
   (`loop-context.ts` builds the system prompt before the loop) and passed through
   unchanged; the two `countTokens(system)` calls receive the identical string.
   Memoizing is safe.
2. **Does deferring trace serialization risk losing data on a crash?** Trace
   output is best-effort debug data (errors are already swallowed in the chain);
   moving serialization into the chain changes nothing about durability.
3. **Does threading `isNewFile` change the gate's strict-mode behavior?** No — the
   value is identical; only its source (async access vs sync existsSync) and timing
   change.
4. **Does capping `readPatterns` break a Law-1 read-before-write match?** The cap
   only bounds memory growth; exact/prefix/includes semantics are preserved within
   the retained window, and the primary read signal (`readPaths` Set) is unchanged.

## Resolution

All four findings implemented and verified (2026-08-15), each before the next.

- **E-01:** `prepareStepContext` now returns `systemTokens`
  (`context-tokens.ts:253`), threaded through `loop-iteration.ts:139/298` to
  `runAgentStep`, which uses `params.systemTokens ?? countTokens(system)`
  (`step.ts:169`). `types.ts:62` adds the optional field. Net: 2 system
  tokenizations/step → 1.
- **E-02:** `trace-writer.ts` defers the `JSON.stringify` loop into the async
  write chain; `writtenRoles` bookkeeping captured synchronously at enqueue.
  Ordering + `history_rewritten` detection preserved.
- **E-03:** `pre-write-gates.ts:74` gates the Law-1 `isNewFile`/`existsSync`
  probe behind `tier === 'all_15'` — hybrid (default) skips the sync disk probe
  entirely; strict mode keeps the exact block.
- **E-04:** `echo-compliance.ts` `recordPatternRead` normalizes once, dedupes,
  and bounds the pattern window at `MAX_READ_PATTERNS = 256` (FIFO); `hasRead`
  no longer re-lowercases on the write path. Two regression tests added (weak
  pattern read + bounded-window saturation).

**Verification (all exit 0):** agent-runtime typecheck; cli typecheck;
agent-runtime full suite **966/0** (up from 964 — two E-04 tests);
`pre-write-gates` + `violation-handler` 16/0; `echo-compliance` 37/0;
trace-writer 6/0; ESLint `--max-warnings 0` on every changed file; Prettier
clean. Law-4 grep: `systemTokens` single production source
(`context-tokens.ts:80`) → `loop-iteration.ts` → `step.ts`; `isNewFile` only
reachable at `pre-write-gates.ts:74` (strict-gated); `recordPatternRead` called
from `echo-record.ts:36`.

Closed and archived. No commit, push, release, publication, or deployment.
