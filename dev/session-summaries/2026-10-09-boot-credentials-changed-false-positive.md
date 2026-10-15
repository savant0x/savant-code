# Session Summary: 2026-10-09 09:52

**Session ID:** 2026-10-09-0952-boot-credentials-changed-false-positive
**Duration:** 09:52 — 10:13 EDT
**Status:** completed

---

## Initial State

### Environment

- **OS:** Windows (win32), Git Bash
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Branch:** main (160 commits ahead of origin/main)
- **Last Commit:** docs(fids): archive sidebar and telemetry with committed evidence

### Known Issues

- Operator report: the first message after every boot fails with "Selected
  provider credentials changed. Reselect the provider before retrying." for the
  selected env-sourced provider `nous`, although the key never changed and is
  valid (the operator was talking to Savant through that very provider).

### Dependencies

- Pre-existing uncommitted FID housekeeping in the working tree (archive moves,
  CHANGELOG/SCOPE updates) — left untouched this session.

---

## Planned Work

1. [x] Diagnose the every-boot false "credentials changed" error
2. [x] Implement the operator-approved fix (Fix A: adopt-if-unobserved)
3. [x] Tests, gates, FID record, independent Verifier, session documentation

---

## Work Completed

### Task 1: Root cause and fix — FID-2026-1009-001

- **Status:** completed (FID `verified`; closure awaits the operator's G2 commit)
- **FIDs Created:** `dev/fids/FID-2026-1009-001-first-message-credentials-changed-false-positive.md`
- **Root cause:** `providerAccountRevision`
  (`common/src/providers/provider-account-revisions.ts`) keeps a
  process-memory `Map` and mints a fresh random UUID on the first observation
  of a provider. The route persisted in `settings.json` carries the UUID minted
  by the saving process, so in any fresh process the first comparison rejects
  unchanged credentials as changed. The only cross-process bridge
  (`credentials.json` `providerAccountRevisions`, written by `persistProviderKey`
  on `/provider` saves) has no entry for env-sourced keys. Measured:
  `~/.savant-code-dev/` settings route `providerId "nous"`,
  `accountRevision "6f2b7391-…"`; credentials revisions cover
  `{xkiro, cleanapis, codecraft, vercel}` — no `nous`.
- **Changes Made:**
  - `common/src/providers/model-route.ts` — `getModelRouteConfig` seeds the
    route's own `accountRevision` when the provider was never observed this
    process (adopt-if-unobserved) before the comparison.
  - `cli/src/utils/provider-key-persistence.ts` — new
    `adoptPersistedSelectionRevision()`: loads the persisted selection and
    seeds its route revision for the selected provider (absent entries only).
  - `cli/src/utils/provider-key-store.ts` — `applyPersistedProviderApiKeys`
    calls it before the direct-mode restoration tail, so monitoring's boot-time
    `captureModelRoute` observes the persisted revision rather than minting a
    different one (file re-verified at 297 lines after the quality ceiling
    catch at 315).
  - `SCOPE.md` — FID-2026-1009-001 open item plus machine-readable write
    targets for the Law 2 gate.
- **Verification:** hermetic probe pre-fix Path 1 FAIL (exact operator error)
  → post-fix 5/5 PASS; common test 5/5, CLI boot-ordering test 1/1;
  typecheck common/cli exit 0; quality:report PASS; eslint, prettier,
  lint:md clean; `fid:verify --write` receipt 6/6 gates exit 0 and
  `fid:verify --check` PASS; independent Verifier PASS.

### Guards preserved (pinned)

- an observed provider still rejects a stale route revision (mid-session
  `/provider` save)
- a `credentials.json` anchor still beats the route's revision
- a rotated credential value still rejects the route after adoption

---

## Issues Discovered

### Issue 1: the fix itself crossed the 300-line quality ceiling — resolved

- **Severity:** low
- **FID:** FID-2026-1009-001
- **Status:** resolved — `provider-key-store.ts` reached 315 lines; the boot
  adoption logic was extracted to `adoptPersistedSelectionRevision()` in
  `provider-key-persistence.ts` (297 lines) and re-verified.

---

## Perfection Loop Summary

| Loop | Target | RED | GREEN | AUDIT | Delta |
|------|--------|-----|-------|-------|-------|
| 1 | provider route account revision | root cause + pre-fix repro | adopt-if-unobserved at both seams | 6/6 gates + Verifier PASS | n/a |

---

## Validation Results

- [x] typecheck common: PASS
- [x] typecheck cli: PASS
- [x] test common/src/providers/__tests__/model-route-account-adoption.test.ts: PASS (5/5)
- [x] test cli/src/utils/__tests__/provider-key-store-account-adoption.test.ts: PASS (1/1)
- [x] probe dev/scratchpad/active/fid-1009-001-first-message-probe.ts: PASS (5/5)
- [x] quality:report: PASS
- [x] eslint --max-warnings 0: PASS
- [x] prettier --check (changed files): PASS
- [x] lint:md: PASS
- [x] fid:verify --check: PASS

---

## Final State

### Code Changes

- **Files Modified:** 3 (`model-route.ts`, `provider-key-persistence.ts`,
  `provider-key-store.ts`), plus `SCOPE.md`
- **Files Created:** 2 test files, the FID, the probe (+ two scratchpad scripts)
- **Net Change:** ~+110 code lines, ~+170 FID lines

### Git Status

- **Branch:** main
- **Uncommitted Changes:** yes — this change plus the pre-existing housekeeping
- **New Commits:** none — G2 closure awaits the operator's commit authority

---

## Open Questions

- A key rotated between processes no longer forces reselection for env-sourced
  providers (no persisted anchor exists to detect it); the request uses the
  current credential either way. Accepted, documented in the FID's ADVERSARIAL
  section, flagged here for operator awareness.

---

## Lessons Learned

- A machine-readable register entry is a parsed artifact: one dropped indent
  silently un-covered approved write paths and the Law 2 gate blocked the
  covered files. Rewrite an entry in one wholesale edit.
- FID verification gates inside a code fence are invisible to `fid:verify`
  (the locator strips fenced blocks) — declare gates as plain bullets.

---

## Next Session

### Priority Tasks

1. [ ] Operator commit (G2) → close/archive FID-2026-1009-001 + CHANGELOG entry
2. [ ] Operator live check: first message after a fresh CLI boot

### Blockers

- Commit authority (operator-owned per G1/G2)

### Notes for Next Agent

- The fix's two seams: `getModelRouteConfig` (common, adopt-if-unobserved) and
  `applyPersistedProviderApiKeys` → `adoptPersistedSelectionRevision`
  (CLI boot). Both reuse the single `seedProviderAccountRevision` primitive.
- This FID's scratchpad scripts live at
  `dev/scratchpad/active/fid-1009-001-*.ts` (probe, register repair, edit
  completion, record finalization).