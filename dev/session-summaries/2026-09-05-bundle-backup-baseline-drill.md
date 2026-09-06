# 2026-09-05 — Bundle-backup first baseline + restore drill (FID-2026-0905-008)

Single-agent ECHO session: first live run of the G5 durability layer
(`scripts/git-bundle-backup.ts`), discharging the FID-2026-0905-008
honest boundary (the "first real `--baseline` run" note). The script had
7/0 scratch-repo tests at closure; this session added the operator-
directed live evidence.

## What shipped

- **Baseline bundle:** `C:/Users/spenc/OneDrive/savant-backups/baseline.bundle`
  (37 MB, `git bundle create --all`), created from HEAD
  `dee19226c4a7` — the tip of the 0905 quality-campaign closeout push.
- **Verify-or-no-advance held:** `git bundle verify` exited 0 before the
  `last-backup` tag moved; the marker now points at `dee19226c4a7`.
- **Restore drill (independent):** `git clone` from the bundle into a
  scratch directory reproduced HEAD `dee1922` and the exact tip subject
  ("style: apply prettier formatting across test and provider files"),
  then the scratch clone was cleaned up.
- **Idempotent incremental:** an immediate rerun returned
  "no new commits since dee19226c4a7; nothing to back up" (exit 0),
  confirming the marker==HEAD no-op path on the real repo.

## Pre-flight log (all tool-verified)

- `git rev-parse --is-shallow-repository` → `false` (full history
  available; bundles cannot be created from shallow clones).
- `git rev-parse --verify last-backup` → fatal (no prior marker — a
  true first baseline, not a re-baseline).
- OneDrive root present at `C:/Users/spenc/OneDrive`; pack size 43.39
  MiB at run time.

## Campaign context

This run followed the 2026-09-05 closeout of the 4-day quality campaign:
16 commits pushed (`2cc377e0..dee19226`), all five residue monoliths
decomposed, six FIDs closed + archived with G2 hashes stamped,
`quality:report` at 0 violations, and the G1/G6 amendment recorded
(agents permitted local commits + push; releases via the pipeline
only). Full record: `dev/fids/archive/README.md` (2026-09-05 closure
entries) and `CHANGELOG.md` `## Unreleased`.

## Operational notes

- Routine backups: `bun scripts/git-bundle-backup.ts` (incremental over
  `last-backup..main`); destination override via `SAVANT_BUNDLE_DIR`.
- Scope boundary: the bundle captures git history only — untracked /
  working-tree-only files (e.g. `.env.local`) are not included.
- The next `--baseline` is warranted after large history changes
  (rebases or history rewrites); incrementals otherwise keep the chain
  current from any commit.
