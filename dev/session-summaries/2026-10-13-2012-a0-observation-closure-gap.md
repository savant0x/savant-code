# A0 continuation — the observation path cannot close (2026-10-13)

Program: `FID-2026-1012-022`; owner of every finding below: `FID-2026-1012-024` (converged,
instrument implemented, class repairs and production observation open). Session ceiling:
`protocol.config.yaml` → `session.autonomy_level` = 3. Protocol: `dev/echo-v0.1.2-single-agent.md`
read 0-EOF at session start.

## Verified state at session start

Boot order followed: protocol 0-EOF → `protocol.config.yaml` → `coding-standards/typescript.md` →
`docs/embedded-learnings.md` → `dev/agenda.md` → `SCOPE.md` → the handoff →
`FID-2026-1012-022` status board → `FID-2026-1012-024` → `FID-2026-1012-021`. Measurement date:
**2026-10-13**, workspace HEAD `f618e705` (handoff committed; nothing pushed).

```text
$ git status --porcelain=v1
 M common/src/util/__tests__/experience-classes.test.ts
 M common/src/util/experience-classes.ts
 M dev/experiences/raw-traces.jsonl          # +3 live rows (uncommitted)
 M dev/fids/FID-2026-1012-021-...md          # held count-reporting
 M dev/fids/FID-2026-1012-022-...md          # held status-board note
 M dev/fids/FID-2026-1012-024-...md          # held Loop 7 timing interpretation
 M dev/idea-shelf/*, dev/wiki/index.md, scripts/__tests__/experiences-class-horizon.test.ts,
 M scripts/experiences-recurrence.ts
 ?? (idea-shelf, wiki/patterns, 026 provider-parity, docs/trash, profile image, old handoff)

$ bun scripts/experiences-recurrence.ts
recurrence probe: 589 records, 58 stable classes, 0 issues

$ bun scripts/experiences-recurrence.ts --assert-repaired=FID-2026-1012-024
recurrence probe: 589 records, 58 stable classes, 9 issues     # exit 1, the honest result
repair is unproved: v1:str_replace:cause-not-recorded:undetermined (unresolved)
repair is unproved: v1:read_url:cause-not-recorded:undetermined (unresolved)
repair is unproved: v1:code_search:cause-not-recorded:undetermined (unresolved)
repair is unproved: v1:run_readonly_command:command-exit:undetermined (unresolved)
repair is unproved: v1:run_readonly_command:cause-not-recorded:undetermined (unresolved)
repair is unproved: v1:skill_manage:cause-not-recorded:undetermined (unresolved)
repair is unproved: v1:run_readonly_command:refused:undetermined (unresolved)
repair is unproved: v1:run_terminal_command:cause-not-recorded:undetermined (unresolved)
repair is unproved: v1:write_file:cause-not-recorded:undetermined (unresolved)

$ cat dev/experiences/fix-boundaries.json
{ "version": 1, "boundaries": [] }
```

No `dev/experiences/exposure/` directory exists — the sink has never written a receipt. The
handoff's counts hold; the held `-021` no-commit work is untouched by this pass.

## Finding 1 — the exposure sink's receipts have no consumer (measured)

`packages/agent-runtime/src/hooks/exposure-capture.ts` writes one immutable receipt per
`(class, boundary, session)` to `dev/experiences/exposure/<class>--<digest>.json` — but the
manifest's `exposure` array is the only thing `scripts/experiences-proof.ts` reads, and nothing
writes that array.

```text
$ ls scripts/ | grep -i 'experience|boundar|exposure'
experiences-coverage.ts  experiences-dedup.ts  experiences-learning-order.ts
experiences-probe.ts     experiences-proof.ts  experiences-recurrence.ts
experiences-repair-drafts.ts                     # no reconciliation / stamping script

$ grep -rn "FIX_BOUNDARIES_FILE_NAME|fix-boundaries" --include=*.ts scripts/ packages/agent-runtime/src common/src | grep -v __tests__
scripts/experiences-learning-order.ts:85   readFileSync(... fix-boundaries.json)
scripts/experiences-recurrence.ts:210      readFileSync(... fix-boundaries.json)
packages/agent-runtime/src/hooks/exposure-capture.ts:42,84,29   (declaration + read)

$ grep -rn "EXPOSURE_DIR_NAME|experiences/exposure" --include=*.ts scripts/ packages/... common/src | grep -v __tests__
packages/agent-runtime/src/hooks/exposure-capture.ts:41 (declaration)
packages/agent-runtime/src/hooks/exposure-capture.ts:155 (the writer's path)
```

Two readers, zero writers, and no reader of the receipt directory. `evaluateClassHorizon` counts
`exercisedSessions` only from `boundary.exposure`, so a receipt on disk cannot ever raise it. The
observation this program is built on is produced and then dropped.

## Finding 2 — declaring the first boundary reds the repository gate (measured in code)

`recurrenceReport` pushes `unsupported repair: <key> (<state>)` for **every** declared boundary
whose horizon is not `observed`, and the CLI sets `process.exitCode = issues.length ? 1 : 0`. The
window is `OBSERVATION_DAYS = 14` **elapsed since `fixedAt`** plus `OBSERVATION_SESSIONS = 3`
exercised sessions. So a boundary declared now is `incomplete-observation` for at least 14 days,
during which `scripts/experiences-recurrence.ts` exits 1 — and `FID-2026-1012-021` declares
`- gate: probe scripts/experiences-recurrence.ts`, so `validate:repository` fails for the whole
window. The instrument has no honest representation of "fix landed, observation in progress":
`incomplete-observation` is the expected transient state and is also a gate failure. That is
self-blocking, and it is why the manifest has never held a boundary.

## Finding 3 — real post-fix production exposure exists for the refusal split (measured)

The two newest ledger rows (session `8da7b3a3`, uncommitted) are the first rows ever captured for
`v1:run_readonly_command:refused:undetermined`, and they postdate the change that created the
class:

```text
$ git log --format='%h %cI %s' -S 'REFUSAL_SIGNATURE' -- packages/agent-runtime/src/tools/tool-executor/tool-result-inspection.ts
69a61f08 2026-10-13T13:39:33-04:00 fix(experiences): split guard refusals and produce real exposure receipts (FID-2026-1012-024, FID-2026-1012-017)

$ # new rows (UTC)
2026-10-13T19:28:52.526Z run_readonly_command ... classKey v1:run_readonly_command:refused:undetermined
2026-10-13T19:29:17.552Z Command exited with code 128: fatal: Needed a single revision  command-exit
2026-10-13T19:30:39.396Z run_readonly_command ... classKey v1:run_readonly_command:refused:undetermined

$ grep -c 'Command exited with code [0-9]*: run_readonly_command rejected' dev/experiences/raw-traces.jsonl
2                     # both dated 2026-10-13T03:14:28Z — pre-change, stored identity preserved
```

Post-`69a61f08`, a guard refusal rendered as its own class twice in a live session and **no** row
re-rendered the old mis-classification. Loop 5's ADVERSE prediction ("`refused` has rows? Not yet")
is answered: it has two, and they are genuine production exposure — not a receipt, because no
boundary was declared and the sink's fast path returns before writing anything.

## Finding 4 — `expectedness` is declared and assigned by nothing (measured)

Every row in the ledger carries `"expectedness":"undetermined"`, including both refusal rows. The
schema, the class key (`v1:<tool>:<cause>:<expectedness>`) and the -024 Expected Behavior all
require the expected/unexpected separation ("preserving unknowns and legitimate outcomes without
hiding repeated defects"), but no producer sets it, so the class set cannot distinguish a
legitimate outcome from a defect. A guard refusal that steers the agent to
`run_terminal_command` is the guard working, yet it is recorded as an unresolved class that
`--assert-repaired` must report as unproved forever.

## Plan (pre-implementation — nothing implemented in this pass)

Owner: `FID-2026-1012-024` (Steps 2/5 of its Proposed Solution own the horizon, the census
distinction and contextual expectedness). Intended change, smallest first:

1. **Consume the receipts that exist.** Read exposure as a *derived* set discovered under
   `dev/experiences/exposure/`, filtered by `classKey` + `boundaryCommit` + `boundaryFixedAt` and
   validated by the existing receipt schema, ancestry and chronology rules; keep the receipts
   immutable and keep every existing validation. This removes the hand-maintained array that no
   code produces and leaves one source of truth (Law 11/13).
2. **Make in-progress honest.** Keep a census issue for `recurred` and for invalid/missing
   evidence, and report `incomplete-observation` as state (still visible in output) rather than a
   gate failure while inside the window; a boundary past the window with insufficient exposure
   stays an issue. `closedOwnerIssues` and `--assert-repaired` keep refusing closure, so the gate
   retains its teeth where a claim is actually made.
3. **Assign expectedness** from the producer/producer-shaped classification that already exists
   (guard refusal → expected), without rewriting any historical row — additive, exactly as Loop 5's
   ADDITIVE rule requires for stored identities.

Findings 1–4 are within `FID-2026-1012-024`'s converged scope and its registered write surface
(`common/src/util/experience-*.ts`, `scripts/experiences*.ts`, `dev/experiences/**`). No new FID is
warranted, and no historical row, boundary, exposure or receipt is to be synthesized.

## Holds and conflicts (presented, not crossed)

- **The `-021` no-commit hold now blocks committing this fix.** Findings 1/2/4 land in
  `scripts/experiences-recurrence.ts` and `common/src/util/experience-classes.ts`, and both files
  already carry the held `-021` count-reporting hunks in the working tree. `git commit <path>`
  stages a whole file, so the fix cannot be committed without the held work unless the hold is
  lifted or the fix waits. Presented for an operator ruling; the held hunks were not touched.
- `FID-2026-1012-024`'s working-tree receipt is stamped against the current bytes; editing that
  record invalidates its 13-gate receipt, so the RED entry belongs in the next implementation pass
  alongside the re-stamp.
- Chain C holds are unchanged: the `0.0.36` cut, T122, T186 until T122, T171's ruling, T175's six
  inputs, T62 credits, T187's `/skills trust` grant, and Cloudflare's missing account ID and API
  token. No push or release was performed and none is proposed.

## Next actions

1. Operator ruling on the direction (derived receipts vs. a manifest reconciliation writer) and on
   the `-021` hold conflict above.
2. Then the `-024` loop that is both the presentation and the RED/GREEN record: reproduce the three
   gaps with real temp-git controls before implementation, implement, re-run the 13 declared gates
   plus the runtime/scripts suites, and re-stamp the receipt in the same pass.
3. Resume A0 with the boundary declaration the reproduced controls will justify, so the refusal
   split's already-observed exposure (Finding 3) can be recorded as a real receipt instead of being
   discarded.
