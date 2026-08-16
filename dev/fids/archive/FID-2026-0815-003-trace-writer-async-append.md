<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Trace writer — async append + O(1) role tracking

**Filename:** `FID-2026-0815-003-trace-writer-async-append.md`
**ID:** FID-2026-0815-003
**Severity:** high
**Status:** closed
**Created:** 2026-08-15
**YAGNI-Compliance:** Verified — no new store, no new authority. Reuses the existing promise-chain pattern from `provenance/ledger.ts` (Law 13); the role-tracking change removes an O(n) scan in the append path without adding state.

**Parent:** FID-2026-0815-002 (finding F-02)

---

## Summary

The debug trace writer (`cli/src/utils/trace-writer.ts`) runs `recordStep` twice per agent step (once before the LLM call, once after — `packages/agent-runtime/src/run-agent-step/step.ts:185` and `:350`). In dev (`IS_DEV`), each call performs a **synchronous `appendFileSync`** plus an **O(n) role-sequence scan** (`state.writtenRoles.some(...)`) and a **full `messages.map(m => m.role)`** allocation over the growing history. Over a long session this blocks the event loop twice per step and does O(n) work per step.

## RED — Issue catalog

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| E-01 | high | `recordStep` and `recordEvent` write to disk with **synchronous** `appendFileSync`/`mkdirSync`, blocking the event loop twice per agent step in dev (`isTraceEnabled()` returns `IS_DEV`). | `cli/src/utils/trace-writer.ts:107-120` (`mkdirSync` + `appendFileSync` in `recordEvent`), `:214-217` (`appendFileSync` in `recordStep`) |
| E-02 | med | `recordStep` scans the full role sequence every call (`state.writtenRoles.some((role, i) => messages[i]?.role !== role)`) and rebuilds a full role array (`messages.map(m => m.role)`), even on the pure-append path. | `trace-writer.ts:151-155` (rewritten check), `:196` (`state.writtenRoles = messages.map(...)`) |

## GREEN — Proposed fix (converged)

1. **E-01:** replace `mkdirSync`/`appendFileSync` with `mkdir`/`appendFile` from `node:fs/promises`, serialized through a per-writer promise chain (same pattern as `provenance/ledger.ts`). `recordStep`/`recordEvent` enqueue and return immediately. Add a `flush(): Promise<void>` that awaits the chain (tests + optional turn-end). Extend the `TraceWriter` type with an optional `flush?: () => Promise<void>`.
2. **E-02:** track roles incrementally — append new roles via `push` instead of a full `messages.map`, and skip the `some()` scan on the append path (the common case). The scan only runs when `messages.length === state.writtenRoles.length` (potential same-length role change); truncation is caught by the length comparison. The append path becomes O(1) for rewrite detection.

## Perfection Loop

### Loop 1 — RED

E-01…E-02 cataloged. **Exit: all issues cataloged.**

### Loop 1 — GREEN

Two-part fix documented. **Exit: fixes documented.**

### Loop 1 — AUDIT (implementation, double audit — tool output)

**Method 1 (static analysis):**

```text
$ bun run --cwd=common typecheck   # exit 0 (TraceWriter.flush added)
$ bun run --cwd=cli typecheck      # exit 0 (async writer)
$ bun x eslint common/src/types/contracts/trace.ts cli/src/utils/trace-writer.ts \
  cli/src/utils/__tests__/trace-writer.test.ts --max-warnings 0   # exit 0
$ bunx prettier --check <the three files>   # clean
```

**Method 2 (manual re-read vs. FID):** `enqueueWrite` serializes writes through one promise chain (order preserved; the file path + dir are captured synchronously at enqueue so a mid-session chat-dir change still resolves correctly); `recordStep`/`recordEvent` return immediately (non-blocking); the role array grows via `push` and the `some()` scan only runs on the same-length case, while truncation is caught by the length comparison — append-path rewrite detection is O(1). The `TraceWriter` type gains only an optional `flush?` (backward-compatible).

**Tests (tool output):**

```text
$ bun test src/utils/__tests__/trace-writer.test.ts   # 6 pass / 0 fail
```

**Law 4 (call-graph reachability):** `flush` is consumed by the trace-writer tests (`await writer.flush?.()`); `createTraceWriter` is consumed by `cli/src/utils/savant-code-client.ts`; `recordStep`/`recordEvent` callers in `step.ts:185/350` and `loop.ts` runtime events are unchanged. **AUDIT passes → SELF-CORRECT (none) → COMPLETE.**

### Missed Questions

1. **Could async writes reorder or lose lines on process exit?** Writes serialize through a single promise chain (order preserved). On abrupt exit the last few lines may not flush — acceptable for a best-effort debug trace (the prior sync version blocked instead). `flush()` is available for tests and optional turn-end.
2. **Does skipping the append-path role scan weaken rewrite detection?** Only a same-length in-place role change is detected via the scan; append-only histories (the only producer in the loop) never change the prefix, so the append path is safely O(1). Truncation (compaction/expiry) is caught by the length check.
3. **Is a second role string/array needed for `writtenCount`?** No — `writtenRoles.length` is the count; pushing incrementally keeps it exact.

### Code Verification Evidence

- [x] Files referenced exist (`cli/src/utils/trace-writer.ts`, `common/src/types/contracts/trace.ts`, test)
- [x] Implementation matches the Proposed Solution (async append + incremental role tracking + optional `flush`)
- [x] Typecheck/tests/lint pass with pasted tool output (6/0 tests; common+cli typecheck exit 0; ESLint `--max-warnings 0`; Prettier clean)
- [x] Production call-graph evidence present (flush consumed by tests; writer consumed by `savant-code-client.ts`)
- [x] FID status reflects the actual implementation state

## Resolution

Implemented: `cli/src/utils/trace-writer.ts` now appends via `appendFile`/`mkdir` (fs/promises) serialized through a per-writer promise chain, `recordStep`/`recordEvent` return immediately, and `flush()` awaits the chain (added as optional `TraceWriter.flush`). Role tracking is incremental (`push` + same-length-only scan), making the append path O(1). Tests updated to await `flush` and pass 6/0.
