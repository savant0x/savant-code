<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Per-write overhead — checkpoint capture + Law-1 gate

**Filename:** `FID-2026-0815-005-per-write-overhead-checkpoint-and-law1-gate.md`
**ID:** FID-2026-0815-005
**Severity:** medium
**Status:** closed
**Created:** 2026-08-15
**YAGNI-Compliance:** Verified — converts existing synchronous I/O to its async
equivalent and adds one in-flight dedupe map; no new store, no new authority,
no new public API (Law 13).

**Parent:** FID-2026-0815-002 (findings F-04, F-05)

---

## Summary

Two synchronous file-system calls sit on the **write hot path** — i.e. they run
before every `write_file` / `str_replace` / `apply_patch` dispatch and block the
event loop:

1. `captureSnapshot` reads the **entire pre-edit file content** via
   `fs.readFileSync` to record the rewind checkpoint (F-04).
2. The Law-1 read-before-write gate calls `fs.existsSync` to classify a write as
   a new file (F-05).

Both are small per call, but they scale with file size / call count and are pure
event-loop stalls that could instead be awaited — the surrounding execution
context is already `async`.

## RED — Issue catalog

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| E-01 | med | `captureSnapshot` does `fs.readFileSync(filePath, 'utf8')` of the whole file before each distinct write; called synchronously (unawaited) from the write gate, so a large file stalls the loop. | `packages/agent-runtime/src/tools/handlers/tool/checkpoint-store.ts:154` (`buffer.files.set(filePath, fs.readFileSync(filePath, 'utf8'))`); call site `packages/agent-runtime/src/tools/tool-executor/write-gate.ts:139-144` (`captureSnapshot({...})` — synchronous, unawaited, inside the already-async `runWriteGate`); `runWriteGate` is `await`ed at `native.ts:195`, so an awaited async `captureSnapshot` is ordered before dispatch |
| E-02 | low | `closeTurn` persists with `mkdirSync` + `writeFileSync` + a `prune()` that does `readdirSync` + per-file `readFileSync` + `rmSync` — once per turn, but still blocking. | `checkpoint-store.ts:215-222` (`fs.mkdirSync` / `fs.writeFileSync`), `:235-255` (`prune`: `readdirSync` → `readFileSync` → `rmSync`) |
| E-03 | low | Law-1 gate does `fs.existsSync(resolvedWritePath)` per write to detect brand-new files. | `packages/agent-runtime/src/tools/tool-executor/native.ts:400-401` (`return !fs.existsSync(resolvedWritePath)` inside `(() => { try { ... } catch { ... } })()`) |

**Scope note:** checkpoint *restore/list* paths (`restoreTurn`, `listTurns`,
`getTurn`) are user-initiated (`/rewind`, history UI), not per-write hot paths —
they are **in scope** per the operator directive but are a secondary priority
below E-01…E-03; a later hardening pass can async them if the operator wants a
fully non-blocking module.

## GREEN — Proposed fix (converged)

1. **E-01 (primary):** make `captureSnapshot` async — read via
   `fs.promises.readFile` — and `await` it in `runWriteGate` (already async).
   Ordering is preserved: the write dispatches only after `runWriteGate`
   resolves. To preserve the existing **first-wins dedupe** under concurrency
   (two subagent writes to the same path racing), add a per-path in-flight
   promise map so concurrent captures of the same path coalesce onto one read;
   first completion wins, exactly matching today's sequential first-capture
   semantics.
2. **E-02:** convert `closeTurn`'s persistence to `fs.promises` (`mkdir` /
   `writeFile` / `readdir` / `rm`), return a `Promise`, and `await` it at the
   call site in `finalize()` (or fire-and-forget with the existing swallow-on-
   error semantics preserved). Deterministic retention pruning is preserved.
3. **E-03:** replace `fs.existsSync` with an awaited `fs.promises.access` /
   `stat` in the Law-1 gate (the enclosing handler is async), keeping the
   try/catch → "not new" degradation contract.

**Net:** zero blocking file I/O on the per-write path; behavior identical
(same dedupe, same error-degradation contract, same retention).

## Perfection Loop

### Loop 1 — RED

E-01…E-03 cataloged with `file:line` evidence; scope note recorded. **Exit: all
issues cataloged.**

### Loop 1 — GREEN

Three-part async conversion documented, with an in-flight dedupe map to preserve
first-wins under concurrency. **Exit: fixes documented.**

### Loop 1 — AUDIT (planning)

- **Law 4 (grep-verified):** `captureSnapshot` production caller = `write-gate.ts:140` (the only
  production caller) + tests. `closeTurn` callers = `send-message-lifecycle.ts`
  (`finalize()`) + tests. `captureSnapshot`/`closeTurn` are exported from
  `checkpoint-store.ts` and re-exported via the SDK barrel — the public surface
  (function names + params) is unchanged, only the return type of `closeTurn`
  becomes `Promise<...>` (call sites updated; Law-4 grep will confirm no other
  callers).
- **Concurrency invariant:** the in-flight map preserves "first capture wins,
  never overwrite the pre-edit original" (CKR-1/CKR-2 in FID-2026-0803-004).
  A regression test will assert concurrent `captureSnapshot` calls for the same
  path yield a single read and identical content.
- **Verification plan:** `bun run --cwd=packages/agent-runtime typecheck`,
  agent-runtime suite (963 tests), plus
  `packages/agent-runtime/src/tools/handlers/tool/__tests__/checkpoint-store.test.ts`
  (present) and `cli` typecheck for the `finalize()` call-site change; ESLint
  `--max-warnings 0`; Prettier.
- **AUDIT finding → SELF-CORRECT:** grep-verification corrected two `file:line`
  citations — `captureSnapshot` call site is `write-gate.ts:139-144` (not
  `:165-171`; the file is 148 lines) and `closeTurn` persistence is
  `:215-222` (not `:217-228`). Evidence table updated. No plan change.
- **AUDIT passes (planning) → COMPLETE (converged; pending operator
  approval to implement).**

### Missed Questions

1. **Does making `captureSnapshot` async change when the checkpoint reads the
   file?** No — the read still completes before the write dispatches, because
   `runWriteGate` awaits it. The only change is the loop is no longer blocked.
2. **Can two concurrent writes corrupt the dedupe?** No — the in-flight map
   coalesces concurrent same-path captures onto one read; first completion
   wins, identical to today's sequential behavior.
3. **Why keep `closeTurn` sync in `finalize()`?** We do not — it becomes async
   and is awaited (or safely fire-and-forget with error swallowing). Retention
   and content are unchanged.

## Resolution

Implemented 2026-08-15 (operator approved). `captureSnapshot` async via
`fs.promises.readFile` + in-flight per-path promise map (awaited in
`runWriteGate`); `closeTurn`/`prune` async via `fs.promises`; Law-1 gate uses
awaited `fs.promises.access` (ENOENT → new, else "not new"). `finalize()` in
`cli/src/hooks/helpers/send-message-lifecycle.ts` awaits `closeTurn`.

Verification: agent-runtime typecheck exit 0 (964 pass / 0 fail full suite,
incl. new `capture concurrency` regression asserting one `readFile` call for
concurrent same-path captures); SDK + cli typecheck exit 0; checkpoint-store
18/0, rewind 10/0, send-message 45/0; ESLint `--max-warnings 0` on all changed
files. Law-4 grep: `captureSnapshot` production caller = `write-gate.ts`
(awaited); `closeTurn` production caller = `send-message-lifecycle.ts`
(`finalize()`, awaited); SDK re-exports unchanged (return type now `Promise`).
