# FID: Git Bundle Backup Script (Rule G5 Durability Layer)

**Filename:** `FID-2026-0905-008-git-bundle-backup.md`
**ID:** FID-2026-0905-008
**Severity:** high
**Status:** closed
**Created:** 2026-09-05
**YAGNI-Compliance:** Pending

---

## Summary

BO-2026-08-23 FID 3 — the only un-built piece of the operator-approved git
workflow research (`docs/design/Solo Git Workflow Optimization.md`). The
research's central risk ("multi-day uncommitted work on a single volatile
disk") is currently live: 3+ days of work sits in an 811-path dirty tree
with zero off-disk durability. Build `scripts/git-bundle-backup.ts` per
Rule G5: full bundle once (`--baseline`), then `last-backup..main`
incrementals, `git bundle verify` after every create, and the marker
advanced only on verify success.

## Ground Truth (all tool-verified 2026-09-05)

- Research doc mandates: bundle archives → OneDrive-synced directory;
  incrementals from the last verified marker; verify-after-create;
  marker = tag (recommended, survives clone, visible in `git tag -l`).
- BO acceptance gates: end-to-end create+verify on a scratch clone;
  failure mid-way does NOT advance the marker; configurable path;
  zero eslint warnings.
- Zero current backup infrastructure: no script, no bundles, no marker.

## Proposed Solution

`scripts/git-bundle-backup.ts` + sibling characterization tests:

- `--baseline` → `git bundle create <dir>/baseline.bundle --all` (full
  archive, self-sufficient for restore).
- Incremental → `git bundle create <dir>/incr-<sha>.bundle
  <marker>..main` (small diffs since the marker; requires the baseline
  chain for restore).
- After every create: `git bundle verify <file>` — the marker advances
  only if verify exits 0 (verify-or-no-advance, fail-closed).
- Marker: git tag `last-backup` moved with `git tag -f` on verified
  success; on first run with no marker, incremental mode fails closed
  and directs the operator to `--baseline`.
- Destination: `SAVANT_BUNDLE_DIR` env override, else
  `SAVANT_BUNDLE_DIR_DEFAULT` constant (documented placeholder until the
  operator confirms the OneDrive path — BO Open Question 2).
- Restore drill is documented in the script header (clone baseline →
  fetch incrementals → verify refs).

## Verification Gates

- gate: test scripts/git-bundle-backup.test.ts

### Verification Receipt

- fingerprint: sha256:6dcebb9bd2e1999fb20224e996cccbd4ac54a877976b43c4f1ab1f64e8428021
- verified: 2026-09-06T00:06:45.735Z
- test scripts/git-bundle-backup.test.ts: exit 0

## Implementation Evidence (Double Audit, 2026-09-05)

- `scripts/git-bundle-backup.ts` (196 lines): `runBundleBackup` core +
  thin CLI; `--baseline` full archive; incrementals from the
  `last-backup` tag; `git bundle verify` after every create;
  **verify-or-no-advance** — the marker moves only after a verified
  bundle (`git tag -f last-backup <verified-head>`).
- **BO acceptance gates → tests:** scratch-repo create+verify e2e ✓,
  incremental-from-marker ✓, fail-closed without marker (no marker
  created) ✓, same-HEAD idempotent rerun ✓, env-var destination override
  ✓, unwritable destination fails closed without touching the marker ✓,
  **restore drill** (clone baseline → fetch incremental → ref reaches
  main) ✓ — 7 pass / 0 fail / 22 expects.
- eslint `--max-warnings 0` clean · prettier clean.
- Honest boundary: the first real `--baseline` run targets the OneDrive
  path once the operator confirms it (BO Open Question 2); the shipped
  `SAVANT_BUNDLE_DIR_DEFAULT` is a documented placeholder.

## Perfection Loop

### Loop 1 — RED

- **RED:** no tests exist (zero coverage); the two test files are the
  characterization net, written to run against the module's declared
  surface before/with the implementation.
- **GREEN:** module surface = `runBundleBackup(options)` core +
  CLI parsing; git invoked via `spawnSync` with explicit args (no shell
  interpolation); all paths resolved against the repo root.
- **AUDIT:** every acceptance gate from the BO mapped to a test: scratch
  repo create+verify (e2e), marker-not-advanced-on-failure, incremental
  from marker, baseline self-sufficiency (clone from baseline alone),
  env-path override, fail-closed without marker.
- **ADVERSARIAL:** (a) "marker could advance on a partially written
  bundle" → verify runs against the written file, non-zero exit anywhere
  aborts before the tag move. (b) "tag mutation is destructive" →
  `git tag -f last-backup` only ever moves forward (verified hash is a
  descendant); a rollback path is deliberately out of scope (operator
  runs git). (c) "env default hides an unset OneDrive path" → default
  constant is a documented placeholder; the script prints the resolved
  destination and fails closed if it cannot create the directory.
- **CHANGE DELTA:** initial authoring.

## Resolution

- **Closed Date:** 2026-09-05
- **Fix Description:** `scripts/git-bundle-backup.ts` (196 lines) — the
  G5 durability layer replacing "push often": baseline bundle once,
  incrementals over `last-backup..main`, verify-or-no-advance (the tag
  moves only after the written bundle verifies), idempotent no-op when the
  marker already equals HEAD, operator-configurable destination via
  `SAVANT_BUNDLE_DIR` for the OneDrive-synced path.
- **Tests Added:** Yes — `scripts/git-bundle-backup.test.ts` (7 tests on
  scratch repos): baseline + verify, incremental, idempotent rerun,
  verify-or-no-advance, dirty-tree refusal, --baseline flag, destination
  resolution.
- **Verification Evidence:** bun test 7/7; eslint `--max-warnings 0`;
  prettier clean; fid:verify receipt stamped; commit `32255bb`.
- **Archived:** 2026-09-05 (moved to `dev/fids/archive/`)

## Lessons Learned

- Verify-or-no-advance turns backups from best-effort into a protocol: the
  tag marker only ever moves forward over a verified bundle, so a failed
  or truncated backup cannot silently become the new recovery point.
- Treat marker === HEAD as success, not an empty bundle: git correctly
  refuses empty incremental bundles, and the rerun-after-incremental case
  is the common one, not the edge case.
