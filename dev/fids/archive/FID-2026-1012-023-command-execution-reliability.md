# FID: Command execution has no reliability contract — a timeout is a dead end, and the record names a different tool

**Filename:** `FID-2026-1012-023-command-execution-reliability.md`
**ID:** FID-2026-1012-023
**Severity:** medium
**Status:** closed
**Created:** 2026-10-12 23:10
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022 (The failure-class remediation program)
**Depends On:** FID-2026-1012-024

---

## Summary

Thirteen captured classes — **27 records across 2026-09-17 → 2026-10-11** — are command execution
ending badly: ten **timeout** classes and three **abort** classes. The timeouts are recorded as
`Command timed out after <n> seconds` with **nine different budgets** (10, 30, 45, 60, 120, 180, 300,
600, 2400), which is the signature of a per-call number chosen by the caller rather than a policy: a
command that times out at 30 s is retried at 45 s, then 60 s, then 120 s, each attempt costing a full
turn. And the abort class is recorded against the wrong tool: a `run_readonly_command` record carries
the message `Tool call aborted: run_terminal_command`, so the alias and the executed tool disagree in
the capture. This record owns the lane: timeouts need a policy and a report the model can act on, and
an abort needs to name the tool that was actually aborted. As a child of `FID-2026-1012-022`, its
"fixed" is a **recurrence assertion** over the capture, not a green suite.

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** `ai` 5.0.122
- **Commit/State:** `main` @ `6e37aa15`

## Detailed Description

### Problem

Long-running commands fail in two ways, and neither failure teaches the run anything.

**Timeouts (10 classes, 21 records, last seen 2026-10-10).** The budgets recorded are
`30 s` (7 × `run_readonly_command`, 4 × `run_terminal_command`), `45 s`, `60 s`, `120 s`, `180 s`,
`300 s`, `600 s`, `2400 s`, and `10 s` — i.e. the ladder of a caller re-trying with a bigger number,
one turn at a time, with nothing carrying the lesson from the previous attempt. `run_readonly_command`
alone accounts for 14 records across six budgets, and its classes are among the few in the whole census
that are still live in October.

**Aborts (3 classes, 6 records).** `Tool call aborted: run_terminal_command` is captured under
`toolName: run_readonly_command` (3 records), and `Tool call aborted: glob` (2) and
`Tool call aborted: list_directory` (1) are captured under their own names. The first row is the
interesting one: **the tool that was aborted is not the tool the record attributes it to**, so an abort
cannot be routed to its owner by tool name.

### Expected Behavior

A command that exceeds its budget should fail with a report the caller can act on — the budget it hit,
that it can be raised, and the advice that the command be narrowed or backgrounded rather than retried
unchanged — and the runtime should not require the model to discover a workable budget by exhausting
the ladder. An abort should name the tool that was executing, and the record should attribute the
failure to that same tool. A timeout that recurs for the same command shape is a class with an owner
(this record), not a per-call accident.

### Root Cause

**There is no execution contract, only a per-call number.** The two timeout sites create a plain
`Error` carrying the seconds value and nothing else:

- `sdk/src/tools/run-terminal-command.ts:164` —
  `new Error(\`Command timed out after ${timeout_seconds} seconds\`)`
- `sdk/src/run-state/child-process.ts:37` — `reject(new Error(\`Command timed out after ${timeoutMs}ms\`))`

Neither site knows whether the command was a build, a test suite or a watcher, so neither can say
anything more useful than the number; and because the number is an argument, the run's only lever is to
send the same command again with a larger one. The abort path is not yet located in this pass
(**NEEDS-REVIEW**, below), but the capture is unambiguous that the alias (`run_readonly_command`) and
the executed tool (`run_terminal_command`) diverge in the record — which means the abort branch either
reports the delegate or is captured under the caller's name.

### Evidence

Measured at `6e37aa15` from `dev/experiences/raw-traces.jsonl` with the master's instrument
(`toolName` + first 70 characters of the error line); rows 18, 26, 30, 41, 42, 43, 49, 52, 53, 56, 62,
63 and 66 of the master's census.

```text
$ bun -e '<aggregate dev/experiences/raw-traces.jsonl by toolName + errorFirstLine.slice(0,70)>'
run_readonly_command — Command timed out after 30 seconds    7 hits / 6 sessions / last 2026-10-10
run_terminal_command — Command timed out after 30 seconds    4 hits / 4 sessions / last 2026-10-09
run_readonly_command — Tool call aborted: run_terminal_command 3 hits / 3 sessions / last 2026-10-11
run_readonly_command — Command timed out after 45 seconds    2 / 1 / 2026-10-04
run_readonly_command — Command timed out after 60 seconds    2 / 1 / 2026-10-04
glob                 — Tool call aborted: glob                2 / 1 / 2026-09-19
run_terminal_command — Command timed out after 10 seconds    1 / 1 / 2026-09-17
run_terminal_command — Command timed out after 600 seconds   1 / 1 / 2026-09-27
run_terminal_command — Command timed out after 2400 seconds  1 / 1 / 2026-09-27
run_readonly_command — Command timed out after 120 seconds   1 / 1 / 2026-10-02
run_readonly_command — Command timed out after 180 seconds   1 / 1 / 2026-10-08
run_readonly_command — Command timed out after 300 seconds   1 / 1 / 2026-10-09
list_directory       — Tool call aborted: list_directory      1 / 1 / 2026-10-08
                            13 classes / 27 records

$ grep -n 'Command timed out after' sdk/src/tools/run-terminal-command.ts sdk/src/run-state/child-process.ts
sdk/src/tools/run-terminal-command.ts:164: new Error(`Command timed out after ${timeout_seconds} seconds`)
sdk/src/run-state/child-process.ts:37:    reject(new Error(`Command timed out after ${timeoutMs}ms`))
```

## Impact Assessment

### Affected Components

- `sdk/src/tools/run-terminal-command.ts` (the `timeout_seconds` path)
- `sdk/src/run-state/child-process.ts` (the child-process timeout)
- The tool executor's abort branch and the `run_readonly_command` alias (`packages/agent-runtime/src/tools/`)
- The capture record for aborts (`toolName` vs the message's tool name)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists — the workaround is to retry with a larger number,
  one wasted turn per step of the ladder, which is exactly what the capture shows.
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Loop 2 and `docs/design/perfection-loop-2026-10-12.md` govern implementation where
they correct the original plan. No age-based class disposition or repair is implied.

Give execution a **contract** rather than a number: one timeout policy with a bounded escalation, a
timeout error that reports the budget and prescribes narrowing or backgrounding, and aborts that name
the executed tool. Verify with a recurrence assertion — no new timeout/abort records for the lane in
the declared window — because the claim being made is about production, not about the branch.

### Steps

1. Re-measure the 13 classes at implementation time with the master's instrument and record the
   numbers verbatim (this record's RED is the baseline).
2. Locate the abort branch and the `run_readonly_command` alias path; establish which tool name is
   authoritative and make the capture record that one (**this is the open question the RED marks
   NEEDS-REVIEW**).
3. Define the timeout policy in one place: a default per command class, a bounded escalation, and the
   requirement that a timeout error carry the budget that was hit.
4. Make the timeout error actionable: state the budget, that it can be raised, and that a command
   exceeding it should be narrowed or backgrounded — never "re-run unchanged".
5. Assert recurrence: the 13 classes must not reappear in the capture over the declared window,
   checked by a probe that reads `dev/experiences/raw-traces.jsonl`.
6. Only once the assertion holds, write the lesson against the class.

### Verification

Planned: the recurrence probe (exit 0 clean / 1 with issues) declared as a gate when the status flips;
a test for the timeout error's content (budget present, advice actionable); the `sdk` and
`packages/agent-runtime` typechecks; `quality`; and — since Loop 7 — the cross-copy cancellation
identity regression, declared as the gate named in `## Verification Gates`. The capture is the arbiter: a
fix that does not remove the records has not fixed the class.

## Verification Gates

- gate: test sdk/src/__tests__/command-execution-contract.test.ts
- gate: test sdk/src/__tests__/run-terminal-command.test.ts
- gate: test sdk/src/__tests__/command-execution-cancellation-identity.test.ts
- gate: test sdk/src/__tests__/run-state-child-process.test.ts
- gate: test packages/agent-runtime/src/tools/tool-executor/client-tool-bridge.test.ts
- gate: test packages/agent-runtime/src/tools/tool-executor/tool-result-errors.test.ts
- gate: test packages/agent-runtime/src/tools/tool-executor/expectedness.test.ts
- gate: test packages/agent-runtime/src/tools/tool-executor/result-lifecycle.test.ts
- gate: test packages/agent-runtime/src/hooks/__tests__/experience-capture.test.ts
- gate: test common/src/util/__tests__/experience-classes.test.ts
- gate: test cli/src/__tests__/headless-control.test.ts
- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck packages/agent-runtime
- gate: typecheck cli
- gate: quality

### Verification Receipt

- fingerprint: sha256:9f64425991d4af12a3b63ae37b0467eb250921189689a5da4aa670b2e88d07f1
- verified: 2026-10-15T05:28:09.100Z
- test sdk/src/__tests__/command-execution-contract.test.ts: exit 0
- test sdk/src/__tests__/run-terminal-command.test.ts: exit 0
- test sdk/src/__tests__/command-execution-cancellation-identity.test.ts: exit 0
- test sdk/src/__tests__/run-state-child-process.test.ts: exit 0
- test packages/agent-runtime/src/tools/tool-executor/client-tool-bridge.test.ts: exit 0
- test packages/agent-runtime/src/tools/tool-executor/tool-result-errors.test.ts: exit 0
- test packages/agent-runtime/src/tools/tool-executor/expectedness.test.ts: exit 0
- test packages/agent-runtime/src/tools/tool-executor/result-lifecycle.test.ts: exit 0
- test packages/agent-runtime/src/hooks/__tests__/experience-capture.test.ts: exit 0
- test common/src/util/__tests__/experience-classes.test.ts: exit 0
- test cli/src/__tests__/headless-control.test.ts: exit 0
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck cli: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED (2026-10-12)

- **RED:** 13 classes / 27 records, all live in September–October (last 2026-10-11). Timeouts arrive at
  nine different budgets, which is a per-call number discovered by ladder rather than a policy; the
  abort class is attributed to `run_readonly_command` while its message names `run_terminal_command`;
  and both timeout sites produce a bare `Error` carrying only the seconds value.
- **GREEN:** one timeout policy with a bounded escalation; a timeout error that reports the budget and
  prescribes narrowing/backgrounding; an abort that names the executed tool and is recorded under it.
- **AUDIT:** the 13 classes and 27 records are enumerated from the capture in the Evidence block; both
  timeout sites were read at `6e37aa15` and match the recorded message shape; the alias divergence is
  visible in the capture itself (row 30 vs rows 41/62).
- **ADVERSARIAL:** (a) *Are timeouts simply a slow machine?* The count is spread over six sessions and
  five weeks with nine budgets, which is the signature of the retry ladder, not one slow day — and even
  a slow machine is served by a policy that escalates in one step instead of five. (b) *Is this the
  same class as `-020` (edit-path friction)?* No: those are file-edit mismatches; these are process
  lifetime. (c) *Could a longer default mask a real hang?* Yes — which is why the error must report the
  budget it hit and the escalation must be bounded, and why the negative control is that a genuinely
  stuck command still ends the call. (d) *Is the abort seam real?* **NEEDS-REVIEW:** the abort branch
  was not located in this pass, so the record states the capture's divergence as a finding and makes
  locating it step 2, rather than asserting a mechanism it has not read.
- **CHANGE DELTA:** 0% source — this record made no code change; it is a converged pre-implementation
  design and one lane of the master's allocation.

### Loop 2 — Current-tree review and self-correction (2026-10-12)

- **RED:** 13 classes / 27 records. The abort site is located at
  `client-tool-bridge.ts:39`; `run-readonly-command.ts:78` deliberately delegates to
  terminal execution. Nine budgets do not prove a same-command retry ladder.
- **GREEN:** Apply `docs/design/perfection-loop-2026-10-12.md`: preserve caller and
  executed-tool identity; validate finite timeout values and explicit -1 semantics;
  keep session-init 10-second and normal 30-second defaults. Do not invent a background
  fallback: the public schema and SDK dispatcher support only SYNC. Never replay a command.
- **AUDIT:** Nonzero exits reach command verification but not the failure capture
  predicate. Abort/cancellation and actual process termination need separate receipts.
- **ADVERSARIAL / missed question:** Can a capped retry duplicate side effects? Yes.
  Escalate process termination, not execution. Preserve authorized long-running calls
  and require process-cleanup negative controls at the review's exact planned test paths.
- **CHANGE DELTA:** Planning correction only; timeout/abort classes remain unresolved.

### Missed Questions

### Loop 3 — Implementation contract

- **RED:** Direct SDK calls accept nonfinite budgets and negative values other than
  the documented -1. SDK cancellation returns a success-shaped message; delegated
  aborts name only the callee. Timeout rejection reports neither partial output nor
  the distinction between requested termination and observed cleanup.
- **GREEN:** Share finite timer validation and the unchanged 30-second/10-second
  defaults. Keep -1 explicit for terminal calls and preserve valid long budgets.
  Report controlled cancellation as an incomplete outcome, preserve caller/delegate/
  executed-handler identity, and transport those fields through capture. Termination
  is requested until close/cleanup evidence exists; never claim kill completion early.
  Add actionable timeout advice and preserve bounded process-group escalation.
- **AUDIT:** Producer-shaped SDK pins precede implementation; retain real process-tree
  tests. Bind delegated-abort/lifecycle pins to captured identities. Run affected
  workspaces and full root typecheck, lint, quality and repository validation.
- **ADVERSARIAL:** Reject invalid budgets before spawning. Do not infer user intent
  from an arbitrary abort signal, introduce background execution or replay commands.
  Session-init kill failures must settle the promise rather than escape its timer.
- **CHANGE DELTA:** Pre-write scope and impact recorded under automation level 3.

### Loop 4 — Implementation and deterministic gates (2026-10-12)

- **RED (re-measured):** unchanged — 13 classes / 27 records, last seen 2026-10-11. The abort seam the
  Loop 1 RED marked NEEDS-REVIEW is located: `client-tool-bridge.ts:34` emitted
  `Tool call aborted: ${clientToolCall.toolName}` with no identity, which is why the ledger holds a
  `run_readonly_command` row whose message names `run_terminal_command`. The budget ladder is also
  reproduced live in this pass: a repo-wide `grep` issued with the tool's default 30-second budget
  timed out, and the same search under an explicit larger budget completed — the caller-side ladder,
  observed.
- **GREEN (implemented):**
  - `common/src/util/command-execution.ts` — ONE `commandExecutionMetadataSchema` + `commandExecutionMetadata()`
    narrowing authority; the public params module re-exports it (`run-terminal-command.ts:15`) instead of
    holding a second definition, and the experience record validates against it (`experience.ts:76`).
    `commandExecutionMetadata()` had **zero production callers** before this pass; it now has two.
  - `tool-result-inspection.ts:37` — one traversal, two projections: the failure line and the identity of
    the value that produced it (`inspectToolOutput`), with `inspectToolOutputFailure` retained as the
    thin wrapper every existing caller and test uses.
  - `tool-result-errors.ts:33` — `inspectToolResultFailure()` consumes that traversal once, so the
    lifecycle no longer walks the result twice to get the line and its attribution.
  - `result-lifecycle.ts:266` transports `commandExecution` on the failure hook; `result-rejection-lifecycle.ts:49`
    narrows the THROWN error (a `CommandTimeoutError` carries its own identity) for the timeout path.
  - `hooks/types.ts` + `hooks/engine.ts` + `experience-capture.ts:55` carry it into the record, and
    `experience-capture.ts` **validates before writing**: a foreign or malformed payload is dropped
    rather than appended to the ledger.
  - `client-tool-bridge.ts:34` — the abort receipt now names the executed tool as a field
    (`executedToolName`), alongside `executionOutcome: 'cancelled'`, `executionStarted: false` and
    `terminationState: 'not-started'`, so an abort routes to its owner by identity instead of prose.
- **AUDIT (deterministic, run in this pass):** `sdk` full suite 633 pass / 1 POSIX skip / 0 fail;
  `packages/agent-runtime` full suite 2,048 pass / 0 fail across 314 files; full root `typecheck`
  exit 0 (14 legs); `quality:report` PASS; repo-wide `eslint . --max-warnings 0` exit 0. New pins:
  the timeout content pin drives a REAL process that outlives its budget (0.5 s) and asserts the budget
  in the message, the narrowing advice, `timeoutSeconds`, `executedToolName` and the requested
  termination state; the delegated-abort pin binds the bridge's receipt to the capture inspection that
  reads it.
- **ADVERSARIAL:** (a) *Is the class fixed, or merely re-worded?* Not claimed fixed — the falsifier is
  the capture, and no post-fix window exists yet; the record states `fixed` on deterministic gates and
  leaves the recurrence assertion open. (b) *Does a validation throw before spawn?* Yes — measured:
  five non-finite/negative budgets reject with `Invalid timeout_seconds` and never spawn. (c) *Does the
  record now carry content it should not?* No — the transported object is the narrowed identity only
  (outcome, flags, tool names, budget); no output, arguments or exception is copied, and the capture
  re-validates at the boundary. (d) *Can the batch path lose the identity?* No — the walker recurses
  into `results` and pairs each inner failure with its own value's metadata, pinned by test.
  (e) *Did the capture class key move?* No — `experienceClassIdentity` still receives only
  `toolName`/`errorFirstLine`/`errorClass`/`expectedness`.
- **DISCOVERED (verification harness, needs its own record):** `toMatchObject` with an asymmetric
  matcher MUTATES the received object on Bun 1.3.14 — `expect({a:'x'}).toMatchObject({a: expect.stringContaining('x')})`
  leaves `typeof a === 'object'`. It produced a false failure in this lane's first contract test by
  corrupting the raw result before the output schema parsed it. The test now parses first and asserts
  on the parse (robust either way); no claim is made that this is the only affected suite, and the
  finding is carried to the session record and the register rather than left in this file.
- **CHANGE DELTA:** implementation of the Loop 3 contract; the class lanes remain open.

### Loop 5 — SDK outcome transport correction (2026-10-13)

- **RED:** At `d9cee722`, the SDK `handleToolCall` catch copies only the
  exception message. `CommandTimeoutError` carries the outcome, budget and
  termination state, but those fields never reach the runtime's result walker.
  The SDK's pre-aborted dispatch branch also returns a `message` without an
  error channel, allowing cancellation to look like a successful tool result.
- **GREEN:** Reuse `commandExecutionMetadata` in the SDK catch, copying only
  its allowlisted fields alongside the existing error message. Pre-aborted
  dispatch returns `errorMessage` and cancelled/not-started identity, matching
  the runtime client bridge. Preserve pause-error propagation and never replay.
- **AUDIT:** `buildAgentRuntimeImpl` → `handleToolCall` → terminal runner →
  SDK catch → result lifecycle → shared walker → hook → capture is the actual
  path. Existing tests cover runner rejection and runtime capture separately;
  add SDK dispatch controls for a real bounded timeout and pre-start abort.
  Both controls also expose missing `command` in SDK error envelopes, which
  the public terminal output schema requires. Restore that field for terminal
  failures/cancellation without changing other tool envelopes.
- **ADVERSARIAL:** Do not spread a raw exception or infer expectedness from a
  timeout. Unknown host errors retain their existing error text; only validated
  execution metadata is copied. Cancellation must precede overrides and process
  start. Both changes are within this lane's registered dispatch/test targets.
- **CHANGE DELTA:** Converged additive correction under automation level 3;
  no production boundary, capture row or class identity changes are proposed.
- **IMPLEMENTATION:** Two dispatch controls fail against the prior envelopes
  and pass after repair; a third pins omission of invalid metadata and unrelated
  exception fields. Command suite: 11 PASS / zero FAIL. SDK cancellation now
  has an error channel, terminal errors satisfy their output schema, and the
  narrowed timeout identity survives SDK conversion. No timeout is automatically
  labelled expected, and no command is replayed.

### Loop 6 — Producer-authoritative expectedness for cancellation (2026-10-14)

- **RED:** Q26 identified a remaining ambiguity: all cancellation producers emit
  `executionOutcome: cancelled`, but none records whether the abort was an explicit
  user action, an internal timeout/transport event, or an untyped signal. Treating
  every cancellation as expected would hide defects; treating every cancellation as
  unexpected would misclassify an intentional user stop.
- **GREEN:** Add one canonical typed user-cancellation reason to the shared command
  execution contract. Actual SDK/terminal/bridge cancellation producers copy only
  that allowlisted reason when the signal carries it. The lifecycle assigns
  `expected` only when the signal itself carries the canonical reason and the
  execution metadata says `cancelled`; all other cancellations and all timeouts stay
  `undetermined`. The signal marker is an opaque module-private sentinel exposed
  only through the user-cancellation helper; parent-control, timer and internal
  aborts remain untyped. Wire explicit user interrupt surfaces to the canonical
  helper. Do not read expectedness from arbitrary tool output and do not rewrite
  historical rows.
- **GREEN correction:** readonly-guard expectedness is carried by the producer's
  rejected execution metadata, not inferred from stderr text. The bounded result
  inspection retains every nested failure so an expected refusal cannot hide a later
  host exit; the lifecycle captures the first non-expected failure, or the refusal
  when it is the only failure. Untyped SDK cancellation uses neutral cancellation
  wording and stays in the existing `cancelled:undetermined` class.
- **AUDIT:** Add contract assertions for typed versus untyped pre-start and
  in-flight cancellation, a real lifecycle capture assertion for the expected class,
  and production call-graph checks from the CLI user-interrupt surfaces through the
  shared helper. Re-run the declared SDK/agent-runtime gates and the recurrence
  assertion; this change creates no fix boundary or production repair claim.
- **ADVERSARIAL:** A provider or override result cannot self-excuse a failure because
  expectedness is resolved from the run signal plus cancellation identity, not from a
  result envelope field. A command that merely prints the readonly refusal phrase
  lacks the producer rejection marker and remains undetermined. A parent-control
  frame lacks the user sentinel. A timeout cannot become expected because timeout
  producers never carry the typed user reason. A bare `AbortController.abort()`
  remains `undetermined`, preserving the distinction between explicit user intent
  and an unknown cancellation origin. Contradictory metadata is rejected or
  normalized away at the shared schema boundary.
- **CHANGE DELTA:** Additive metadata, producer-owned refusal provenance, complete
  nested-failure inspection and lifecycle classification only; no historical rows,
  owners, exposure receipts or repair boundaries are changed.

### Loop 7 — Cancellation identity across a module-copy boundary (2026-10-15, automation level 3)

- **RED:** Loop 6 made a typed user cancellation an *identity comparison*, and the identity
  it compares — `USER_CANCELLATION_SIGNAL_REASON = Symbol('savant-user-cancellation')`
  (`common/src/util/command-execution.ts:27`) — is minted once per module *instance*. The
  comparison therefore holds only while the aborting copy and the reading copy are the same
  instance, and in the topology the CLI actually runs they are not: `common/package.json`
  exports resolve to SOURCE (`"bun": "./src/*.ts"`) while `sdk/package.json` publishes only
  dist (`"import": "./dist/index.mjs"`, no `bun` condition), so `cli/src/**` aborts through
  the source copy while `@savant-code/sdk` resolves to the bundle — and the bundle carries
  its own inlined copy of the module (`grep -c 'savant-user-cancellation' sdk/dist/index.mjs`
  → **1**, same for `index.cjs`), alongside the runtime it imports
  (`@savant-code/agent-runtime/...`). Reproduced against a bundle built at this revision,
  rather than inferred from the topology:

  ```text
  $ bun run /tmp/ce-probe3.ts
  fresh dist (built at this revision):
    executionOutcome   : cancelled
    cancellationReason : <absent>
    source copy types it: {"cancellationReason":"user-request"}
  ```

  The same signal whose reason the source copy reads as `user-request` is read as *untyped*
  by the bundle. The impact is not cosmetic: `resolveToolFailureExpectedness`
  (`tool-result-errors.ts:65`) requires the typed reason on **both** the envelope metadata
  (produced by the bundle's own `commandCancellationMetadata`) and the signal, so an explicit
  user stop records `undetermined` — the exact ambiguity Loop 6 exists to remove, and, under
  `FID-2026-1012-024`, a class that then demands an owner for a *correct* outcome. The failure
  is silent: no error, no warning, one lost field.
- **GREEN (planned):** Move the marker's identity out of the module instance and publish it in
  ONE process-wide registry reached through `Symbol.for`, comparing registry membership instead
  of symbol equality. `abortForUserCancellation` remains the only mint — a module-private
  marker object is registered there and is never exported — and `isUserCancellationSignal` /
  `commandCancellationMetadata` read the registry, so a marker minted by any loaded copy is
  recognized by every loaded copy. Rejected alternatives: (i) pointing the in-repo SDK
  resolution at source, a package-resolution change that leaves every other mixed-copy
  topology broken, including any consumer that bundles its own copy; (ii) a well-known *string*
  reason, which any code can forge without going through the helper; (iii) a `Symbol.for`
  reason *value*, which is a symbol value rather than a registered identity and is equally
  forgeable by key.
- **AUDIT (planned):** a NEW declared gate — `sdk/src/__tests__/command-execution-cancellation-identity.test.ts`,
  added to the gate list below and registered as a write target — that builds a second copy of the
  module and drives all four directions: copy A aborts / copy B reads, copy B aborts / copy A reads, and
  both same-copy directions, plus an ordinary untyped `abort()` and a plain non-marker reason, which must
  stay untyped in both copies. It is a new file rather than an addition to
  `command-execution-contract.test.ts` because that file is at 260 lines and the quality ceiling is 300;
  then the declared gate set, the SDK rebuild, and the bundle-boundary probe re-run as the boundary smoke.
- **ADVERSARIAL:** (a) *Does the registry widen the forgery surface?* It moves the identity
  space from module-private to process-wide, so in-process code that reaches the key can
  register a marker and have it read as user intent — but in-process code could already call
  `abortForUserCancellation` freely, so nothing that was unreachable to the process becomes
  reachable; what is added is a shared key, which is the price of cross-copy identity and is
  stated rather than hidden. (b) *Can a tool result forge it?* No — expectedness is resolved
  from the run signal plus the producer's own metadata, and no result envelope can register a
  marker. (c) *Does an untyped abort start typing itself?* No — only markers minted by the
  helper are registered, and the regression pins that an ordinary `abort()` stays untyped in
  both copies. (d) *Is the marker's shape now matchable?* No — identity is by reference in the
  registry, so shape is irrelevant, and the marker stays unexported. (e) *Does this rewrite any
  stored class, receipt, boundary or row?* No; it changes what a live signal is read as, not
  what was recorded.
- **GREEN (implemented):** the marker carries a registered brand —
  `USER_CANCELLATION_MARKER = Symbol.for('savant-code.user-cancellation')` plus
  `Object.freeze<UserCancellationReason>({ [USER_CANCELLATION_MARKER]: true })`
  (`common/src/util/command-execution.ts:41,48`) — and identity is read from the brand instead of from
  symbol equality: `isUserCancellationReason` requires an **own** property whose value is exactly `true`
  (`Object.getOwnPropertyDescriptor`), so an inherited, spoofed or foreign property cannot claim it.
  `abortForUserCancellation` remains the only mint (the marker is never exported) and
  `isUserCancellationSignal` / `commandCancellationMetadata` read the brand — the idiom this repository
  already uses for cross-copy identity (`PRESET_MARKER`,
  `packages/connectors/src/core/presets/preset.ts:9`).
- **AUDIT (measured — RED first, then GREEN):**
  - RED, two copies of the module built from the pre-fix source: `same copy (A reads A):
    {"cancellationReason":"user-request"}`, `cross copy (B reads A): {}`, `cross copy (A reads B): {}`,
    `same copy (B reads B): {"cancellationReason":"user-request"}`, untyped `(A): {}`.
  - RED, the real published boundary: `executionOutcome: cancelled` with `cancellationReason: <absent>`
    out of `sdk/dist/index.mjs`, while the source copy typed the same signal `user-request`.
  - GREEN, new declared gate `sdk/src/__tests__/command-execution-cancellation-identity.test.ts`: **3
    PASS / 0 FAIL, 13 expectations** — both directions across two copies, an ordinary `abort()` and a
    reason that merely *claims* `user-request` both staying untyped in both copies, and the copied
    terminal runner plus the source runner agreeing on one `user-request` outcome.
  - GREEN, boundary smoke after rebuilding the SDK at this revision: `dist/index.mjs` and
    `dist/index.cjs` each carry the brand key once, and the probe reports `cancellationReason :
    user-request` where it reported `<absent>`.
  - `typecheck common`, `typecheck sdk` and `typecheck packages/agent-runtime` exit 0; the declared
    gate set is re-stamped in the receipt below.
- **IMPLEMENTATION DISCOVERY (a green suite is not a gate, this lane's own repeat):** the first
  formulation of the brand was `const … : UserCancellationReason = Object.freeze({ [MARKER]: true })`.
  `Object.freeze` widens the literal to `boolean`, so the annotated constant was rejected —
  `error TS2322: Type 'boolean' is not assignable to type 'true'` at `command-execution.ts(48,7)` —
  and it was **the SDK build's declaration bundling** that found it, after the focused suites and the
  runtime typecheck were green. The correction is the explicit type argument
  `Object.freeze<UserCancellationReason>`, not a cast and not a weakened annotation.
- **ADVERSARIAL (answered by measurement):** (a) *Does a claimed reason type itself?* No — the gate
  pins that a reason carrying `cancellationReason: 'user-request'` is read as untyped by both copies,
  because only the brand is read and only the helper mints it. (b) *Does an ordinary abort type
  itself?* No — pinned in both copies. (c) *Can the brand be matched by shape?* No — it is an own
  property keyed by the registered symbol with the exact value `true`, checked by descriptor. (d) *Did
  any stored row, owner, boundary or receipt change?* No: the fix changes what a live signal is read
  as; `fix-boundaries.json` stays empty and every class stays `unresolved`.
- **CHANGE DELTA:** `common/src/util/command-execution.ts` (the brand, the reader and the two helpers
  that consume it), one new declared SDK gate file with its `SCOPE.md` write target line, and the gate
  line in this record; no class closure, no repair boundary, no historical row, receipt or owner change.

### Review questions

1. **Should the timeout be raised automatically by the runtime, or should the model be told?** Told,
   with a bounded runtime escalation: an automatic raise hides the fact that the command shape is wrong,
   and the capture already shows the model re-issuing the same command with a bigger number — the
   missing information is the budget it hit, not the permission to spend more.
2. **Which name is authoritative for an abort — the alias or the executed tool?** The executed tool, and
   the capture should record both (executed tool as `toolName`, caller as context). This record leaves
   the choice to step 2 because the abort branch has not been read; what is not in question is that the
   two names must not silently disagree.
3. **Why is this lane worked before the 193-record emission lane?** It is 27 records and settles the
   abort-attribution question that also affects how any tool failure is routed (master's ordering note).
4. **Is `2400 seconds` (40 minutes) itself the defect?** Possibly: it is the largest budget in the
   capture and it is in the ladder, which suggests the ladder is unbounded in practice. Step 3's policy
   must state a maximum, and the adversarial step must check that the maximum is not simply the largest
   number ever tried.

### Code Verification Evidence

> Pre-implementation record: `Status: converged` (FID-2026-0915-004). Nothing here is implemented;
> what follows records what was CHECKED at the cited state.

- [x] Measured at `6e37aa15`: the 13 classes / 27 records above, from the capture aggregation, matching
      rows 18, 26, 30, 41, 42, 43, 49, 52, 53, 56, 62, 63 and 66 of `FID-2026-1012-022`'s census.
- [x] Both timeout sites read and quoted with `file:line`: `sdk/src/tools/run-terminal-command.ts:164`
      and `sdk/src/run-state/child-process.ts:37`.
- [x] The alias divergence is taken from the capture itself (a `run_readonly_command` record whose
      message names `run_terminal_command`), not from a reading of the alias code.
- [x] **Resolved at implementation:** the abort branch is `packages/agent-runtime/src/tools/tool-executor/client-tool-bridge.ts:34`
      (`Tool call aborted: ${clientToolCall.toolName}`), reached from the `run_readonly_command` handler's
      delegation to the `run_terminal_command` client tool. It now emits `executedToolName` as a field.
- [x] Traceability of the transport, verified by grep at implementation (Law 4): the narrowed identity
      reaches production through `result-lifecycle.ts:266` and `result-rejection-lifecycle.ts:49` into
      `hooks/engine.ts` → `experience-capture.ts:55` → the record's `commandExecution` field. No new
      function added in this lane has zero callers.
- [x] Gates run and green at the implementation state: sdk 633 pass / 1 POSIX skip / 0 fail;
      agent-runtime 2,048 pass / 0 fail; root `typecheck` exit 0; `quality:report` PASS; repo-wide
      `eslint --max-warnings 0` exit 0; `lint:md` exit 0.
- [ ] **Not yet true, and deliberately not claimed:** that any of the 13 classes has stopped recurring.
      No fix boundary is recorded and no post-fix window has elapsed; the recurrence assertion stays
      open and this record stays out of `closed` until the capture shows the classes absent over the
      declared window.

## Boundaries

- This record owns the timeout and abort classes only; a command that fails for a non-lifetime reason
  (an exit code, a missing binary) belongs to `FID-2026-1012-019` (capability integrity) or
  `FID-2026-1012-024` (taxonomy), and a hand-off is made at RED with the re-measure as evidence.
- No reproduction was driven: the mechanism is read from the tree and the volume from the capture.
- The capture records only a failure's first line, so the nine budgets are certainly a floor on the
  number actually used. The 13 classes are still live as of the last record (2026-10-11); this pass
  changed the mechanism that records them, not the evidence that they occurred.
- The observation window cannot be satisfied in the pass that implements the fix — the boundary that
  starts it is recorded against the implementation commit, and the window then runs. This record
  therefore stops at `fixed`; treating a green suite as the class-level proof is exactly the
  substitution `FID-2026-1012-022` exists to refuse.
- One discovery in this pass is a **verification-harness** finding, not a class: Bun 1.3.14's
  `toMatchObject` mutates the received value when a key's expectation is an asymmetric matcher. It is
  recorded in Loop 4 and carried to the session record; it is not repaired by this lane and is not
  claimed as fixed.
- **The cancellation brand is deliberately process-wide (Loop 7).** `Symbol.for` makes the identity
  space well-known so a marker minted by one module copy is recognized by another; the corollary is
  stated rather than hidden — in-process code that knows the key can brand its own reason object. That
  is not a new capability (any module could already call `abortForUserCancellation`), and it is the
  price of an identity that survives the copy boundary instead of silently degrading to "unknown
  cancellation".
- Nothing was pushed.

## Resolution

**Closed 2026-10-15 — execution contract complete under Q25.**

- **Commit/State:** `decacf5edbab3b23fd1ab7e3f9aa2bb2cf3a52e1` plus
  `cde61d06e6e35c01a578f6dad5f2a7da5a22ee27` (result-hook delivery and suite).
- **Fix Description:** Finite budget validation, truthful timeout/cancellation
  outcomes, caller/executor identity and cancellation branding across module
  copies are implemented. The formerly unlocated abort seam is resolved.
- **Verification Evidence:** All 16 declared gates pass. The final sequential
  root chain passes 9,206 tests, with 23 skips and zero failures. An earlier
  broad run failed the Windows tree-cancellation assertion; its isolated suite
  and subsequent complete SDK and root runs pass. No cleanup repair is inferred
  merely from those later runs; the initial result remains in the session record.
- **Closure waiver:** Q25, `dev/experiences/closure-waivers.json`, names all five
  stable owned classes and uses the actual final delivery time
  2026-10-15T05:43:09Z. Historical post-initial-fix timeouts remain recorded;
  no row follows final delivery. Observation is unproved and classes unresolved.
- **Archived:** 2026-10-15 with the implementation-only CHANGELOG entry.

### Historical implementation record

**Implemented — `Status: fixed` (deterministic gates green; recurrence assertion OPEN).**

Execution now has a contract in one place instead of a per-call number: `common/src/util/command-execution.ts`
owns the schema, the narrowing reader, the finite-timer validation and the shared 30-second /
10-second defaults; both public schemas validate budgets through it (`run-readonly-command.ts`,
`run-terminal-command.ts`); a timeout rejects with `CommandTimeoutError`, which carries the budget
that was hit, the advice to narrow or background rather than replay, and its own execution identity;
session-init termination failures settle the promise instead of escaping their timer
(`child-process.ts`); and an abort is attributed by field, not by prose
(`client-tool-bridge.ts:34` → `result-lifecycle.ts:266` / `result-rejection-lifecycle.ts:49` →
`experience-capture.ts:55`).

Evidence at this state: sdk 633 PASS / 1 POSIX-only SKIP / 0 FAIL; agent-runtime 2,048 PASS / 0 FAIL
across 314 files; full root `typecheck` exit 0; `quality:report` PASS; repo-wide
`eslint . --max-warnings 0` exit 0; `lint:md` exit 0. The declared gates are listed above and stamped
below.

**Historical receipt blocker, resolved before Loop 5.** `bun run fid:verify <this record> --write`
ran every declared gate live: **10 of 11 pass** (all seven test gates, all three typechecks), and
`quality` originally exited 1 with a single violation outside this lane:
`scripts/providers/audit-probes/parity-tier1-catalog-probe.ts: 312 lines exceeds absolute maximum 300`
(an untracked in-flight probe of the provider-parity lane, written during this pass). The quality gate
is repo-wide and fail-closed, so no receipt could be stamped while that file was over the ceiling — and
the file sits outside this record's authorised write surface, so editing it is a Law 2 violation
rather than a shortcut. The gate list above is kept whole: the honest state is "one gate blocked by a
foreign file", never a shorter list that passes. The owning lane resolved the blocker;
the receipt above was stamped. Loop 5 re-runs the complete gate set for this correction.

**Open, and the reason this record is not `closed`:** the 13 classes have not been shown to have
stopped recurring. The next step is `FID-2026-1012-024`'s instrument's own mechanism — record the fix
boundary for each class against the implementation commit, then let
`scripts/experiences-recurrence.ts` run the declared window (14 days / 3 sessions). A class that
reappears inside the window returns this record to RED; only a clean window writes the lesson. For that
reason the recurrence probe is deliberately **not** among the declared gates: while the classes carry
no fix boundary, `scripts/experiences-recurrence.ts` truthfully reports `incomplete-observation` and
exits non-zero, and declaring it would make `fid:verify` red on a correct today-state.

- **Post-fix capture observation (2026-10-13, recorded during FID-2026-1012-019's pass):** the class has
  **not** stopped. One record landed **after** this fix — `2026-10-13T03:10:27.155Z`,
  `run_readonly_command`, carrying this record's new contract text (`Command timed out after 600
  seconds. Termination requested; verify cleanup before another execution. Narrow the command or choose
  an explicit …`) with `expectedness: undetermined`. That is the legitimate outcome the contract now
  names — a command that genuinely exceeded its ceiling — rather than a silent failure, but the capture
  cannot yet tell the two apart, so the class stays open until `FID-2026-1012-024`'s classification
  separates an expected timeout from a defect. No class claim is made here.
- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's line
  (`sdk/src/tools/run-terminal-command.ts`, `sdk/src/run-state/**`, `common/src/util/command-execution.ts`,
  `common/src/types/experience.ts`, `common/src/tools/params/tool/**`,
  `packages/agent-runtime/src/tools/**`, `packages/agent-runtime/src/hooks/**`,
  `dev/experiences/class-owners.json`, the three sdk test paths).
- **Master program:** `FID-2026-1012-022` (census rows 18, 26, 30, 41, 42, 43, 49, 52, 53, 56, 62, 63,
  66).
- **Design record:** `docs/design/learnings-root-cause-matrix.md` — RC6 and feature E6.
- **Class-level claim:** none made here. This record fixes the mechanism the classes were recorded
  through; the capture decides when the classes are gone.

## Lessons Learned

Written when the class stops recurring. The subject will be the difference between a number and a
policy: every record in this lane says how long the command was allowed to run, and none of them says
what to do about it.
