# FID: The agent-runtime suite was red because a process-lifetime breaker leaked across test files

**Filename:** `FID-2026-1007-001-agent-runtime-suite-breaker-leak-and-behavior-corrections.md`
**ID:** FID-2026-1007-001
**Severity:** high
**Status:** closed
**Created:** 2026-10-07 05:40
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

76 pre-existing failures in the agent-runtime suite — the `run-agent-step` family,
`web_search`, `read-docs` and the hook-event suites — had exactly one root cause, and it
was not 76 defects. Every failing case threw
`ProviderBoundaryBlockedError: provider call blocked: Circuit breaker open — 30min
cooldown remaining` from `classified-stream-retry.ts`, and the tell was that
`getLlmCallCount()` returned **0**: the turn was blocked *before any physical request was
made*. `providerBreakers` is a module-level `Map` with no reset, `bun test` runs every file
in ONE process, and the shared fixtures all reuse `clientSessionId: 'test-session'`, so
unsuspecting suites shared the breaker key `legacy:test-session`; one suite driving three
transient failures (`PROVIDER_BREAKER_MAX_FAILURES = 3`, 30-minute cooldown base) opened
the circuit for the remainder of the run. A second instance of the same class — the
process-lifetime `DEFAULT_SEEN_SHAPES` set in `classified-stream-retry.ts` — suppressed an
unknown shape already logged by an earlier file, and was the last order-dependent failure.
Isolating that shared state did not just make the suite green: it unmasked **three genuine
behaviour defects** that the noise had been hiding, each repaired here and pinned. This
record exists because those three are production behaviour changes — an abort that was not
recognised through its `cause` chain, an error message that reported the wrapper instead of
the provider, and a newer loop guard that auto-ended autonomous runs in direct violation of
the operator-mandated AUTONOMY CARVE-OUT — and the earlier pass landed them without a
record.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Tool Versions:** git, bun test, eslint, markdownlint, prettier (repo-pinned)
- **Commit/State:** HEAD `d035e09b` at intake. The change set is committed as `228156da`
  (path-scoped, G2 granted 2026-10-07); this record was archived with it.

## Detailed Description

### Problem

The suite was red in a way that read as rot rather than as a single defect: dozens of
failures spread across four unrelated families, each one reporting an infrastructure error
about the *provider*, none of them reproducing reliably when a file was run alone. The
sharpest observation available was the one that named the cause: the failing turns never
reached the network (`getLlmCallCount() === 0`), so whatever blocked them had decided
before a request existed. A circuit breaker is the only component that can refuse a call
that has not been made — and a breaker whose state is process-global is a breaker whose
blast radius is the process.

### Expected Behavior

Each suite starts from the state it declares: one file's transient failures must not change
another file's verdicts, so a test's result depends on the test, not on the order bun
happened to load files. A shared, process-lifetime registry is legitimate in production (one
breaker per serving connection, shared across turns) so the fix belongs at the test
boundary, not in the production contract. Separately, the three defects the noise was hiding
must be behaviourally correct: an abort wrapped in a cause chain is still an abort; a
user-facing failure message names the provider's error, not the wrapper's label; and an
autonomous run is never auto-ended by the stale-cycle guard, because the operator mandate
says so.

### Root Cause

1. **The breaker registry is process-lifetime and the fixtures share one key.**
   `providerBreakers` (`provider-circuit-breaker.ts`) is a module-level `Map` with per-key
   breakers created on demand by `providerCircuitBreakerFor`. The tests reuse the constant
   `clientSessionId: 'test-session'` across harnesses, unlike production, which mints a
   per-session id — so every suite that reaches the boundary shares one breaker. Three
   transient failures trip it (`PROVIDER_BREAKER_MAX_FAILURES = 3`) and the cooldown base is
   30 minutes, far longer than a test run.
2. **A second process-lifetime registry of the same class.** `DEFAULT_SEEN_SHAPES` in
   `classified-stream-retry.ts` records unknown shapes once per process, so a shape logged by
   an earlier file was silently not logged in a later one — the last order-dependent failure.
3. **`isAbortError` did not walk the `cause` chain.** An abort wrapped by a boundary layer
   was not recognised as an abort, so cancellation was treated as failure. Two sibling
   predicates in the same subsystem already read through `cause`; this one did not.
4. **The fallback error message named the wrapper.** `error-output.ts` reported
   `provider call failed (…)` instead of the provider's own text, because it read the
   outermost error rather than the innermost.
5. **The newer stale-cycle guard violated a documented operator mandate.**
   `loop-guard-wiring.ts` stops a run on a repeated step shape
   (`STALE_CYCLE_REPEATS=3` × `MIN_STALE_CYCLE_LENGTH=2` = six identical steps), which is
   exactly what an autonomous run does by design, while `post-terminal-breaker.ts` documents
   the **AUTONOMY CARVE-OUT**: Auto Drive / active-goal runs "must never be auto-ended". The
   guard was newer than the mandate and had silently overridden it.

### Evidence

The defect is order-dependence, so the evidence is the same two files in both orders —
together and alone, on the unmodified tree:

```text
$ bun test src/__tests__/loop-agent-steps-api-transport.test.ts src/__tests__/loop-agent-steps-part-a.test.ts
 4 pass / 5 fail          # both orders, identical
$ bun test src/__tests__/loop-agent-steps-part-a.test.ts src/__tests__/loop-agent-steps-api-transport.test.ts
 4 pass / 5 fail
$ bun test src/__tests__/loop-agent-steps-api-transport.test.ts      # alone
 9 pass / 0 fail
$ bun test src/__tests__/loop-agent-steps-part-a.test.ts             # alone
 9 pass / 0 fail
```

Post-fix, the same pair in both orders: **9 pass / 0 fail**, with zero
`ProviderBoundaryBlockedError` occurrences in either log. Whole-workspace:

```text
$ bun run --cwd=packages/agent-runtime test
 1868 pass / 0 fail   →   was 76 fail   (292 files, exit 0)
```

Call graph and change sites (verified by grep at implementation):

```text
BREAKER REGISTRY / RESET
  packages/agent-runtime/src/provider-boundary/provider-circuit-breaker.ts:119  const providerBreakers = new Map(...)
  provider-circuit-breaker.ts:121   providerCircuitBreakerFor(connectionKey)
  provider-circuit-breaker.ts:130   resetProviderCircuitBreakers()      <- NEW (exported)
  provider-circuit-breaker.ts:17    PROVIDER_BREAKER_MAX_FAILURES = 3
  provider-circuit-breaker.ts:18    PROVIDER_BREAKER_COOLDOWN_BASE_MS = 30 * 60_000
  provider-boundary/classified-stream-retry.ts:55  resetUnknownShapeLog()   <- NEW (exported)

ISOLATION PRELOAD (test-only; production never calls either reset)
  packages/agent-runtime/test/setup-test-isolation.ts   NEW, 26 lines
  packages/agent-runtime/bunfig.toml                    preload = [../../sdk/test/setup-env.ts,
                                                                   ./test/setup-test-isolation.ts]

BEHAVIOUR CORRECTIONS
  common/src/util/error/abort.ts:57                 const cause: unknown = (current as {cause?: unknown}).cause
  run-agent-step/error-output.ts:24                 innermostError(error)
  run-agent-step/error-output.ts:65                 const source = innermostError(error)
  run-agent-step/loop-guard-wiring.ts:128-133       autonomous?: boolean
  run-agent-step/loop-guard-wiring.ts:152-155       the stale-cycle carve-out
  run-agent-step/loop.ts:26 / :165                  isAutonomousContinuation(...) → autonomous
  run-agent-step/post-terminal-breaker.ts:20-23     the operator-mandated AUTONOMY CARVE-OUT

PINS ADDED
  common/src/util/__tests__/error-abort-detection.test.ts:56    +4 cause-chain cases
  packages/agent-runtime/src/__tests__/loop-guard-rails-wiring.test.ts  +2 autonomy cases
  packages/agent-runtime/src/__tests__/provider-breaker-test-isolation.test.ts  NEW (this pass)
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/provider-boundary/provider-circuit-breaker.ts`
- `packages/agent-runtime/src/provider-boundary/classified-stream-retry.ts`
- `packages/agent-runtime/test/setup-test-isolation.ts` (new)
- `packages/agent-runtime/bunfig.toml`
- `common/src/util/error/abort.ts`
- `packages/agent-runtime/src/run-agent-step/error-output.ts`
- `packages/agent-runtime/src/run-agent-step/loop-guard-wiring.ts`
- `packages/agent-runtime/src/run-agent-step/loop.ts`
- `packages/agent-runtime/src/__tests__/provider-breaker-test-isolation.test.ts` (new)
- `packages/agent-runtime/src/__tests__/error-output-innermost.test.ts` (new)
- `packages/agent-runtime/src/__tests__/loop-guard-rails-wiring.test.ts`
- `common/src/util/__tests__/error-abort-detection.test.ts`

### Risk Level

- [x] High: a broken suite that reads as rot rather than as one defect (76 failures across
      four families from a single shared key), one of which was a live behaviour
      regression — the autonomy carve-out was being violated in production, not only under
      test, because the guard's rule did not depend on the test boundary at all.

## Proposed Solution

### Approach

Split the repair along the line that separates the leak from the defects. The leak is test
infrastructure: a preload resets the two process-lifetime registries before each case, so
every suite starts from a closed circuit and an empty shape log — the production contract
(one breaker per serving connection, shared across turns) is untouched and neither reset has
a production caller. The defects are behaviour, and each is fixed at the seam that owns the
decision: `isAbortError` reads through `cause` in the same way its sibling predicates
already do; the fallback message takes the innermost error; and the stale-cycle guard gains
an `autonomous` input that converts only a `stale-cycle` stop into `continue`, leaving
`iteration-cap` and `deadline` untouched because those are the run's own hard limits.

**A leak fix that only turns a suite green is not evidence of anything.** The three defects
above were invisible until the noise stopped, and they are the reason this record exists:
each is a production behaviour change that the earlier pass landed without a record.

### Steps

1. **DONE.** Export `resetProviderCircuitBreakers()` (`providerBreakers.clear()`), documented
   as test-only with the leak it exists to prevent measured in the doc comment.
2. **DONE.** Export `resetUnknownShapeLog()` for the second process-lifetime registry.
3. **DONE.** Add `packages/agent-runtime/test/setup-test-isolation.ts` (a `beforeEach` calling
   both resets) and preload it from `packages/agent-runtime/bunfig.toml` after the shared
   `sdk/test/setup-env.ts`.
4. **DONE.** `isAbortError` walks the `cause` chain, cycle-guarded by a `Set<Error>` and
   `Error`-instance-only at every level so the existing "plain object → false" contract holds
   (this surfaced TS7022, fixed with an explicit `const cause: unknown`).
5. **DONE.** `error-output.ts` gains `innermostError(error)` and uses it for
   `fallbackMessage`, so a wrapped failure reports the provider's real message.
6. **DONE.** `evaluateLoopGuard` gains `autonomous?: boolean`; a `stale-cycle` stop becomes
   `continue` when it is true; `loop.ts` passes
   `isAutonomousContinuation(initialAgentState)`.
7. **DONE.** Pins: four cause-chain cases in the abort-detection suite, two autonomy cases in
   the loop-guard-rails suite (the carve-out holds; an iteration cap still ends an autonomous
   run), and — this pass — a dedicated isolation suite pinning that the reset clears an open
   circuit and that the registry is shared process state.

### Verification

- **P1** The two-file repro passes in both orders with zero `ProviderBoundaryBlockedError`,
  where it failed 5 of 9 both orders before. Verified by command output.
- **P2** The whole workspace suite is green (`packages/agent-runtime` 1868 pass / 0 fail
  across 292 files, exit 0), and the collateral workspaces are unaffected — common 813 pass /
  4 skip / 0 fail, sdk 664 pass / 1 skip / 0 fail, cli 3960 pass / 18 skip / 0 fail, all
  re-run in this pass.
- **P3** A tripped circuit on the shared `legacy:test-session` key blocks, `resetProviderCircuitBreakers()`
  returns it to closed for a NEW instance, and an open circuit on that key is still open
  within a case — the leak class itself, pinned in
  `packages/agent-runtime/src/__tests__/provider-breaker-test-isolation.test.ts`.
- **P4** An abort wrapped in a `cause` chain is recognised as an abort, including through
  multiple levels, while a non-`Error` cause and a cyclic chain stay refused —
  `common/src/util/__tests__/error-abort-detection.test.ts`.
- **P5** A wrapped provider failure reports the innermost message, not the wrapper's label —
  `packages/agent-runtime/src/__tests__/error-output-innermost.test.ts`.
- **P6** An autonomous run survives a stale-cycle diagnosis and continues, while an iteration
  cap still terminates it — same suite, both legs.
- **P7** `bun run quality:report` PASS and `bun run validate:repository` PASS.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: typecheck common
- gate: test packages/agent-runtime/src/__tests__/provider-breaker-test-isolation.test.ts
- gate: test packages/agent-runtime/src/__tests__/loop-guard-rails-wiring.test.ts
- gate: test packages/agent-runtime/src/__tests__/error-output-innermost.test.ts
- gate: test common/src/util/__tests__/error-abort-detection.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:2b89c8a1b29b2d001da3fcb7785b95789c30f60ee30b7f788077aeb08a336e12
- verified: 2026-10-07T05:42:31.436Z
- typecheck packages/agent-runtime: exit 0
- typecheck common: exit 0
- test packages/agent-runtime/src/__tests__/provider-breaker-test-isolation.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/loop-guard-rails-wiring.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/error-output-innermost.test.ts: exit 0
- test common/src/util/__tests__/error-abort-detection.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** the suite was red in four families and the failures carried one message about the
  provider. The decisive observation was that `getLlmCallCount()` read 0 — a turn blocked
  before any physical request — which pointed at the one component that can refuse a call
  that was never made: a circuit breaker. Grep located `providerBreakers` as module-level
  state with no reset, and the fixtures were found reusing `clientSessionId: 'test-session'`,
  so unrelated suites shared `legacy:test-session`. Two files were shown to fail together
  (4/5) and pass alone (9/0) in both orders. A second instance of the same class
  (`DEFAULT_SEEN_SHAPES`) was isolated afterwards as the last order-dependent failure.
- **GREEN:** the two resets plus the preload, then — once the noise stopped — the three
  behaviour corrections. The corrections were not planned from the failure list; they became
  visible only after the leak was removed, which is the finding this record is really about.
- **AUDIT:** every claim above is re-verified in this pass by re-running the commands, not by
  restating the earlier pass: `packages/agent-runtime` 1868 pass / 0 fail across 292 files
  exit 0, common 813 pass / 4 skip / 0 fail, sdk 664/0, cli 3960/0, the repro pair green in
  both orders with zero boundary errors.
- **ADVERSARIAL:** the honest limit is that no *production* caller was found for either reset
  (by design — they exist for the test boundary), so the isolation half is verified by the
  suite's stability and by the dedicated isolation pins rather than by a call-graph
  reachability argument. The behaviour half is verified by production call graph: `loop.ts`
  passes `autonomous`, `error-output.ts` consumes `innermostError`, and `isAbortError` is
  consumed by the abort paths.
- **CHANGE DELTA:** new document.

### Missed Questions

1. **Was this a flake?** No, and treating it as one would have left three production defects
   in place. It was order-dependence with a deterministic mechanism: the same pair of files
   failed the same way in both orders, and each file passed alone.
2. **Why not regenerate a fresh session id per test instead of resetting the registry?** That
   would fix only the breaker key and leave the second process-lifetime registry
   (`DEFAULT_SEEN_SHAPES`) leaking, and it would edit shared fixtures whose literal id is
   deliberate (production mints per-session ids; the fixtures keep one to stay comparable).
   Resetting the two registries at the test boundary fixes the class, not the instance.
3. **Is it acceptable for test-only resets to live in production modules?** They are exported
   with an explicit test-isolation contract and no production caller; the alternative —
   reaching into module state from the test — is not expressible. The production contract
   ("one breaker per serving connection, shared across turns in this process") is unchanged.
4. **Did isolating the noise change any test's meaning?** One pin moved, and it was the point:
   the autonomy carve-out had no test because the guard that violated it was newer than the
   mandate. It now has two.
5. **Was the mandate real, or a stale comment?** Real, and the record checks it rather than
   assuming: `post-terminal-breaker.ts:20-23` documents the operator-mandated carve-out, and
   `loop-guard-wiring.ts` is a newer guards layer that never received the carve-out.
6. **Does the carve-out weaken the guard?** Only the `stale-cycle` diagnosis is suppressed —
   a statement about the plan's shape, which an autonomous run repeats by design. The run's
   hard limits (`iteration-cap`, `deadline`) still stop it, pinned by the second new case.

### Implementation Evidence (REQUIRED for `closed`)

> Closed 2026-10-07 on the operator's ruling: "approve, grant automation level 3" (G2).

- [x] **Commit SHA:** `228156da`
- [x] **File:line ranges:** see Evidence and the gate list above
- [x] **Gate output:** all seven declared gates exit 0 at the stamped receipt
- [x] **Reproducibility:** the two-file repro pair in both orders, plus
      `bun run --cwd=packages/agent-runtime test`
- [x] **Step statuses:** steps 1-7 all implemented; step 7's isolation suite landed in the
      record-authoring pass

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution (all seven steps)
- [x] Typecheck/tests/lint pass with pasted tool output — both declared typechecks exit 0,
      the four declared test files exit 0, `quality` exit 0 at the receipt,
      `validate:repository` PASS, eslint 0 and prettier clean on every changed file
- [x] Production call-graph evidence is present for the repaired wiring —
      `loop.ts:165` → `evaluateLoopGuard({ ..., autonomous })`;
      `error-output.ts:65` → `innermostError`; `isAbortError` consumed by the abort paths.
      The two resets have NO production caller by design, which is stated rather than
      glossed (see Loop 1 ADVERSARIAL)
- [x] FID status reflects the actual implementation state (`fixed`: implemented and
      verified, uncommitted)

### Loop 2 — Record-authoring audit

- **RED:** the three behaviour corrections had been landed and verified in the earlier pass
  but carried no record, so the repairs existed only in the working tree and in
  conversation. That is the gap this pass closes; it is a documentation defect, not a code
  one. The register gate also said so out loud while the line was missing: with the record in
  `dev/fids/` but not yet in `SCOPE.md`, the two `live repository` register tests failed
  (1868 tests, 2 failing), so the suite could not be green until T156 existed. That is the
  coverage rule working, not a nuisance — the FID was invisible in the register, exactly the
  quiet path FID-2026-0919-025 exists to close.
- **GREEN:** this record, its seven declared gates, the register item (T156), the index entry
  in `dev/fids/README.md`, and two LEARNINGS entries — the isolation invariant, and the rule
  that removing noise starts the diagnosis rather than ending the repair.
- **AUDIT:** the isolation half had no test of its own — the pins added by the earlier pass
  cover the abort and autonomy corrections, not the breaker reset. Rather than record that
  gap, this pass added `provider-breaker-test-isolation.test.ts`, which pins both the cure
  (a reset clears an open circuit, returning a new instance) and the class (an open circuit
  on the shared key survives within a case).
- **ADVERSARIAL:** the strongest challenge to this record is that a suite repair plus three
  unrelated behaviour fixes is two concerns in one document. They are one concern here: the
  behaviour fixes were *found by* removing the leak, and recording them apart from the
  isolation work would hide why they were invisible for so long. Recorded as a judgement,
  not a circumstance.
- **CHANGE DELTA:** new document, plus the two isolation/innermost suites, the register item,
  the index entry and the two LEARNINGS entries.

## Resolution

- **Closed Date:** 2026-10-07
- **Fix Description:** the 76-failure suite was one defect — a process-lifetime breaker
  registry leaking an OPEN circuit across test files that share the key
  `legacy:test-session` — fixed by two exported resets called from a test preload. Removing
  that noise unmasked three production behaviour defects, each repaired and pinned: abort
  detection now walks the `cause` chain, the user-facing failure message reports the
  innermost error, and the loop guard's `stale-cycle` stop is carved out for autonomous runs
  as the operator mandate requires.
- **Tests Added:** Yes —
  `packages/agent-runtime/src/__tests__/provider-breaker-test-isolation.test.ts` (isolation:
  the reset clears an open circuit, and the registry is shared process state),
  `packages/agent-runtime/src/__tests__/error-output-innermost.test.ts` (the innermost message
  through a multi-level chain, and a non-`Error` cause left alone),
  `packages/agent-runtime/src/__tests__/loop-guard-rails-wiring.test.ts` (the carve-out and
  the iteration cap), and four cause-chain cases in
  `common/src/util/__tests__/error-abort-detection.test.ts`.
- **Verification Evidence:** `packages/agent-runtime` 1868 pass / 0 fail across 292 files
  exit 0 (was 76 failures); the two-file repro 9 pass / 0 fail in both orders with zero
  `ProviderBoundaryBlockedError`; common 813 pass / 4 skip / 0 fail, sdk 664/1/0, cli
  3960 pass / 18 skip / 0 fail; both typechecks exit 0; the four declared test gates exit 0;
  `quality:report` PASS; `validate:repository` PASS.
- **Archived:** `dev/fids/archive/FID-2026-1007-001-agent-runtime-suite-breaker-leak-and-behavior-corrections.md`
  (moved at closure; the record's own commit is the one it describes)

## Lessons Learned

1. **A red suite is a symptom; count the causes before counting the failures.** 76 failures
   came from one process-global registry, and the number itself was the distraction: the
   only signal that mattered was that the blocked turns never reached the network.
2. **Process-lifetime state is a test-order dependency waiting to happen.** Bun runs every
   file in one process, so any module-level `Map`/`Set` that accumulates is shared by every
   suite; a fixture that reuses one literal id makes that sharing deterministic rather than
   accidental. Reset such state at the test boundary and pin the reset.
3. **Removing noise is not the end of the repair — it is the start of the diagnosis.** The
   three behaviour defects were invisible while the leak was present; treating the green run
   as completion would have shipped them.
4. **A newer mechanism can silently override an operator mandate.** The stale-cycle guard was
   written after the AUTONOMY CARVE-OUT and never re-read it, so an autonomous run was
   auto-ended by a rule that exists to catch pathological repetition. Mandates need tests,
   not just documentation.
