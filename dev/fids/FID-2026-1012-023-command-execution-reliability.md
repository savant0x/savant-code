# FID: Command execution has no reliability contract — a timeout is a dead end, and the record names a different tool

**Filename:** `FID-2026-1012-023-command-execution-reliability.md`
**ID:** FID-2026-1012-023
**Severity:** medium
**Status:** fixed
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
`packages/agent-runtime` typechecks; and `quality`. The capture is the arbiter: a fix that does not
remove the records has not fixed the class.

## Verification Gates

- gate: test sdk/src/__tests__/command-execution-contract.test.ts
- gate: test sdk/src/__tests__/run-terminal-command.test.ts
- gate: test sdk/src/__tests__/run-state-child-process.test.ts
- gate: test packages/agent-runtime/src/tools/tool-executor/client-tool-bridge.test.ts
- gate: test packages/agent-runtime/src/tools/tool-executor/tool-result-errors.test.ts
- gate: test packages/agent-runtime/src/tools/tool-executor/result-lifecycle.test.ts
- gate: test packages/agent-runtime/src/hooks/__tests__/experience-capture.test.ts
- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck packages/agent-runtime
- gate: quality

### Verification Receipt

- fingerprint: sha256:0cd056d35dbf18a65a02cd5ba5463b339a30ae39a121f2d1e76552b34ace91dd
- verified: 2026-10-13T01:54:58.424Z
- test sdk/src/__tests__/command-execution-contract.test.ts: exit 0
- test sdk/src/__tests__/run-terminal-command.test.ts: exit 0
- test sdk/src/__tests__/run-state-child-process.test.ts: exit 0
- test packages/agent-runtime/src/tools/tool-executor/client-tool-bridge.test.ts: exit 0
- test packages/agent-runtime/src/tools/tool-executor/tool-result-errors.test.ts: exit 0
- test packages/agent-runtime/src/tools/tool-executor/result-lifecycle.test.ts: exit 0
- test packages/agent-runtime/src/hooks/__tests__/experience-capture.test.ts: exit 0
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck packages/agent-runtime: exit 0
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
- Nothing was pushed.

## Resolution

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

**Receipt NOT stamped, and why (measured, not excused).** `bun run fid:verify <this record> --write`
ran every declared gate live: **10 of 11 pass** (all seven test gates, all three typechecks), and
`quality` exits 1 with a single violation that is **not this lane's**:
`scripts/providers/audit-probes/parity-tier1-catalog-probe.ts: 312 lines exceeds absolute maximum 300`
(an untracked in-flight probe of the provider-parity lane, written during this pass). The quality gate
is repo-wide and fail-closed, so no receipt can be stamped while that file is over the ceiling — and
the file sits outside this record's authorised write surface, so editing it is a Law 2 violation
rather than a shortcut. The gate list above is kept whole: the honest state is "one gate blocked by a
foreign file", never a shorter list that passes. When the owning lane splits that file, re-run
`fid:verify --write` to stamp the receipt against this record's unchanged content.

**Open, and the reason this record is not `closed`:** the 13 classes have not been shown to have
stopped recurring. The next step is `FID-2026-1012-024`'s instrument's own mechanism — record the fix
boundary for each class against the implementation commit, then let
`scripts/experiences-recurrence.ts` run the declared window (14 days / 3 sessions). A class that
reappears inside the window returns this record to RED; only a clean window writes the lesson. For that
reason the recurrence probe is deliberately **not** among the declared gates: while the classes carry
no fix boundary, `scripts/experiences-recurrence.ts` truthfully reports `incomplete-observation` and
exits non-zero, and declaring it would make `fid:verify` red on a correct today-state.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's line
  (`sdk/src/tools/run-terminal-command.ts`, `sdk/src/run-state/**`, `common/src/util/command-execution.ts`,
  `common/src/types/experience.ts`, `common/src/tools/params/tool/**`,
  `packages/agent-runtime/src/tools/**`, `packages/agent-runtime/src/hooks/**`,
  `dev/experiences/class-owners.json`, the two sdk test paths).
- **Master program:** `FID-2026-1012-022` (census rows 18, 26, 30, 41, 42, 43, 49, 52, 53, 56, 62, 63,
  66).
- **Design record:** `docs/design/learnings-root-cause-matrix.md` — RC6 and feature E6.
- **Class-level claim:** none made here. This record fixes the mechanism the classes were recorded
  through; the capture decides when the classes are gone.

## Lessons Learned

Written when the class stops recurring. The subject will be the difference between a number and a
policy: every record in this lane says how long the command was allowed to run, and none of them says
what to do about it.
