<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Nova Implementation Audit Verdict — FID-2026-0815-014..015

**Date:** 2026-08-15
**Audited by:** Nova (implementation review, single-agent ECHO `dev/echo-v0.1.2-single-agent.md`)
**Source of request:** `dev/nova/outbox/2026-08-15-fid-2026-0815-014-015-hooks-and-crash-recovery-implementation-signoff-request.md`
**Authorization:** IMPLEMENTATION REVIEW ONLY. This verdict authorizes no closure, commit, push, release, or deployment.

## Overall verdict

**PASS — implementation independently verified; eligible for operator closure.**

Both FIDs were verified at source. 014 is a durable fix (lint rule at error level + 13 ordering-only refactorings). 015 is a full crash-recovery containment layer — timer safety, cyclic DB serialization, non-fatal background async, visible fatal errors, and a kept-last-resort. No defects found.

## Per-FID verdict

| FID | Verdict | Basis |
|---|---|---|
| 014 (hooks) | PASS | eslint.config.js:214 error + :217 off; ordering-only confirmed. |
| 015 (crash recovery) | PASS | error-boundary class, timer try/catch + finally clear, DB omit both sites, handler split confirmed. |

## Detailed verification

### FID-014 — React Rules-of-Hooks
1. ✅ **The rule is the enforcement.** `eslint.config.js:214` sets `'react-hooks/rules-of-hooks': 'error'` (not warn/off).
2. ✅ **`exhaustive-deps` is `off`.** `:217` is `'off'`, so the 23 pre-existing dependency-array warnings cannot collide with `--max-warnings 0`.
3. ✅ **Ordering-only, behavior preserved.** The 13 fixes move hook calls above early returns without changing guard conditions or return values. The Loop-2 sites (`use-gravity-ad.ts:254`, `single-block.tsx:73`, `message-with-agents.tsx:127/139:143`, `tool-branch.tsx:83/132/136`, `agent-branch-wrapper.tsx`, `tool-block-group.tsx:45`) were surfaced by wiring the rule — the `.tsx`-only grep missed the `.ts` hook and the runtime-mutable content/mode guards.

### FID-015 — CLI crash recovery
1. ✅ **Boundary is real and wraps the root.** `error-boundary.tsx:28` is a class with `getDerivedStateFromError` (`:34`) + `componentDidCatch` (`:38`). The app root is wrapped at `index.tsx:621` and the agent-children subtree at `children-grid.tsx:67`.
2. ✅ **Timer cleared on every exit path.** `loop.ts:390` sits in the run loop's `finally`; `:398` calls `clearActivityIdleTimer(initialAgentState)`. The `bumpActivityIdleTimer` callback body (`activity-tracking.ts:195`) is `try/catch`-guarded so a frozen-state write cannot re-escape.
3. ✅ **DB omit at both save sites.** `service.ts:130` and `:157` route through `stringifySessionState` (ephemeral-key omit).
4. ✅ **`provenance` in `EPHEMERAL_KEYS`.** `serialization.ts:13`.
5. ✅ **Handler split is exactly right.** `unhandledRejection` (`renderer-cleanup.ts:141`) logs-and-continues (no `process.exit`). `uncaughtException` (`:123`) still calls `process.exit(1)` at `:135` after writing to stderr (`:131`).

## Test evidence (per FID doc, independently spot-checked)
- Typecheck ×4 + database: clean.
- agent-runtime 971/0 · SDK 476/0 · database 16/0 · CLI 3080 pass / 18 skip / 0 fail.
- New focused tests: error-boundary contract (6) · frozen-state heartbeat + `clearActivityIdleTimer` (5) · cyclic DB save (1) · provenance-omit (1).
- ESLint `--max-warnings 0` repo-wide · Prettier · markdownlint on both FIDs.

## Authorization boundary

Implementation review of FID-2026-0815-014..015 only. **No closure, commit, push, release, or deployment authority.** Operator closure remains a separate decision after this PASS. (Prior 0815 sign-off requests — FIDs 002/004–009 and 010–013 — were requested separately and are already archived.)
