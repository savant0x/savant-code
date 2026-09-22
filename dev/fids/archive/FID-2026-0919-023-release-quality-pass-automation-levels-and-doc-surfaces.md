# FID: 0.0.33 release quality pass — automation levels, documented-version surfaces, and cross-suite test isolation

**Filename:** `FID-2026-0919-023-release-quality-pass-automation-levels-and-doc-surfaces.md`
**ID:** FID-2026-0919-023
**Severity:** high
**Status:** closed
**Created:** 2026-09-19 18:40
**Automation level:** 3
**YAGNI-Compliance:** Confirmed (no new capability: two existing mechanisms —
the version bump's doc-surface writer and the drift checker — were extended and
single-sourced; no new gate kind, dependency, or subsystem)

---

## Summary

A release-readiness pass on 0.0.33 found three classes of defect and closed all
three. (1) **Automation levels were undocumented governance**: `session.autonomy_level: 3`
sat in `protocol.config.yaml` with a one-line gloss, `ECHO.md` named
Guided/Supervised/Autonomous in a *note* that never defined them, and the
governing single-agent protocol had no section at all. (2) **Documented version
surfaces were silently wrong**: the 0.0.33 bump relabelled `**v0.0.32** —` in
`README.md`, so the README advertised the previous release's content under the
new version and the chain lost its v0.0.32 entry; `README.zh-CN.md` kept a
`**v0.0.32**` blurb label (its badge had bumped) because the writer had no
pattern for it; and `ARCHITECTURE.md` claimed the "current state" was version
`0.0.26` — seven releases stale, invisible because the writer only advanced a
surface that sat exactly one release behind. (3) **The root `bun run test` gate
was RED**:
`packages/agent-runtime/src/provenance/__tests__/provenance-signing-failure-visibility.test.ts`
installed a
process-wide `mock.module` on `@savant-code/common/crypto` that leaked into
`teacher/progression`, making its keypair signing return `null` and failing two
receipt assertions — while each suite passed alone.

## Environment

- **OS:** Windows (win32), bash shell
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Commit/State:** `main`, working tree with the 0.0.33 bump applied; nothing
  committed (G2 withheld)
- **Gates available:** `typecheck` ×12, `test`, `lint`, `lint_md`, `format`,
  plus `quality`, `validate:repository`, `version:check`, `release:public:preview`

## Detailed Description

### Problem

Three independent defects, each invisible to the gates that were supposed to
cover it:

1. **Automation levels** existed as a *number* with no definition anywhere an
   agent or operator could read what level 3 authorizes. A grep for
   `automation`/`level 3` across `protocol.config.yaml`, `ECHO.md`, `SCOPE.md`
   and `dev/echo-v0.1.2-single-agent.md` returned exactly one unrelated hit
   (`ECHO.md` G7, local git hygiene).
2. **Doc surfaces**: `version:check` was PASS while `README.md` advertised
   0.0.32's features as 0.0.33, `README.zh-CN.md` advertised 0.0.32 outright,
   and `ARCHITECTURE.md` stated 0.0.26.
3. **Test isolation**: `bun run test` failed 2 tests that both passed in
   isolation.

### Expected Behavior

- The automation ladder is defined once, authoritatively, with the invariants a
  level cannot lift, and every work item records its own level.
- A release's documented version surfaces match the released version, and a
  surface the bump fails to update is **reported**, never silently skipped.
- The root test gate is green: no suite may leave process-wide state that
  changes another suite's result.

### Root Cause

1. **Automation levels** — the concept was added to config as a bare scalar
   (`session.autonomy_level`) and to `ECHO.md` as a parenthetical *note*; neither
   carried the definition, and the single-agent adaptation (which actually
   governs single-agent sessions) was never updated. There was no per-item
   recording convention at all, so levels could not be applied to work.
2. **Doc surfaces** — `updateDocSurfaces` replaced an **exact `oldVersion`
   string** and `if (!content.includes(from)) return` on a miss. A surface
   therefore advanced only when it was *exactly one release behind*: any surface
   that fell behind once stayed behind forever (ARCHITECTURE.md, 0.0.26 through
   seven bumps), and the localized blurb label was never declared as a surface
   at all. Nothing checked the doc surfaces, so both rot modes were invisible to
   `version:check`.
3. **Test isolation** — `mock.module` in Bun is **process-wide**, and the
   suite's stub replaced `signPayload` with a function that throws
   unconditionally. `teacher/progression` derives its teacher keypair from the
   same module, so after the stub was installed its `adaptAttemptReceipt`
   returned `null`. The leak reproduced in **both** suite orders and survived
   both `afterAll(mock.restore())` and moving the installation into `beforeAll`.

### Evidence

- `protocol.config.yaml:114` — `autonomy_level: 3 # 1=Guided, 2=Supervised,
  3=Autonomous (default)` (the only definition, pre-fix).
- `ECHO.md:722` — "Execution & Autonomy Modes" ended with the note
  *"Autonomy Levels (Guided, Supervised, Autonomous) govern push/commit
  behavior"* — names, no definitions.
- `scripts/version-docs.ts` (pre-fix) — `replace()` returned early on a
  non-match (`if (!content.includes(from)) return`), and no `README.zh-CN.md`
  blurb pattern existed.
- `ARCHITECTURE.md:279` (pre-fix) — "**Current state:** … at version `0.0.26`."
  with `version:check` PASS.
- `packages/agent-runtime/src/provenance/__tests__/provenance-signing-failure-visibility.test.ts:32`
  (pre-fix) — top-level `mock.module('@savant-code/common/crypto', …)`.
- `packages/agent-runtime/src/teacher/progression/__tests__/progression.test.ts:229`
  — `expect(signed).not.toBeNull()` / `Received: null`.
- Bisect (`for f in src/provenance/__tests__/*.test.ts`): only the
  signing-failure suite contaminates progression (10 pass / 1 fail); the other
  seven pairings are 0 fail.

## Impact Assessment

### Affected Components

- Governance: `dev/echo-v0.1.2-single-agent.md`, `ECHO.md`, `protocol.config.yaml`,
  `templates/FID-TEMPLATE.md`, `SCOPE.md`, protocol bundle + copies.
- Release surfaces: `README.md`, `README.zh-CN.md`, `ARCHITECTURE.md`,
  `scripts/version-docs.ts`, `scripts/version.ts`.
- Test isolation: `packages/agent-runtime/src/provenance/__tests__/provenance-signing-failure-visibility.test.ts`.

### Risk Level

**High** for a release: the `test` gate is a hard gate and was failing; the
README is the first artifact a user reads and advertised the wrong release's
features; and an agent had no written authority model for autonomous work.

## Proposed Solution

### Approach

Extend the authorities that already exist rather than adding parallel ones:
one `DOC_VERSION_SURFACES` table drives both the writer and the checker; one
`Automation Levels` section defines the ladder and the other surfaces reference
it; the test stub is made **inert for every other caller** instead of trying to
undo a process-wide replacement that (measured) cannot be undone.

### Steps

1. [x] `implemented` — `dev/echo-v0.1.2-single-agent.md` gains
   `## Automation Levels`: the three levels with the authority each grants, the
   session-ceiling vs per-item rule, the Law 2 semantics at Level 3 (a
   *recorded* presentation), and the invariants no level lifts (G2,
   remote/release/production, credentials, destructive ops, Law 3, Law 11).
   Quick Reference row added.
2. [x] `implemented` — `ECHO.md`'s un-defining note becomes a real ladder,
   reconciled with the version-control laws: levels govern how far the agent
   proceeds before asking and do **not** by themselves authorize a commit or
   push.
3. [x] `implemented` — `session.autonomy_level` documented as the session
   ceiling with the ladder inline; `templates/FID-TEMPLATE.md` gains a required
   `Automation level` field; `SCOPE.md` gains the recording convention and every
   task/item is tagged.
4. [x] `implemented` — `DOC_VERSION_SURFACES` (six documented surfaces)
   single-sources the writer and the checker; `updateDocSurfaces` converges each
   declared surface **from whatever version it states**; `collectDocVersionDrift`
   reports drifted **and missing** surfaces and is wired into
   `collectVersionDrift` (`version:check`).
5. [x] `implemented` — the localized README blurb label is now a declared
   surface, and both README blurbs carry an accurate 0.0.33 blurb with the
   v0.0.32 entry restored.
6. [x] `implemented` — `ARCHITECTURE.md`'s current-state note converged to 0.0.33
   (the drift the new check found on its first run).
7. [x] `implemented` — the signing-failure stub now throws only for this suite's
   payloads (`FAILING_SESSIONS`) and delegates to the real signer for all
   others.
8. [x] `implemented` — the six pre-existing `format`-gate violations (unrelated
   files, committed unformatted by earlier sessions) were formatted, taking
   repo-wide `prettier --check` green.

### Verification

- `bun run typecheck` — all 12 workspaces exit 0.
- `bun run test` — **exit 0, 0 fail in all 12 workspaces** (was 2 fail). Contamination proof:
  `bun test src/provenance/ src/teacher/progression/` = 46 pass / 0 fail in
  **both** orders (was 1 fail either way); the SEC-5 suite alone still induces
  its failure (2 pass).
- `bun run version:check` — PASS (was FAIL on `ARCHITECTURE.md: 0.0.26`).
- `bunx prettier --check .` — PASS (was 6 files).
- `bun run quality:report` — PASS (1498 baselined files).
- `bun run validate:repository` — PASS. `bun x eslint . --max-warnings 0` — exit 0. `bun run lint:md` — exit 0.
- `bun run release:public:preview` — exit 0; changelog section `## 0.0.33 — 2026-09-19` extracts.
- Changelog audit — PASS: no `[Unreleased]` accumulator,
  reverse-chronological by the repo's own extractor rule, and every unreleased
  FID id resolved on disk.

## Verification Gates

- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: test scripts/version-docs-drift.test.ts
- gate: test scripts/bump-version.test.ts
- gate: test scripts/__tests__/protocol-copies.test.ts
- gate: test common/src/util/__tests__/embedded-protocol.test.ts
- gate: test packages/agent-runtime/src/provenance/__tests__/provenance-signing-failure-visibility.test.ts
- gate: test packages/agent-runtime/src/teacher/progression/__tests__/progression.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:e3c9453ac8d4e97cbc6cf4f6297dffe5d2f7040d77586c5c9e032bdc659ffc64
- verified: 2026-09-19T19:00:27.194Z
- typecheck common: exit 0
- typecheck packages/agent-runtime: exit 0
- test scripts/version-docs-drift.test.ts: exit 0
- test scripts/bump-version.test.ts: exit 0
- test scripts/__tests__/protocol-copies.test.ts: exit 0
- test common/src/util/__tests__/embedded-protocol.test.ts: exit 0
- test packages/agent-runtime/src/provenance/__tests__/provenance-signing-failure-visibility.test.ts: exit 0
- test packages/agent-runtime/src/teacher/progression/__tests__/progression.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Three findings grounded against the live tree, not metadata: the
  automation-ladder grep (one unrelated hit), the doc-surface audit
  (`README.md` blurb claiming 0.0.32's content as 0.0.33; `README.zh-CN.md`
  label at 0.0.32 with a 0.0.33 badge; `ARCHITECTURE.md` at 0.0.26 with
  `version:check` PASS), and the root test chain's 2 failures traced by bisect
  to a single contaminating suite.
- **GREEN:** Implementation per the steps — governance text, the single table +
  drift check, the convergent writer, the scoped stub, and the format fixes.

### Missed Questions

- *Does editing `ECHO.md`/`protocol.config.yaml` require bundle regeneration?* —
  Yes; both are embedded grounding files. Regenerated and parity-verified
  (15/15 copies, 7/7 embedded-protocol).
- *Is the automation ladder a new concept or an existing one?* — Existing but
  undocumented (`session.autonomy_level`); the work documents and single-sources
  it rather than inventing a second mechanism.
- *Can `mock.restore()` undo the leak?* — Measured no. Both `afterAll` and a
  `beforeAll` installation still leaked, in both orders — so containment, not
  rollback, is the fix.

### Implementation Evidence (REQUIRED for `closed`)

- Governance: `dev/echo-v0.1.2-single-agent.md` (`## Automation Levels` + Quick
  Reference row), `ECHO.md` (`### Automation Levels (Autonomy)`), `protocol.config.yaml`
  (ladder comments on `session.autonomy_level`), `templates/FID-TEMPLATE.md`
  (`**Automation level:**`), `SCOPE.md` (convention + per-task tags + Task 73).
- Single-sourced surfaces: `scripts/version-docs.ts` (`DOC_VERSION_SURFACES`,
  `collectDocVersionDrift`, table-driven convergence loop),
  `scripts/version.ts` (`collectVersionDrift` wiring).
- Surfaces repaired: `README.md`, `README.zh-CN.md`, `ARCHITECTURE.md:279`.
- Isolation fix: `packages/agent-runtime/src/provenance/__tests__/provenance-signing-failure-visibility.test.ts`
  (`FAILING_SESSIONS` + delegating stub).

### Code Verification Evidence

- Tests: `scripts/version-docs-drift.test.ts` (5 pins: synced tree clean;
  localized label is a checked surface; missing surface is drift with no version;
  writer converges a surface seven releases stale; the table is distinct and
  capturing) and `scripts/bump-version.test.ts` (fixture extended with the
  documented surfaces; the sync test now also proves a drifted doc surface lands
  in `collectVersionDrift`).
- Live proof of the new check finding a real defect: first `version:check` run
  after wiring reported `- ARCHITECTURE.md: 0.0.26 (expected 0.0.33)`.
- Isolation proof: 46 pass / 0 fail in both suite orders; SEC-5 suite alone 2 pass.

## Perfection Loop — continued

### Loop 2 — Independent audit and self-correction

- **AUDIT finding (self-corrected):** the first version of the drift check
  reported `ARCHITECTURE.md` but the writer still could not *heal* it, because
  the writer only replaced `oldVersion`. Diagnosed as the real root cause of the
  whole class (not just this instance) and fixed by converging from the stated
  version, with a pin that bumps a surface seven releases stale.
- **AUDIT finding (self-corrected):** the added fixture pushed
  `scripts/bump-version.test.ts` to 304 lines against the absolute 300 ceiling
  (quality gate). The standalone drift test was folded into the existing synced
  test body (298 lines) rather than trimming the coverage.
- **AUDIT finding (self-corrected):** the first containment attempt
  (`afterAll(mock.restore())`) was reported as a fix on the strength of the
  forward-order run; re-testing the **reverse** order disproved it. The
  mechanism was then measured properly (bisect + both orders + both hook
  placements) before the input-scoped stub was written.

### Loop 3 — Final convergence

- All declared gates re-run live after the final edit; receipt stamped from that
  run. No oscillation: every iteration reduced a measured defect and each fix
  carries a pin.

## Resolution

- **Closed Date:** 2026-09-19 20:05 UTC (closed with the commit SHA pending
  operator git execution, G2 withheld; file:line + grep evidence recorded
  instead, per the FID Lifecycle rule for `closed`)
- **Fix Description:** The automation ladder is documented and single-sourced
  across the surfaces that carry it; documented version surfaces are now a
  checked contract whose first run found and healed a seven-release-stale file
  the writer could never have advanced; the root `test` gate is green across
  12/12 workspaces after containing a process-wide test stub by input scope; and
  the repo-wide `format` gate is green for the first time since the six
  violating files landed.
- **Tests Added:** Yes — 5 pins for the documented version-surface contract, the
  bump-version fixture extended with those surfaces (and its synced-state
  assertion extended to prove a drifted doc surface reaches
  `collectVersionDrift`), and the SEC-5 suite re-scoped so its own failure is
  still induced while every other caller signs normally.
- **Verification Evidence:** receipt below (nine gates, live); `bun run test`
  exit 0 / 0 fail across 12 workspaces; `version:check` FAIL → PASS on the real
  `ARCHITECTURE.md` drift the new check found.
- **Archived:** 2026-09-19 20:05 UTC — moved to `dev/fids/archive/`; receipt
  re-stamped live at the archived path (9/9 gates)

## Lessons Learned

- **A "silent skip" is a defect class, not a convenience.** `if (!includes(x)) return`
  in a writer turned seven missed updates into invisible rot. When a writer may
  skip, the checker must report the miss — the desktop family already did this
  ("reported as missing, never skipped"); the doc surfaces now do too.
- **Bun's `mock.module` is process-wide and not reliably undoable.** A stub that
  throws unconditionally is a landmine for any suite that shares the module.
  Scope test doubles by **input**, not by time window, and prove containment
  with the suites running in **both** orders.
- **Verify a fix in the order you did not test.** The `afterAll` fix looked
  correct because it was only checked in one argument order; the reverse order
  disproved it immediately.
- **An undocumented number is not a policy.** `autonomy_level: 3` had been in
  config with a gloss while the governance documents never defined what level 3
  authorizes or what it cannot lift.
