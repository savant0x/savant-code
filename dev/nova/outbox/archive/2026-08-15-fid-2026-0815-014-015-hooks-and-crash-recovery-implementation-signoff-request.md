<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Nova Implementation Sign-off Request — FID-2026-0815-014..015 (React Rules-of-Hooks + CLI crash recovery)

**Date:** 2026-08-15
**Scope:** Two closed-and-archived FIDs from the crash/harness-stability line. 014 fixes 13 React Rules-of-Hooks early-return violations (the "Rendered more hooks than during the previous render" crash class) and wires `rules-of-hooks: error`. 015 fixes the full CLI crash-recovery class — seven findings that reduced four operator-reported terminal kills to one mechanism (uncaught error/rejection → `process.exit(1)` with no containment).
**Status:** REQUESTED
**Priority:** High (both are crash classes; 014 is the confirmed live-crash site, 015 is the containment layer).

## Request

Please independently audit the implementations of FID-2026-0815-014 and -015 at source and return one verdict **per FID**:

- `PASS — implementation independently verified; eligible for operator closure`
- `FAIL — implementation requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is an **implementation audit only**. It does **not** authorize closure, commit, push, release, publication, or deployment. Operator closure remains a separate decision after your PASS.

## What changed (per FID)

### FID-2026-0815-014 — React Rules-of-Hooks early-return violations (13 instances)

A component that calls a hook after a conditional early `return null` changes its hook count between renders and React throws `Rendered more hooks than during the previous render`, killing the render. The original grep (7 `IS_SAVANT_FREE`-guard instances) missed six further instances gated on runtime-mutable content/mode state; wiring the lint rule surfaced them.

- **Lint enforcement added (the durable fix):** `eslint.config.js:214` sets `'react-hooks/rules-of-hooks': 'error'`; `:217` sets `'react-hooks/exhaustive-deps': 'off'` (its 23 pre-existing dependency-array warnings would collide with this repo's `--max-warnings 0` gate; deferred to a separate triage FID).
- **13 fixes (ordering-only — guard condition + returned value unchanged, hooks hoisted/reordered):**
  - Loop-1 `.tsx` family: `agent-mode-toggle.tsx`, `build-mode-buttons.tsx`, `mode-divider.tsx`, `out-of-credits-banner.tsx`, `subscription-limit-banner.tsx`, `usage-banner.tsx`, and the live-crash site `blocks/thinking-block.tsx` (fixed earlier this session).
  - Loop-2 family (surfaced by the rule):
    - `hooks/use-gravity-ad.ts:254` — `isDirectProviderMode()` return moved below the hooks (a custom `.ts` hook, which is why the `.tsx`-only grep missed it)
    - `blocks/tool-branch.tsx` — `useCallback`×3 at `:83/:132/:136`, guards moved to `:140+`
    - `blocks/agent-branch-wrapper.tsx` — `onToggle`/`getCopyText` hoisted above the `:389` early return (was `:370`)
    - `message-with-agents.tsx` — `paletteForMessage` `:127`, `markdownOptions` `:139`, `if (isAgent)` guard at `:143`
    - `blocks/single-block.tsx:73` — `getCopyText` hoisted out of the `switch` (above `:75`)
    - `blocks/tool-block-group.tsx:45` — `getCopyText` above the `:56` guard

### FID-2026-0815-015 — CLI crash recovery (F-1..F-7)

- **F-1 (render boundary):** `cli/src/components/error-boundary.tsx:28` is now a real class boundary (`getDerivedStateFromError` `:34` + `componentDidCatch` `:38`), replacing the old no-op passthrough; the app root is wrapped at `cli/src/index.tsx:621` and the agent-children subtree at `children-grid.tsx:67`.
- **F-2 (frozen-state timer — the confirmed crash):** `activity-tracking.ts:195` guards the 5s idle heartbeat in `try/catch`; `clearActivityIdleTimer` (`:216`) is called from the run loop's `finally` (`loop.ts:398`) so no exit path leaves a live timer over an immer-frozen `agentState`.
- **F-3 (cyclic DB serialization):** `packages/database/src/service.ts:19` adds `stringifySessionState` (ephemeral-key omit), used at both save sites `:130` and `:157`.
- **F-4 (SDK omit-list):** `provenance` added to `EPHEMERAL_KEYS` at `sdk/src/run-state/serialization.ts:13`.
- **F-5 (non-fatal background async):** `renderer-cleanup.ts:141` `unhandledRejection` now logs-and-continues instead of `process.exit(1)`.
- **F-6 (visible fatal errors):** `renderer-cleanup.ts:131` writes the fatal error to stderr after the terminal reset.
- **F-7 (last resort kept):** `uncaughtException` (`:123`) stays fatal (`process.exit(1)` at `:135`).

## Verification evidence (reproduce independently)

- Typecheck ×4 (sdk / common / agent-runtime / cli) + database — clean.
- Full suites: agent-runtime **971/0** · sdk **476 pass / 1 skip / 0 fail** · database **16/0** · cli **3080 pass / 18 skip / 0 fail**.
- New focused tests: error-boundary contract (6) · frozen-state heartbeat + `clearActivityIdleTimer` (5) · cyclic DB save (1) · provenance-omit (1).
- ESLint `--max-warnings 0` repo-wide (zero `rules-of-hooks` diagnostics) · Prettier · markdownlint on both FIDs.

## Hard questions Nova must verify at source

### FID-014 (hooks)

1. **The rule is the enforcement (Law 4).** Confirm `eslint.config.js:214` is `error` (not `warn`/`off`) and that `bun x eslint cli/src --max-warnings 0` reports **zero** `rules-of-hooks` diagnostics.
2. **Ordering-only, behavior preserved.** Confirm at least the six Loop-2 sites keep their guard condition and returned value byte-identical and only move hook call order — spot-check `use-gravity-ad.ts:254`, `single-block.tsx:73`, `message-with-agents.tsx:127/139/143`.
3. **`exhaustive-deps` is `off`, not `warn`.** Confirm `:217` is `off` so the 23 pre-existing dependency-array warnings cannot collide with the `--max-warnings 0` gate.

### FID-015 (crash recovery)

4. **Boundary is real and wraps the root.** Confirm `error-boundary.tsx` is a class component with `getDerivedStateFromError` + `componentDidCatch` (not a passthrough), that `index.tsx:621` wraps the `createRoot` payload, and `children-grid.tsx:67` wraps the subtree.
5. **Timer cleared on every exit path.** Confirm `loop.ts:398` sits in the run loop's `finally`, and the `bumpActivityIdleTimer` callback body (`activity-tracking.ts:195`) is `try/catch`-guarded so a frozen-state write cannot re-escape.
6. **DB omit at both save sites.** Confirm `service.ts:130` and `:157` route through `stringifySessionState`, and `provenance` is in `EPHEMERAL_KEYS` (`serialization.ts:13`).
7. **Handler split is exactly right.** Confirm `unhandledRejection` (`renderer-cleanup.ts:141`) does **not** call `process.exit`, while `uncaughtException` (`:123`) still does (`:135`) after writing to stderr (`:131`).

## Authorization boundary

Implementation review of FID-2026-0815-014 and -015 only. No closure, commit, push, release, publication, or deployment authority. Operator closure remains a separate decision after your PASS. (Prior 0815 sign-off requests — FIDs 002/004–009 and 010–013 — were requested separately and are already on file in `dev/nova/outbox/archive/`.)
