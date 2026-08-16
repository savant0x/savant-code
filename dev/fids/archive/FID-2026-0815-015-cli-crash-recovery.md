<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: CLI crash recovery — full class: containment, frozen-state, serialization, fatal handlers

**Filename:** `FID-2026-0815-015-cli-crash-recovery.md`
**ID:** FID-2026-0815-015
**Severity:** high
**Status:** closed
**Created:** 2026-08-15

---

## Summary

The operator hit four terminal crashes (`error: script "dev" exited with code
1`). A project-wide hunt for the **whole class** — not the individual bugs —
found that every crash reduces to one mechanism: **an uncaught exception or
unhandled rejection reaches the process-level handlers in
`renderer-cleanup.ts`, which call `process.exit(1)` and kill the entire
terminal, with no containment layer anywhere.** Seven concrete findings, each
with `file:line` evidence, are cataloged below. Two were already confirmed live
this session (the hooks render error → FID-014; the idle-timer readonly crash).

## Environment

- **OS:** Windows (dev), cross-platform runtime
- **Language/Runtime:** TypeScript / React 19 / `@opentui/react` 0.2.2 (on `react-reconciler` 0.32) / Bun
- **Commit/State:** uncommitted working tree on `main` (0.0.24 work in progress)

## Detailed Description — the findings

### F-1 — Render errors have no boundary (crash class #1)

`error-boundary.tsx:16-34` defines `ErrorBoundaryPlaceholder` as
`memo(({ children }) => <>{children}</>)` with the comment *"This component does
NOT catch render errors … OpenTUI's JSX types don't support React class
components."* `children-grid.tsx:67` wraps content in it, but it does nothing.
Grep: **zero** `componentDidCatch`/`getDerivedStateFromError`/class components
in `cli/src`; the root `createRoot(renderer).render(…)` at `index.tsx:615` is
unwrapped. `react-reconciler` supports class boundaries at runtime — the
obstacle is TSX typing only.

### F-2 — Deferred mutation of frozen state (the confirmed crash)

`activity-tracking.ts:194-200` — `bumpActivityIdleTimer` arms a 5s
`setTimeout` that runs `agentState.activity = { kind: 'idle' }` at `:197`.
`step.ts:237` arms it on `thinking`; on **cancel** (`AbortError`) the
`step.ts:283` idle transition never clears it, so ~5s later it mutates an
**immer-auto-frozen** `agentState` (the CLI zustand stores use `immer`) →
`TypeError: Attempted to assign to readonly property` → `uncaughtException` →
exit. Confirmed in `debug/cli.jsonl`. There are **30 in-place
`agentState.* =` mutation sites** in agent-runtime (grep) — safe while
synchronous, but the same fragile "mutate shared object" pattern.

### F-3 — Cyclic DB serialization (lost chat-state saves)

`packages/database/src/service.ts:104` and `:129` call
`JSON.stringify(sessionState)` on the live `SessionState`, whose
`mainAgentState.activityIdleTimer` (a Bun `Timeout`) forms a cycle →
`JSON.stringify cannot serialize cyclic structures` → the DB save fails and is
silently swallowed (`db-storage.ts:120`). The filesystem path is already
cyclic-safe (`save.ts` uses `safeStringify`, FID-2026-0806-012); the DB path is
not.

### F-4 — SDK serialization omit-list is incomplete

`sdk/src/run-state/serialization.ts:9-13` `EPHEMERAL_KEYS` omits `activity`,
`activityIdleTimer`, `echoCompliance`, `_echoEnforcement` — but **not
`provenance`** (`ProvenanceSessionLike`, marked `@internal … NOT serialized` in
`common/src/types/session-state.ts:313-318`). A provenance session instance can
carry Maps/state that don't round-trip cleanly.

### F-5 — `unhandledRejection` is fatal for background async

`renderer-cleanup.ts:133-140` installs `process.on('unhandledRejection')` →
`process.exit(1)`, overriding Bun's default (log-and-continue). ~21
fire-and-forget `void …()` async sites exist (grep) — ad fetches
(`use-gravity-ad/network.ts:142`, `use-gravity-ad.ts:236`), log shipping
(`log-shipper.ts:41/50/75`), clipboard, image load, analytics — any of which can
reject and kill the session.

### F-6 — Fatal errors are invisible on the terminal

The dev logger routes `logger.error` to `debug/cli.jsonl` via `appendFileSync`
(`sink.ts`), so `renderer-cleanup.ts`'s `logger.error('Uncaught exception', …)`
never reaches stdout — the crash reads as a bare `script "dev" exited with code
1`.

### F-7 — `uncaughtException` is fatal (last-resort, but currently the only resort)

`renderer-cleanup.ts:122-132` — `uncaughtException` → `process.exit(1)`. With
no boundary (F-1) and no timer guard (F-2), this is the *only* line of defense
and it always loses the session.

## Proposed Solution (GREEN)

1. **Real error boundary (F-1).** Class component (`getDerivedStateFromError` +
   `componentDidCatch`) written with `React.createElement` (non-JSX). Wrap the
   root (`AppWithAsyncAuth` / `createRoot` payload) and replace the no-op
   `ErrorBoundary` on message/agent subtrees.
2. **Heartbeat hardening (F-2).** `try/catch` the `bumpActivityIdleTimer`
   callback; clear `agentState.activityIdleTimer` on the cancel/finalize path.
3. **Cyclic-safe DB serialization (F-3).** In `packages/database/src/service.ts`,
   serialize `sessionState` through the same ephemeral-field omit used by the
   SDK (or `safeStringify`) so the timer handle never hits `JSON.stringify`.
4. **Complete the SDK omit-list (F-4).** Add `provenance` to `EPHEMERAL_KEYS`.
5. **Make `unhandledRejection` non-fatal (F-5).** Log the rejection and continue
   (Bun/Node default) instead of `process.exit(1)` — background async must not
   kill the session.
6. **Surface fatal errors to stderr (F-6).** On `uncaughtException`, after the
   terminal reset, write the error to stderr in addition to the file log.
7. **Keep `uncaughtException` fatal (F-7)** as the last resort — contained by 1–2
   for the known classes, fatal for genuinely-uncontained errors.

### Verification

- typecheck: agent-runtime · cli · sdk · database
- full suites: agent-runtime · cli · sdk · database
- New tests: (a) throwing component → boundary fallback renders, no crash;
  (b) frozen `agentState` + heartbeat → no throw; (c) DB save of a sessionState
  with `activityIdleTimer` → no `JSON.stringify` throw (timer omitted);
  (d) `serializeRunState` drops `provenance`.
- ESLint `--max-warnings 0` · Prettier · Law-4 grep (boundary wraps root; timer
  cleared on cancel; DB uses the omit path).

## Perfection Loop

### Loop 1 — RED

Project-wide scan cataloged the whole class: no-op boundary (F-1), deferred
frozen-state mutation (F-2, confirmed crash), cyclic DB `JSON.stringify` (F-3),
incomplete SDK omit-list (F-4), fatal `unhandledRejection` (F-5), invisible
fatal errors (F-6), fatal `uncaughtException` as the only resort (F-7). Each
with `file:line` + `debug/cli.jsonl` evidence. **Exit: all issues cataloged.**

### Loop 1 — GREEN

Fix documented for all seven, ordered by containment layer (boundary → timer →
serialization → handlers → surfacing). **Exit: fixes documented.**

### Loop 1 — AUDIT (planning)

- **Behavior preservation:** boundary only changes the failure path; timer
  try/catch skips a redundant idle transition; DB omit removes only ephemeral
  fields; `unhandledRejection` log-and-continue matches the engine default the
  CLI overrode.
- **Reachability (Law 4):** boundary wraps `createRoot` payload; cancel path
  clears the timer; `service.ts:104/129` are the DB stringify sites;
  `serializeRunState` is the SDK transport.
- **Verification plan:** 4 typechecks + 4 suites + 4 focused tests + lint/format.
- **AUDIT passes (planning) → COMPLETE (converged — present for approval, no
  code written yet).**

### Missed Questions

1. **Why not fix all 21 fire-and-forget sites individually?** That's wack-a-mole;
   F-5 makes the whole async class non-fatal, which is the durable fix.
2. **Is downgrading `unhandledRejection` safe?** Yes — it restores the engine's
   default (log + continue); a rejected background task shouldn't take the TUI
   down, and the app's own async paths already handle their failures.
3. **Does the boundary catch F-2?** No — F-2 is a `setTimeout` throw, not a
   render/lifecycle error; the try/catch (item 2) is its actual fix.

## Resolution

Implemented and verified all seven findings (F-1..F-7) under operator approval.

- **F-1:** `cli/src/components/error-boundary.tsx` rewritten as a real class
  boundary (`getDerivedStateFromError` + `componentDidCatch`); the app root is
  wrapped at `cli/src/index.tsx:621` and the agent-children subtree at
  `children-grid.tsx` uses the same boundary.
- **F-2:** `activity-tracking.ts` guards the idle heartbeat in `try/catch` and
  adds `clearActivityIdleTimer`, called from the run loop's `finally`
  (`loop.ts:398`) so no exit path leaves a live timer over a frozen state.
- **F-3:** `packages/database/src/service.ts` now serializes `sessionState`
  through `stringifySessionState` (ephemeral-key omit) at both save sites.
- **F-4:** `provenance` added to `EPHEMERAL_KEYS` in
  `sdk/src/run-state/serialization.ts`.
- **F-5:** `renderer-cleanup.ts` `unhandledRejection` now logs and continues
  (background async is non-fatal).
- **F-6:** fatal `uncaughtException` errors are also written to stderr after
  the terminal reset.
- **F-7:** `uncaughtException` remains fatal as the last resort.

**Verification:** agent-runtime typecheck + 971/0 tests (incl. 5 new
activity-tracking); sdk typecheck + 476/1skip/0 (incl. provenance-omit test);
database typecheck + 16/0 (incl. cyclic-save test); cli typecheck + 3080/18skip/0
(incl. 6 new error-boundary tests); ESLint `--max-warnings 0` repo-wide; Prettier;
Law-4 grep (boundary wraps root, timer cleared in `finally`, DB omit path at both
save sites). No commit, push, release, publication, or deployment is implied.
