# FID: First message after every boot fails with a false "credentials changed" error

**Filename:** `FID-2026-1009-001-first-message-credentials-changed-false-positive.md`
**ID:** FID-2026-1009-001
**Severity:** medium
**Status:** closed
**Created:** 2026-10-09 09:15
**Automation level:** 2
**YAGNI-Compliance:** Verified

---

## Summary

On every fresh process, the first user message fails with "Selected provider
credentials changed. Reselect the provider before retrying." whenever the
selected provider's key is env-sourced and was never saved through `/provider`.
The route persisted in `settings.json` carries an `accountRevision` UUID minted
by the process that saved it; a fresh process holds no in-memory observation of
that provider, so the first revision computation mints a *different* UUID and
the equality check rejects unchanged, valid credentials as changed. The key is
irrelevant to the failure — the check compares two random UUIDs.

## Environment

- **OS:** Windows (win32), Git Bash
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Commit/State:** committed locally as `f56020b7` (combined with
  FID-2026-1009-002/-003); closed and archived 2026-10-09

## Detailed Description

### Problem

Operator report: *"Everytime i load up savant and send my first message, i get
'Selected provider credentials changed. Reselect the provider before retrying.'
... the key did not change and was valid. In fact, im using it to talk to you."*
Reproduces on every boot for the selected provider `nous` (key from the
environment, never saved via `/provider`).

### Expected Behavior

A persisted route whose provider credential is unchanged must validate in a
fresh process. Only an actually-changed credential (or an anchored
`/provider` save) should force reselection.

### Root Cause

`getModelRouteConfig` (`common/src/providers/model-route.ts`) rejects a route
whose `accountRevision` differs from `providerAccountRevision(config)`. The
revision store (`common/src/providers/provider-account-revisions.ts`) is
**process-memory only**: a `Map` keyed by provider. With no entry — every fresh
process for an env-sourced provider — `providerAccountRevision` **mints a new
random UUID** and stores it. The persisted route's UUID was minted by a
previous process and can never equal the fresh mint. The only cross-process
bridge is `credentials.json`'s `providerAccountRevisions`, written by
`persistProviderKey` on `/provider` saves; env-sourced keys have no entry there.

Secondary ordering hazard: provider monitoring (`provider-monitoring.ts` →
`captureModelRoute`) calls the revision seam at boot, so the map can hold a
minted UUID *before* the first message validates the persisted route.

### Evidence

Persisted state (measured 2026-10-09, `~/.savant-code-dev/`):

```text
settings.json  → route.providerId "nous", accountRevision "6f2b7391-4da2-4b8d-8e3c-69deacbefeaa"
credentials.json → providerAccountRevisions: { xkiro, cleanapis, codecraft, vercel }  (no "nous")
```

Pre-fix probe (`dev/scratchpad/active/fid-1009-001-first-message-probe.ts`):

```text
FAIL fresh-boot persisted route: threw: Selected provider credentials changed. Reselect the provider before retrying.
PASS observed stale route: threw: Selected provider credentials changed. ...
PASS anchored strict comparison: threw: Selected provider credentials changed. ...
```

## Impact Assessment

### Affected Components

- `common/src/providers/model-route.ts` — `getModelRouteConfig` comparison
- `common/src/providers/provider-account-revisions.ts` — revision seed seam
- `cli/src/utils/provider-key-store.ts` — boot revision seeding
- Any provider configured by environment variable rather than `/provider`

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: Feature degraded, workaround exists (reselect once per boot)
- [ ] Low

## Proposed Solution

### Approach

Adopt-if-unobserved (Fix A, operator-approved). When a route carries an
`accountRevision` and this process has **never observed** that provider, seed
the in-memory store with the route's own revision before comparing. A provider
already observed this process (a mid-session `/provider` save) keeps the strict
comparison, and the ordinary value-change detection still mints on rotation.

1. `getModelRouteConfig`: seed-if-absent via `seedProviderAccountRevision`
   before the `accountRevision` comparison.
2. `applyPersistedProviderApiKeys` (CLI boot): also seed from the persisted
   `modelSelection.route.accountRevision`, so monitoring's boot-time capture
   observes the persisted revision rather than minting a new one.

### Verification

- Probe: Path 1 (fresh boot) must flip FAIL → PASS; Paths 2–4 must keep
  throwing (guard preserved).
- New pins: adopt-if-unobserved passes; observed stale route throws; anchored
  revision stays strict; value change after adoption throws.
- Gates: `typecheck common`, `typecheck cli`, both test files, `quality`.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: test common/src/providers/__tests__/model-route-account-adoption.test.ts
- gate: test cli/src/utils/__tests__/provider-key-store-account-adoption.test.ts
- gate: probe dev/scratchpad/active/fid-1009-001-first-message-probe.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:7429f6b4a4ed3eeef28e5b6ee022d8f1746b329a99f448d19ccb79927a2bb666
- verified: 2026-10-09T14:09:48.886Z
- typecheck common: exit 0
- typecheck cli: exit 0
- test common/src/providers/__tests__/model-route-account-adoption.test.ts: exit 0
- test cli/src/utils/__tests__/provider-key-store-account-adoption.test.ts: exit 0
- probe dev/scratchpad/active/fid-1009-001-first-message-probe.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Root cause established with the persisted-state measurement and the
  pre-fix probe (Path 1 FAILs with the operator's exact error; guard paths 2–3
  PASS, proving the comparison itself works when an observation exists).
- **GREEN:** Fix A — two seed-if-absent seams, ~20 lines total, no schema or
  persistence changes.
- **AUDIT:** All six declared gates exit 0 on the final tree (receipt
  below); eslint `--max-warnings 0` exit 0 and `prettier --check` clean on
  the five changed files; `lint:md` exit 0. Law 4 evidence — production
  callers of `getModelRouteConfig`:
  `sdk/src/impl/model-provider/explicit-route.ts` (request construction),
  `sdk/src/impl/model-provider/apply-request-budget.ts`,
  `cli/src/utils/provider-health-monitor.ts`,
  `cli/src/utils/provider-quota-monitor.ts`; production callers of
  `applyPersistedProviderApiKeys`:
  `cli/src/utils/provider-monitoring.ts` (boot refresh) and
  `cli/src/utils/provider-setup.ts` (setup flow).
- **ADVERSARIAL:** Both directions stay fail-closed — an observed provider
  still rejects a stale route, and a credentials.json anchor still beats
  the route's revision. One accepted behavior change (documented): a key
  rotated between processes no longer forces reselection for env-sourced
  providers, which have no persisted anchor to detect it; the request uses
  the current credential either way, and anchored `/provider` saves keep
  the strict comparison.
- **CHANGE DELTA:** n/a

### Missed Questions

1. **Should adoption apply when credentials.json HAS an anchor?** No — an
   anchored provider keeps its strict comparison; an existing observation is
   never overwritten. Only the unobserved case adopts.
2. **Does adoption weaken mid-session change detection?** No — once observed,
   a value change still mints a new UUID and rejects the stale route (pinned).
3. **What about a missing key?** The route validates (pin passes) and the
   request fails later with the real missing-key message instead of the
   misleading credentials-changed error.

---

## Implementation Evidence

- **Commit SHA:** `f56020b7` — combined with FID-2026-1009-002 and
  FID-2026-1009-003; all three closed and archived 2026-10-09.
- **File:line ranges:**
  - `common/src/providers/model-route.ts` — `getModelRouteConfig`:
    `seedProviderAccountRevision(config, route.accountRevision)` before
    the `accountRevision` comparison (adopt-if-unobserved).
  - `cli/src/utils/provider-key-persistence.ts` — new
    `adoptPersistedSelectionRevision()`: loads the persisted selection and
    seeds its route revision for the selected provider (absent entries
    only).
  - `cli/src/utils/provider-key-store.ts` —
    `applyPersistedProviderApiKeys` calls
    `adoptPersistedSelectionRevision()` before the direct-mode tail.
- **Gate output:** receipt below — 6/6 declared gates exit 0.
- **Reproducibility:** grep `adoptPersistedSelectionRevision` (definition
  plus call site) and the `seedProviderAccountRevision` call inside
  `getModelRouteConfig`; the probe at
  `dev/scratchpad/active/fid-1009-001-first-message-probe.ts` reproduces
  the boot sequence hermetically (pre-fix Path 1 FAILs with the
  operator-reported error; post-fix 5/5 PASS).
- **Step statuses:** both Proposed Solution steps `implemented` — the CLI
  step was extracted to `adoptPersistedSelectionRevision` to restore the
  300-line ceiling on `provider-key-store.ts` (314 → 297 lines).

## Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output (receipt below;
      probe 5/5, common 5/5, cli 1/1, quality:report PASS)
- [x] Production call-graph evidence present for the repaired wiring
      (Law 4 grep output recorded in Loop 1 AUDIT)
- [x] FID status reflects the actual implementation state (`closed` —
      implemented, verified, committed `f56020b7`, archived 2026-10-09)

## Resolution

- **Closed Date:** 2026-10-09
- **Fix Description:** adopt-if-unobserved for the persisted route
  `accountRevision`, at both the common validation seam
  (`getModelRouteConfig`) and the CLI boot seam
  (`applyPersistedProviderApiKeys` → `adoptPersistedSelectionRevision`).
  A fresh process now accepts a persisted route for a provider it has
  never observed; an already-observed provider (a mid-session
  `/provider` save) and a credentials.json anchor keep the strict
  credentials-changed comparison.
- **Tests Added:** Yes — 5 pins in
  `common/src/providers/__tests__/model-route-account-adoption.test.ts`
  (fresh-process adoption; observed stale rejection; anchor precedence;
  value-change rejection; monitoring-capture stability) and 1
  boot-ordering pin in
  `cli/src/utils/__tests__/provider-key-store-account-adoption.test.ts`.
- **Verification Evidence:** receipt below — 6/6 gates exit 0;
  implementation commit `f56020b7`; independent Verifier PASS.
- **Archived:** 2026-10-09 — moved to `dev/fids/archive/` on the
  operator's closure authorization; register entry evicted from `SCOPE.md`;
  CHANGELOG entry appended under 0.0.35 `### Fixed`.