# Expectedness gets a producer — FID-2026-1012-024 Loop 12 (2026-10-14)

## Intake and authority

Protocol `dev/echo-v0.1.2-single-agent.md` read 0-EOF, the 2026-10-14 handoff read, and
`SCOPE.md` / `protocol.config.yaml` read as authority. Single-agent operation, session
ceiling `autonomy_level: 3`, `strict_mode: true`.

The handoff's intake instruction — reconcile the live census with the master before making
claims — was completed first:

```text
$ bun run experiences:recurrence
recurrence probe: 589 records, 58 stable classes, 0 issues
$ cat dev/experiences/fix-boundaries.json
{ "version": 1, "boundaries": [] }
```

That matches the master's recorded board (589 / 58 / zero issues / zero observed) and the
68-class figure stays historical planning data, as the master states. The handoff's own
closing obligations were verified rather than assumed: HEAD `c4caff6b` is the handoff commit,
`last-backup` equals HEAD, and `git rev-list last-backup..main --count` is 0.

The operator selected the **failure-class lanes** (`-017`–`-020`, `-023`, `-024`).

## The defect this pass fixed

`FID-2026-1012-024` Loop 11 recorded the blocker in its own adversarial: *"`expectedness` is
assigned by nothing, so a legitimate outcome (a guard refusal that steers the agent) still
cannot be told from a defect — that remains open, and it is why no boundary was declared
here."* Measured at `c4caff6b`, the channel was inert end to end:

- `experienceClassIdentity` could derive only `unexpected` or `undetermined`; nothing could
  derive `expected`.
- The only carrier, `HookInputData.expectedness`, is forwarded by `buildHookInput` and stored
  by `buildExperienceRecord`, and **no production call site passed it**.
- All three consumers that exist to honour it were therefore unreachable
  (`experiences-dedup` `isExpectedFailure`, `experiences-coverage`,
  `experiences-learning-order`). `experiences-coverage.ts` documented the intent — an expected
  outcome "is correct behaviour, not a defect, so it never demands an owner" — on a branch that
  could never be taken.
- Second half: expectedness is part of the class identity, so the first producer to classify an
  outcome expected would re-key its rows to a key no owner names while `recurrenceReport`
  demanded an owner for **every** class — the census would go red for a correct outcome, the
  same failure mode Loop 5 measured when a taxonomy change made `validate:repository` fail.

## What changed

Expectedness is assigned where the harness itself makes the decision — the readonly guard's
anchored refusal channel Loop 5 already made the renderer partition on — with no message
heuristic and no field a tool's own output could set:

- `tool-result-inspection.ts`: `ToolOutputInspection` carries an optional `expectedness`;
  `scalarFailure` returns the failing line *and* the classification its own branch establishes
  (refusal → `expected`, every other branch → none).
- `tool-result-errors.ts` → `result-lifecycle.ts`: the classification travels beside
  `commandExecution`, so the stored row carries what the consumers read.
- `common/src/util/experience-classes.ts`: one shared home for the rule (`isExpectedClass`),
  its rendering (`classCensusLine`, byte-identical output, `EXPECTED` instead of `UNOWNED`) and
  the ownership issue (`pushUnownedClassIssue`), used by the census, the coverage gate and the
  dedup predicate.
- `lifecycle-fixture.ts`: the result-lifecycle test fixture moved out of its suite, which the
  300-line absolute ceiling left no room in.

**Rejected deliberately:** a general message heuristic (`not found` → expected) — the dedup
layer states that "error words cannot establish expectedness"; and reading an `expectedness`
field from any result envelope — a tool's own output could then mark itself expected and hide
its defect.

## Verification

| Gate | Result |
| --- | --- |
| `packages/agent-runtime` suite | 2,152 PASS / 0 FAIL (329 files) |
| `scripts` suite | 976 PASS / 0 FAIL (120 files) |
| common class-identity suite | 14 PASS / 0 FAIL |
| `bun run fid:verify <FID-024> --write` | 15/15 declared gates PASS, receipt stamped |
| `bun run validate:repository` | `validation: PASS`, exit 0 |
| `bun run quality:report` | PASS (1,502 baselined files) |
| `bunx eslint . --max-warnings 0` | exit 0 |
| `bun run lint:md` | exit 0 |
| typecheck common / agent-runtime / scripts | exit 0 |
| `bun run experiences:recurrence` | 589 records / 58 classes / 0 issues — unchanged |

New pins: a refusal envelope classifies `expected` with the refusal as its line; a real exit
whose stderr merely quotes the phrase still renders `Command exited with code 1: …` and stays
unclassified; no corpus shape gains a classification by default; the refusal driven through
the **real** lifecycle and a real hook engine stores
`v1:run_readonly_command:refused:expected`, while a genuine host exit keeps
`v1:run_readonly_command:command-exit:undetermined`; the census reports no issue for an expected
class with no owner and still reports `unowned class: …` for the undetermined fixture.

One failure was reproduced and fixed rather than assumed: the extracted fixture wrote a
double-escaped `\n`, so the temp hook config never parsed and three capture tests failed on a
missing ledger file. The escape was corrected to match the original bytes and the suite
returned to green.

Implementation commit: `bfd8d61d` (13 explicit paths; the pre-existing idea-shelf, wiki and
SDK process-fixture edits were left untouched and unstaged).

## Honest limits

- **Only the harness's own refusal is classified expected.** Which *other* outcomes are correct
  behaviour — a 404 for a URL that does not exist, a pre-start cancellation — is a
  classification with real census impact and is **presented, not assumed**: `-018` owns the
  read_url taxonomy and `-023` owns timeout/cancellation semantics.
- **No class was closed, no boundary declared, no observation claimed.** `fix-boundaries.json`
  is still empty, the census is unmoved, and the classification is live but not yet exercised —
  no refusal row exists in the ledger. `--assert-repaired=FID-2026-1012-024` still exits 1 by
  design.
- No live TUI or WebView smoke was performed. Nothing was pushed, released or re-credentialed.
- Root-wide unit chain was not rerun in full; the two workspaces this change touches were run
  in full, and `fid:verify` live-ran all 15 declared gates.

## Tracking

`FID-2026-1012-024` remains `converged` with a fresh 15-gate receipt; the master
`FID-2026-1012-022` status board row now records Loop 12. Logs:
`dev/scratchpad/active/2026-10-14-loop12-{validate,eslint}.log` (scratch, gitignored).
