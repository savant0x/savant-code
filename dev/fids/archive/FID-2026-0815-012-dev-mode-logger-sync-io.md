<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Dev-mode logger synchronous I/O + per-step debug payload serialization

**Filename:** `FID-2026-0815-012-dev-mode-logger-sync-io.md`
**ID:** FID-2026-0815-012
**Severity:** low
**Status:** closed
**Created:** 2026-08-15
**YAGNI-Compliance:** Verified — trims redundant per-step payload and batches an
existing sync append; no new store, no new authority (Law 13). Reuses the
trace-writer's async-append pattern.

**Parent:** none (follow-on scan after FID-2026-0815-011 closed)

---

## Summary

The general-purpose logger performs synchronous work on the agent-step hot path.
Every `logger.debug`/`info`/`warn`/`error` call flows through
`sendAnalyticsAndLog`, which (a) deep-copies the whole payload via
`sanitizeSecrets` and (b) — in dev — synchronously appends to disk with
`appendFileSync`. Two **unconditional per-step** `logger.debug` calls in
`runAgentStep` carry large payloads (`fullResponse`, `toolResults`, `toolCalls`,
`prompt`, `spawnParams`), so that serialization + disk write runs twice per LLM
round-trip — the same class as the trace-writer sync-serialization already fixed
in FID-2026-0815-011 E-02, but for the shared logger. The payload is also partly
redundant: the end-step debug log re-serializes the assistant response and tool
results that the trace writer already captures from `messageHistory`.

## Environment

- **OS:** Windows (dev), cross-platform runtime
- **Language/Runtime:** TypeScript / Bun (repo-pinned `1.3.14`)
- **Commit/State:** uncommitted working tree on `main` (0.0.24 work in progress)

## Detailed Description

### Problem

On every agent step, `runAgentStep` emits two `logger.debug` calls with data
objects that include full response and tool-result payloads. Each call runs the
full logger pipeline synchronously on the request thread, including a recursive
deep-copy (`sanitizeSecrets`) and — in dev — a synchronous disk append.

### Root Cause

1. **Large per-step debug payloads.** `step.ts:203` logs `prompt` +
   `params: spawnParams`; `step.ts:365` logs `fullResponse` + `toolCalls` +
   `toolResults`. The end-step log's own comment says "Summarize instead of
   logging the full message history" — yet it still includes the full response
   and tool results.
2. **Unconditional synchronous sanitization.** `sink.ts:151`
   `sanitizeSecrets(normalizedData)` runs before the dev/prod split, so the deep
   copy happens on every log call in **both** dev and prod.
3. **Synchronous dev file append.** `sink.ts:271-280` writes every level with
   `appendFileSync` in `IS_DEV` — no batching, no level gate.
4. **Micro:** `sanitize.ts:22-23` re-allocates the sensitive-keys array and
   re-lowercases each entry on every key check.

### Evidence

```text
$ grep -n "sendAnalyticsAndLog" cli/src/utils/logger.ts
39:        sendAnalyticsAndLog(level, data, msg, ...args),   # logger.debug -> here

$ grep -n "sanitizeSecrets\|appendFileSync\|IS_DEV && logPath" cli/src/utils/logger/sink.ts
151:    ? sanitizeSecrets(normalizedData)                    # deep-copy, both dev+prod
271:  if (IS_DEV && logPath) {
280:      appendFileSync(logPath, logEntry + '\n')            # sync disk, dev

$ grep -n "logger.debug\|traceWriter?.recordStep" packages/agent-runtime/src/run-agent-step/step.ts
190:  params.traceWriter?.recordStep({ ... messages: agentState.messageHistory })
203:  logger.debug({ ... prompt, params: spawnParams, ... }, 'Start agent ...')
355:  params.traceWriter?.recordStep({ ... messages: agentState.messageHistory })
365:  logger.debug({ ... fullResponse, toolCalls, toolResults, ... }, 'End agent ...')

$ grep -n "Array.from(SENSITIVE_KEYS)" cli/src/utils/logger/sanitize.ts
22:  return Array.from(SENSITIVE_KEYS).some((sensitive) =>
23:    lower.includes(sensitive.toLowerCase()),
```

The end-step `recordStep` (`step.ts:355`) captures the assistant response and
tool results via `messages: agentState.messageHistory` (confirmed by the
"Capture the assistant response and tool results added during this step"
comment), so the `fullResponse`/`toolResults` in the `step.ts:365` debug log
are a second serialization of the same data in dev (trace writer is always on in
`IS_DEV`, `trace-writer.ts:48`).

### Expected Behavior

Per-step debug logging should serialize a summary, not the full response/tool
results; the dev file append should not block the event loop on every call.

## Impact Assessment

### Affected Components

- `cli/src/utils/logger/sink.ts` (logger pipeline)
- `cli/src/utils/logger/sanitize.ts` (secret redaction)
- `packages/agent-runtime/src/run-agent-step/step.ts` (per-step debug logs)

### Risk Level

- [x] Low: perf optimization, no functional/behavioral change to output

## Proposed Solution

### Approach

Three-part minimal fix:

1. **G-01 (trim redundant payload):** in `step.ts:365`, drop `fullResponse`,
   `toolResults`, and `toolCalls` from the debug data (keep the summary fields
   `iteration`, `agentId`, `model`, `prompt` slice, `shouldEndTurn`, `duration`,
   `messageCount`, `stepCreditsUsed`). Optionally trim `params: spawnParams`
   from `step.ts:203`. Aligns with the existing "summarize" comment; the trace
   writer (dev) and the persisted chat file (prod) retain the full data.
2. **G-02 (batch dev append):** replace the `appendFileSync` in `sink.ts:280`
   with an ordered async append via a module-level promise chain (the exact
   pattern already used by the trace writer), with a `flush()` on process exit
   so pending lines are drained. Preserves ordering; changes durability so a
   hard crash may drop the final un-flushed lines (see AUDIT tradeoff).
3. **G-03 (micro):** hoist a module-level lowercase `SENSITIVE_KEYS` array in
   `sanitize.ts` so `isSensitiveKey` does not re-allocate/re-lowercase per key.

### Steps

1. Trim `step.ts:365` (and `step.ts:203` `params`) to summary fields.
2. Add async batched append + `flush()` to the dev sink path.
3. Hoist the lowercase sensitive-keys array in `sanitize.ts`.
4. Verify (below) and Law-4 grep the new call graph.

### Verification

- `bun run --cwd=cli typecheck` and `bun run --cwd=packages/agent-runtime typecheck`
- CLI full suite (logger/sink/sanitize + step tests)
- `bun x eslint --max-warnings 0` on changed files; Prettier
- Law-4 grep: `logger.debug` → `sendAnalyticsAndLog` → sink dev path; confirm
  `flush` is wired to process exit/signal handlers.

## Perfection Loop

### Loop 1 — RED

Three findings cataloged with grep-verified `file:line` evidence (above): the
per-step large debug payloads (L-01), the synchronous dev append (L-02), and the
`isSensitiveKey` micro (L-03). Call graph confirmed: `logger.debug`
(`logger.ts:39`) → `sendAnalyticsAndLog` → `sanitizeSecrets` (`sink.ts:151`) +
`appendFileSync` (`sink.ts:280`). **Exit: all issues cataloged.**

### Loop 1 — GREEN

Three-part minimal fix documented (trim + batch + hoist). **Exit: fixes
documented.**

### Loop 1 — AUDIT (planning)

- **Law 4 (grep-verified):** `sendAnalyticsAndLog` has exactly one production
  caller (`logger.ts:39`); `sanitizeSecrets` runs unconditionally before the
  dev/prod split (`sink.ts:151`); the two `logger.debug` sites in `step.ts`
  (`:203`, `:365`) are unconditional per step. The dev `appendFileSync` is
  reachable only when `IS_DEV && logPath`.
- **Behavior preservation:** G-01 changes only debug-log verbosity (best-effort
  observability; the code's own comment already intends a summary). G-03 is a
  pure hoist (same match semantics). G-02 preserves ordering; the only change is
  durability timing.
- **Tradeoff (flagged, not decided):** G-02 trades "real-time appendFileSync"
  for "ordered async append + exit flush". The existing comment
  (`sink.ts:269` "use appendFileSync for real-time logging") documents a
  deliberate choice; converting to async means a hard crash could drop the final
  un-flushed log lines. This is the one decision the operator must weigh.
- **Verification plan:** cli + agent-runtime typecheck; CLI full suite; focused
  sink/sanitize/step tests; ESLint `--max-warnings 0`; Prettier; Law-4 grep for
  the new `flush` wiring.
- **AUDIT passes (planning) → COMPLETE (converged — present for approval, no
  code written yet).**

### Missed Questions

1. **Is `sanitizeSecrets` actually on the prod hot path too?** Yes — `sink.ts:151`
   runs before the `IS_DEV && logPath` branch (`sink.ts:271`), so the deep copy
   happens on every log call in prod as well. G-01 (payload trim) is therefore a
   prod win, not just a dev win.
2. **Is `fullResponse`/`toolResults` truly redundant?** In dev the trace writer
   always captures them from `messageHistory` (`trace-writer.ts:48`,
   `step.ts:355`); in prod the persisted chat file retains them. The debug log is
   a third copy in dev, a second copy in prod — trimming is safe.
3. **Does async dev append risk losing log lines on crash?** Yes, for the final
   un-flushed lines. This is the deliberate tradeoff documented at `sink.ts:269`;
   a `flush()` on exit/signal handlers narrows the window to a hard kill. Left
   for operator decision.
4. **Will `logger.debug` trim break any test asserting exact payloads?** No test
   asserts the debug-log shape (verified — only `strings.test.ts` pins prompt
   text, not logger payloads); the change is internal observability.

## Resolution

Implemented G-01 + G-03 under operator approval (2026-08-15). G-02 (async dev
append) was **dropped by operator decision** — the synchronous `appendFileSync`
real-time-logging tradeoff documented at `sink.ts:269` is retained.

- **G-01:** `step.ts` end-step `logger.debug` now logs only the cheap scalar
  summary fields (`iteration`, `agentId`, `model`, `prompt`, `shouldEndTurn`,
  `duration`, `messageCount`, `stepCreditsUsed`). `fullResponse`,
  `toolCalls`, and `toolResults` are no longer re-serialized per step — they
  are captured by the trace writer (`step.ts:355` `messages: messageHistory`)
  and the persisted chat file. This removes the per-step `sanitizeSecrets`
  deep-copy of large payloads in both dev and prod.
- **G-03:** `sanitize.ts` hoists `SENSITIVE_KEY_SUBSTRINGS` (a module-level
  lowercased array) so `isSensitiveKey` no longer re-allocates/
  re-lowercases the sensitive-keys set on every key check. Match semantics
  identical (`Array.from` preserves Set insertion order).

**Verification (all exit 0):** agent-runtime + cli typecheck; agent-runtime
full suite **966/0**; CLI full suite **3074 pass / 18 skip / 0 fail**;
logger-sanitize-secrets **5/0**; ESLint `--max-warnings 0`; Prettier. Law-4
grep: `SENSITIVE_KEY_SUBSTRINGS` single consumer (`isSensitiveKey`);
`fullResponse`/`toolCalls`/`toolResults` removed from the end-step debug object
(remain only in the function return and the infrequent `/compact` summary log).

Closed and archived. No commit, push, release, publication, or deployment.
