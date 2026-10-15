# Approved resume decisions — 2026-10-15

## Initial state

The saved session ended with two unanswered requests for clarification.
The working tree contains earlier command-cancellation changes and unrelated work.
This session preserves those edits and stages explicit paths only.

## Approved scope and intent

The operator answered "yes" to all five recommended decisions:

1. The selected provider owns transport; a model name cannot switch endpoints or credentials.
2. Format the two existing SDK process-test files without changing their behavior.
3. Preserve raw session exports in a dedicated ignored directory.
4. Session-end and interactive skill notices each use independent acknowledgement cursors.
5. Preserve task numbers with a permanent issued-ID ledger.

Implementation is tracked in FID-2026-1015-001. No push or release is authorized.
The protocol, workspace gates, and existing credential boundary remain binding.

## Validation

- Full root typecheck: exit 0, including the scripts tree.
- SDK: 701 pass, 1 Windows/POSIX platform skip, 0 fail (702 tests).
- Delivery, review, and ledger suites: 23 pass, 0 fail.
- Initial common routing and lifecycle suites: 12 pass; the added model-replacement
  regression also passes through the declared gate.
- All nine initial declared FID gates: PASS, exit 0.
- Full ESLint, Markdown lint, Prettier, quality and scope-register checks: exit 0.
- Recurrence census after ownership registration: 591 records, 59 classes, zero issues.
- SDK ESM, CJS and declarations build succeeds. Aggregate `bun run ci` exits 1
  at the existing Savant-Free build, whose removal remains operator-owned under `T122`.
- Full CLI rerun: 4,172 pass, 18 skip, 0 fail. Common: 907 pass, 4 skip,
  0 fail. Agents: 158 pass, 0 fail. Evals: 229 pass, 0 fail.
- The runtime run found one stale producer-refusal fixture (2,161 pass, one fail).
  Its metadata is aligned to the existing producer contract; focused coverage is
  20 pass, 0 fail. The full sequential runtime rerun passes all 2,162 tests.
- All thirteen configured workspace suites now pass independently: 9,120 passed,
  23 skipped, zero failures. The initial aggregate root command failed before the
  stale fixture corrections; no zero exit is claimed for that initial invocation.
- All fourteen final declared FID gates pass, and the verified receipt is stamped.
- Final `bun run validate:repository`: `validation: PASS`, exit 0, after receipt
  stamping and scratch-log relocation. Final full ESLint, Markdown lint and
  Prettier checks also exit 0. No code changes followed those checks.

| Workspace | Pass | Skip | Fail |
| --- | ---: | ---: | ---: |
| SDK | 701 | 1 | 0 |
| CLI | 4172 | 18 | 0 |
| Common | 907 | 4 | 0 |
| Agents | 158 | 0 | 0 |
| Evals | 229 | 0 | 0 |
| Agent runtime | 2162 | 0 | 0 |
| Design systems | 19 | 0 | 0 |
| Code map | 55 | 0 | 0 |
| Database | 53 | 0 | 0 |
| Knowledge graph | 76 | 0 | 0 |
| LLM providers | 92 | 0 | 0 |
| Connectors | 23 | 0 | 0 |
| Desktop | 473 | 0 | 0 |

## Audit corrections

The routing decision also applies to catalog identity for request budgeting and to
custom endpoints whose model IDs contain registered provider names. Five older
test setups now supply their custom endpoint's own fake key. Deliberate model
replacement continues to capture its explicit provider independently of ambient state.

The Windows process-tree test failed under concurrent validation load, then passed
alone and during the clean full SDK rerun. No production cleanup behavior was changed.

A pre-existing capture at `2026-10-15T04:00:33.051Z` introduced the unowned
`v1:read_files:read-incomplete:undetermined` class. It is registered to the active
taxonomy/horizon lane; neither the immutable row nor its unresolved repair state changed.

## Preserved exports

Moved to ignored `dev/exports/session-archives/` with identical SHA-256 before/after:

- `session-ses_ec28.md`: `AC3706B97F60A0D71CE909C555667A9405E2C8E66794506942A207D725F17E7E`
- `codex-session-01a13272-f12c-75b1-bf58-f2ac7c09e948.md`:
  `F1831B853E78A5D9E2F88A8E6235CEB10D59557FE2B3A9F16992BAC7A6A3CFB4`
- `codex-session-01a13561-8982-75b1-9bfc-e5a1ca47380e.md`:
  `4D7007182D92FD54F0F11C2515100111535DFFBA0C021FCF267D98F5B929A5D2`

The two exports named by the old review were already absent; no missing input was fabricated.
The two SDK process-test files retain their earlier behavioral edits unstaged; this
session's changes to them only restore formatting.

Running broad checks concurrently exhausted five-second Git-fixture budgets in
the runtime suite. The final sequential rerun passed without changing their
budgets or production code. Heavy checks should run sequentially on this host.

## Durable records

Completed holds were removed from the active register, with evidence retained here
and in FID-2026-1015-001. The task-ID ledger reserves 1 through 190; new tasks start
above that reservation and the maximum permanent allocation. No live task was renumbered.

A narrow Law 1 exception for the one-megabyte changelog was presented to the operator.
Until answered, editing CHANGELOG.md and final FID archival remain blocked on that decision.

Implementation is committed as `83f1712d`. Its staging deliberately excluded the
pre-existing Q26 scope-target extension and all earlier production edits.
Fixture alignment and final receipt evidence are committed as `ca94b6f1`.
The exact proposed changelog entry is ready at
`dev/scratchpad/active/approved-resume-changelog-entry.md`.

The validator caught temporary logs at the scratchpad root. They were relocated
under `active/`, preserving their bytes. One completed initial-test PowerShell
wrapper retained its log after reporting the CLI failures; it was stopped only
after process inspection confirmed it had no remaining test children.
