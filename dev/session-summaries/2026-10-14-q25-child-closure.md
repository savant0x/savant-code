# Q25 child-lane closure continuation

## Intent

Continue the approved Q25 archival pass without weakening the recurrence gate.
FID-2026-1012-017 remains active because its four measured post-fix classes are
explicitly ineligible for archival under FID-2026-1012-021 Loop 15. The eligible
child lanes are FID-2026-1012-018, FID-2026-1012-019, and FID-2026-1012-020.

## Present-before-act

The live recurrence probe reports 589 records, 58 stable classes, and 0 issues
while the three eligible owners remain active. Rechecking their named waiver
classes against `fixCutoff` found no post-cutoff rows for any of the three
lanes. FID-018 already contains its Q25 closure record; FID-019 and FID-020
need implementation-evidence and closure-record additions before their status
flips.

## Changes made

1. Added ground-truth implementation evidence to FID-019 and FID-020 and
   re-stamped their declared receipts before closure.
2. Marked FID-018, FID-019, and FID-020 closed under Q25 and moved them to
   `dev/fids/archive/`.
3. Removed their active register lines and write targets, updated both FID
   indexes, the master status board, and `CHANGELOG.md`.

## Verification evidence

- `bun run fid:verify` — 10/10 gates PASS for
  `dev/fids/FID-2026-1012-019-silent-capability-degradation.md`.
- `bun run fid:verify` — 11/11 gates PASS for
  `dev/fids/FID-2026-1012-020-edit-path-friction.md`.
- `bun run fid:verify` — 11/11 gates PASS for
  `dev/fids/FID-2026-1012-017-incomplete-tool-call-arguments-root-cause.md`;
  FID-017 remains active.
- `bun run fid:verify --check` — PASS for all active `fixed`/`verified` FIDs;
  informational notices only for statuses outside the live receipt contract.
- `bun scripts/experiences-recurrence.ts` — 589 records, 58 stable classes,
  0 issues; all three closed lanes remain `unresolved` and the four FID-017
  post-fix classes remain visible.
- `bun scripts/validate-repository.ts` — PASS after staging the intended archive moves and the deleted uncalled test.
- `bun run typecheck` — all 14 configured typecheck legs PASS.
- `bun run test` — all 13 workspace legs PASS; SDK 767 pass / 1 skip, CLI
  4167 pass / 18 skip, agent-runtime 2158 pass, and 0 failures overall.
- `bun test scripts/__tests__/experiences-closure-waiver.test.ts` — 8 pass,
  0 fail.
- `bun run lint:md` — PASS.
- `git diff --cached --check` — PASS.

## Current state

The approved Q25 closure work is committed locally in `d9a921f9`. FID-017,
FID-021, and FID-022 remain active. No production repair boundary, recurrence
cessation, qualified production observation, push, or release is claimed.
Unrelated dirty paths remain unstaged.

## Boundary

The Q25 waiver preserves the recurrence probe and does not claim repair,
recurrence cessation, or qualified production observation. FID-017 stays in
the active register until its four post-fix classes are resolved or a later
operator ruling changes the closure condition.
