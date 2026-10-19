# Graph-refresh repair — FID-2026-1017-011

## Trigger

Operator instruction: "ok so fix it, i need to get this fully built and working
as designed." The subject was FID-2026-1017-008, whose live A–Z acceptance run
on 2026-10-17 returned **DEFECTS FOUND**, with §5.15 failing because the merge's
post-merge graph refresh threw.

## Confirmed state before the repair

- Lane suites 34/34, params suite 1/1, fan-out suites 25/25, real-git lane
  probe PASS, `worktree.ts list` returned an empty lane list.
- FID-2026-1017-008's record was stale: Step 2 said "blocked" although the run
  had executed and merged the lane proof as `3d24daf9`.
- The A–Z instrument was unchanged since `5768aff6` and still encodes four
  divergences its own report documented.

## Root cause (reproduced, not assumed)

`refreshMergedFidGraph` on the live repository threw in two stages:

1. `Graph source could not be read consistently; retry refresh`
   (`update-scan.ts:221`). The 1 MB cap was applied to the UTF-8-decoded
   string. Invalid bytes decode to U+FFFD (three bytes each), so four tracked
   assets under 900 KB on disk expanded past the cap:
   `art/profile-pic.jpg` 854,119 → 1,519,211; `assets/banner.png` 580,724 →
   1,052,640; `assets/logo.png` and
   `desktop/public/floor-assets/emblem/savant-logo.png` 888,939 → 1,610,480.
2. After that repair, `SQLiteError: UNIQUE constraint failed:
   file_extends.file_id, file_extends.parent` (`update.ts:230`). The table is
   keyed by `(file_id, parent)`, but `extractExtendsRelations` returned one row
   per declaration. Six tracked files declare multiple children extending one
   parent, including six `extends JsonRecord` declarations in
   `packages/llm-providers/src/openai-compatible/chat/openai-compatible-api-types.ts`.

## Repair

- `packages/knowledge-graph/src/update-scan.ts` — the cap now governs on-disk
  bytes only; the pre/post stat checks and baseline comparison are unchanged.
- `packages/knowledge-graph/src/extract.ts` — extends relations dedupe by
  parent, matching the persisted key.
- `packages/knowledge-graph/src/__tests__/refresh-safety.test.ts` — a
  600,000-byte invalid-UTF-8 fixture (measured red before the scan fix) and a
  two-declaration extends fixture.

## Verification

- `fid:verify --write`: 7/7 declared gates exit 0 — two workspace typechecks,
  `refresh-safety` (16 pass), `edges-from-tokens` (2 pass),
  `fid-worktree-environment` (3 pass), the real-git lane probe, quality PASS.
- Live reproduction: `REFRESH_OK ms=8894`; querying `.savant/graph.db` returns
  `[{"path":"docs/design/parallel-worktrees-lane-proof.md"}]`.
- `bun run validate:repository` → `validation: PASS`.
- Implementation commit `774eb705`; FID closed and archived, CHANGELOG entry
  added, register grant released.

## Record corrections

FID-2026-1017-008 now records Step 2 as implemented with the run's report path
and merge SHA, the DEFECTS FOUND verdict, the failed row, and both blockers. Its
status stays `converged` deliberately: the lane vehicle and the re-run's
`create` require a converged record, and the record states explicitly that no
acceptance is claimed until a clean re-run.

## Remaining work

1. **BLOCKER-1 (open, unexplained).** Intermittent `unsafe-root` refused 3 of 18
   live lifecycle calls in the original run and could not be reproduced
   out-of-process. No speculative change was made to the guard.
2. **Operator re-run.** `dev/test-prompts/az-parallel-worktrees-live-test.md`
   has not been updated for the four divergences its own report listed, and the
   retained branch `savant/FID-2026-1017-008` (at `3d24daf9`) is now an ancestor
   of `main`, so lane creation refuses `branch-exists` until that branch is
   removed. The re-run must start from a clean tree (the merge gate counts
   untracked files).
