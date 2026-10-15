# Cross-copy cancellation identity and the traversal-budget regression — 2026-10-15 0527 UTC

## Authority and starting state

Resumed from `dev/session-summaries/2026-10-15-0506-active-fid-continuation.md` under single-agent ECHO
v0.1.2 (strict mode) at session automation level 3 (`protocol.config.yaml` → `session.autonomy_level`).
No push and no release were performed. All five active records (`FID-2026-1012-017`, `-021`, `-022`,
`-023`, `-024`) were read 0-EOF before any record edit, as were the three files the paused session had
changed and every file edited here.

## 1. FID-024 Loop 15 — the traversal-budget regression measured the wrong quantity

The handoff asked for a stronger budget control: "a getter on an array index beyond the budget should
assert that the index is never read". Implemented in
`packages/agent-runtime/src/tools/tool-executor/tool-result-coverage.test.ts`:

- every index at or beyond the declared 4,096-node budget (4,096 / 4,097 / 5,000 / 9,999) is an
  accessor trap that records a read rather than returning a value;
- traversal is counted in **distinct visited values**, not property reads;
- the whole-envelope control bounds inspected parts against the same declared budget.

The first formulation failed against the shipped walker — `Expected: <= 4096, Received: 8186` — and the
reading is the finding: `scalarFailure` reads a numeric `exitCode` **twice** per value (`typeof` then the
comparison, `tool-result-inspection.ts:177,178`), so a raw read counter reports roughly twice the
traversal and cannot be compared with a node budget. The walker was correct at 4,093 distinct values
(the 4,096 budget less the outer result part, its envelope and the `results` array); the instrument was
wrong. Recorded as Loop 15 — **no source change was required or made**.

Evidence: `tool-result-coverage.test.ts` 22 PASS / 0 FAIL (67 expectations); the
errors/expectedness/lifecycle suites 27 PASS / 0 FAIL (92 expectations);
`bun run --cwd=packages/agent-runtime typecheck` exit 0; `quality:report` PASS (1,502 baselined files).

## 1b. FID-024 Loop 16 — a corpus-wide invariant the pending change had stopped holding

Reviewing the pending program changes before staging them surfaced a real gap rather than a formatting
question: Loop 13 replaced the stderr-text refusal heuristic with producer metadata and deleted the three
Loop 12 tests that pinned expectedness across the corpus (`tool-result-errors.test.ts` −33 lines). Two
were re-expressed in `expectedness.test.ts`; the third — "assigns no classification to any other failure
shape" — only partly, because its replacement asserts one hand-written stderr shape instead of the corpus
that can actually hold the invariant. The suite stayed green while the invariant lapsed.

Restored on producer authority: the corpus loop in `tool-result-coverage.test.ts` now asserts
`inspectToolResultFailure(output).expectedness` equals each fixture's declared classification, with only
the harness-refusal fixture declaring `expected`. The assertion is stronger than the one deleted —
per-fixture and corpus-wide, failing if ANY shape gains a classification. Evidence: 22 PASS / 0 FAIL with
**79 expectations** (12 new, up from 67); `typecheck packages/agent-runtime` exit 0; ESLint, Prettier and
Markdown lint clean; FID-024's declared gates re-stamped.

## 2. FID-023 Loop 7 — cancellation identity did not survive a module-copy boundary

**RED, measured rather than inferred.** Q26's typed user cancellation is an identity comparison against
`USER_CANCELLATION_SIGNAL_REASON = Symbol('savant-user-cancellation')`
(`common/src/util/command-execution.ts:27`), and `Symbol('…')` is minted once per module *instance*.
The CLI runs two instances of that module: `common/package.json` exports resolve to source
(`"bun": "./src/*.ts"`) while `sdk/package.json` publishes only dist (`"import": "./dist/index.mjs"`, no
`bun` condition), and the bundle inlines its own copy (`grep -c` = 1 in `index.mjs` and `index.cjs`),
together with the runtime it imports. Measured pre-fix:

- two copies built from the source: `same copy (A reads A): {"cancellationReason":"user-request"}`,
  `cross copy (B reads A): {}`, `cross copy (A reads B): {}`, `same copy (B reads B):
  {"cancellationReason":"user-request"}`, untyped `{}`;
- the real published boundary: `executionOutcome: cancelled` with `cancellationReason: <absent>` out of
  `sdk/dist/index.mjs`, while the source copy typed the same signal.

Impact is not cosmetic: `resolveToolFailureExpectedness` (`tool-result-errors.ts:65`) requires the typed
reason on **both** the envelope metadata and the signal, so an explicit user stop recorded
`undetermined` — the ambiguity Loop 6 exists to remove, and under FID-024 a class that then demands an
owner for a correct outcome.

**GREEN.** The marker carries a registered brand —
`USER_CANCELLATION_MARKER = Symbol.for('savant-code.user-cancellation')` with
`Object.freeze<UserCancellationReason>({ [MARKER]: true })` — and identity is read from the brand by own
property descriptor instead of symbol equality. `abortForUserCancellation` remains the only mint and the
marker is never exported; the idiom matches the repository's existing cross-copy brand (`PRESET_MARKER`,
`packages/connectors/src/core/presets/preset.ts:9`).

**New declared gate** `sdk/src/__tests__/command-execution-cancellation-identity.test.ts` (registered in
`SCOPE.md` and added to the record's gate list): 3 PASS / 0 FAIL, 13 expectations — both directions
across two copies; an ordinary `abort()` and a reason that merely *claims* `user-request` both stay
untyped in both copies; and the copied terminal runner plus the source runner agree on one `user-request`
outcome. A new file was used because `command-execution-contract.test.ts` is at 260 lines against the
300-line quality ceiling.

**Boundary smoke after rebuilding the SDK at this revision:** the bundles carry the brand key once and
the probe reports `cancellationReason : user-request` where it reported `<absent>`.

**Implementation discovery.** The first brand formulation was
`const … : UserCancellationReason = Object.freeze({ [MARKER]: true })`; `Object.freeze` widens the
literal to `boolean`, so it was rejected (`error TS2322: Type 'boolean' is not assignable to type
'true'`, `command-execution.ts(48,7)`) — and it was the **SDK build's declaration bundling** that found
it, after the focused suites were green. Corrected with the explicit type argument
`Object.freeze<UserCancellationReason>` and re-verified with `typecheck common` and `typecheck sdk` exit 0.

## 3. Reconciliation of the five active records

Every record was re-read against its own acceptance requirements and its implementation. **No record
satisfies closure on this session's evidence, so none was closed and no CHANGELOG entry was added**:

- `FID-2026-1012-017` (`fixed`) — four of its nineteen classes carry post-fix rows, so the recurrence gate
  rejects them; the observation window cannot start while they fire. Remaining work is provider-side
  rejection, which no local ceiling can repair.
- `FID-2026-1012-021` (`verified`) — the machinery (coverage gate, lesson-last ordering, idempotent
  proposed drafting) is implemented; class observation and operator routing keep it open.
- `FID-2026-1012-022` (master, `converged`) — closes only when every child closes.
- `FID-2026-1012-023` (`fixed`) — production observation open; its timeout/abort classes have post-fix
  rows and no repair boundary is declared.
- `FID-2026-1012-024` (`converged`) — instrument complete, zero classes observed, every class
  `unresolved` by design.

Current census at this session's close: **591 records / 59 stable classes / 0 issues, all unresolved**;
`dev/experiences/fix-boundaries.json` remains empty. No production observation was fabricated and no
historical row was rewritten.

## Verification performed

- Focused suites: coverage 22 PASS, errors/expectedness/lifecycle 27 PASS, new identity gate 3 PASS —
  0 FAIL anywhere; `tool-result-inspection.ts` touched by the paused session was re-read 0-EOF and its
  declared gates re-run.
- Typechecks: `common`, `sdk`, `packages/agent-runtime` exit 0.
- `quality:report` PASS (1,502 baselined files); ESLint `--max-warnings 0` and Prettier clean on every
  changed file; SDK build exit 0 with its declaration bundling.
- Declared gate sets re-stamped through `bun run fid:verify --write` for `-023` (16 gates) and `-024`
  (17 gates), after their record text was final; `bun run validate:repository` PASS.
- Markdown lint clean on all changed markdown; ESLint `--max-warnings 0` and Prettier clean on every
  changed source/test file.

## Remaining work

1. **FID-023**: the class lanes still need a production observation window; `fix-boundaries.json` cannot
   be populated until a class stops firing (`bun scripts/experiences-recurrence.ts
   --assert-repaired=FID-2026-1012-023` stays red by design).
2. **FID-024**: the seven `cause-not-recorded` classes stay unresolved; `skill_manage` has zero post-fix
   exposure; expectedness producers beyond the guard refusal are still unnamed.
3. **FID-017**: the provider-side rejection half of the incomplete-arguments family.
4. **FID-021/022**: they close with the class lanes; the master last.
5. The paused session's pending program changes are now committed together with this session's work.

## Worktree note

Landed as two local commits, each staged with explicit paths (no push, no release):

- `decacf5e` — `fix(commands): keep an explicit user stop typed across the SDK bundle boundary
  (FID-2026-1012-023)` (27 files): the cancellation brand and its new gate, the producer-authoritative
  refusal identity, the CLI interrupt wiring, the SDK/agent-runtime transport, FID-2026-1012-022/-023,
  `SCOPE.md`'s write-target line, the capture rows this session's failures appended, and both session
  records.
- `891a8c1e` — `fix(agent-runtime): stop result inspection at the node budget and measure it honestly
  (FID-2026-1012-024)` (3 files): the bounded sequential traversal, its strengthened regression, and the
  FID-024 record with Loop 15/16 and the re-stamped receipt.

Unrelated idea-shelf, wiki and operator artifacts, plus three older untracked session summaries, remain
untouched and uncommitted. No processes were left running; the SDK builds and all verification runs
completed.
