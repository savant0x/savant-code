# FID: Boundary observability and enumeration — SubagentStop outcome payload + SessionState/FileContext field partitions

**Filename:** `FID-2026-0919-029-boundary-outcome-and-enumeration.md`
**ID:** FID-2026-0919-029
**Severity:** medium
**Status:** closed
**Created:** 2026-09-19 21:45
**Automation level:** 3
**YAGNI-Compliance:** Confirmed (no new capability or dependency: `SubagentStop`
already accepted `toolResult`/`errorMessage` — the gap was the call site; the two
partitions reuse the existing `AssertNever` pattern from FID-2026-0919-028 and the
repo's existing `typecheck` gate)

---

## Summary

Two boundary gaps, both about *what is knowable at a boundary*, both closed by
enumerating the boundary rather than patching an instance of it.

**A — an operator hook could not tell a finished child from a failed one.**
`SubagentStart`/`SubagentStop` (FID-2026-0814-003) fired with type, session and cwd
only. A hook that reacts to child completion — the automation surface
`protocol.config.yaml` exposes to operators — saw the same payload whether the
child delivered or crashed. The hook contract already supported
`tool_result`/`error_message` (the same fields `PostToolUse` /
`PostToolUseFailure` use); `executeSubagent`, the single funnel both spawn paths
share, simply never set them.

**B — `SessionState` and `ProjectFileContext` had no enumerated boundary
contract.** FID-2026-0919-028 made `AgentState` self-enforcing at the spawn
boundary and left one question open on purpose: *"Should the gate cover
`SessionState` / `FileContext` too? They have the same shape of risk … reported as
the natural extension if a boundary is introduced for either."* Both do have a
boundary — the snapshot boundary (`cloneSessionState` copies one part and shares
the other) and the run boundary (run start rewrites 10 of the 16 file-context
fields) — and both were documented only in prose comments at the writer.

## Environment

- **OS:** Windows (win32), bash shell
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Tool Versions:** tsc (12 workspaces), eslint, prettier, markdownlint
- **Commit/State:** `main`; the 0.0.33 working tree; nothing committed (G2 withheld)

## Detailed Description

### Problem

**A. Outcome-blind hooks.** `executeSubagent` fired the subagent lifecycle pair
around `loopAgentSteps` and passed identity only:

```ts
buildHookInput({ event: 'SubagentStop', sessionId, cwd, subagentType })
```

Three genuinely different endings — the loop returned usable output, the loop
returned the error form (`getAgentOutput` found no assistant turn, or the loop's
own error arm produced `{ type: 'error', message }`), and the loop threw — all
produced byte-identical hook payloads. The fired event is also the seam
`protocol.config.yaml` automation is expected to act on, so "an operator hook
cannot distinguish completion from failure" is not cosmetic.

**B. Two unenumerated boundaries.** `SessionState` crosses the snapshot boundary;
`ProjectFileContext` crosses the run boundary. Neither had an artifact that
enumerates its fields and their intended boundary behaviour:

- `cloneSessionState` deep-copies `mainAgentState` (JSON round-trip, chosen for
  byte-parity with the persisted snapshot) and shares `fileContext` by reference
  (~230ms per snapshot avoided on the render thread). The *reason* lived in a
  comment; a third field added to `SessionState` would be classified by nobody.
- Ten `fileContext` fields are rewritten at run start by two different modules;
  the other six are carried. `gitChanges` is one of the carried ones — captured
  once at session init (`sdk/src/run-state/initial-state.ts:121`) and **not**
  refreshed on resume — which is a real behaviour with a real consequence and was
  documented nowhere.

### Expected Behavior

**A.** `SubagentStop` must carry the child's outcome: completed, or failed with
the reason, distinguishable without reading the run trace. `SubagentStart` must
stay outcome-free so the pair is meaningful. The payload must add no new
dependency on the hook contract, which already had the fields.

**B.** Every key of `SessionState` and `ProjectFileContext` must be classified
exactly once against the boundary it crosses, each exemption carrying the reason
it is safe, and adding an unclassified field must fail the build — the same
standing requirement FID-028 established for `AgentState`.

### Root Cause

**A.** The payload builder was written with outcome fields from the start
(`toolResult`, `errorMessage`); the call site was written for observation only.
Classification of "what does this event mean" was implicit in which arguments the
call site chose to pass, so nothing failed when the answer was "not enough".

**B.** Same root cause as FID-028, one layer out: the contract was prose at the
writer, so completeness was established by reading the writer rather than by the
compiler. `gitChanges`' staleness is the concrete illustration — the behaviour is
intentional (and arguably right), but nothing recorded that it was chosen.

### Evidence

**A. Live, at the real boundary (7 pins, 19 expectations).** Driving
`handleSpawnAgents` with a scripted child loop and capturing every fired hook:

```text
== completed ==
status: 'completed', agentType: 'child-agent', runId: 'child-run-1',
creditsUsed: 42, outputType: 'lastMessage', error_message: undefined
== error-form output ==
status: 'failed', outputType: 'error', error_message: 'No assistant turn was produced'
== thrown ==
status: 'failed', outputType: null, error_message: 'provider exploded'
parent report errorMessage: contains 'provider exploded'   (hook and caller agree)
SubagentStart: tool_result undefined, error_message undefined
```

Negative leg: removing the single `toolResult: outcome` argument from the
`SubagentStop` call site flips **3** of the 7 pins red (the three boundary pins;
the builder pins correctly stay green, because they do not depend on the call
site). Source restored, `grep -c "toolResult: outcome"` → 1.

**B. Negative legs, measured, all restored.**

```text
inject probeUnclassifiedField?: string into SessionState
  → common/src/types/session-boundary-fields.ts(155,15): error TS2344:
    Type 'string' does not satisfy the constraint 'never'.
inject probeUnclassifiedField?: string into ProjectFileContext
  → common/src/types/session-boundary-fields.ts(163,15): error TS2344:
    Type 'string' does not satisfy the constraint 'never'.
add fileContext.probeUnclassifiedField = 'x' to a run-start writer
  → census pin: classifyFileContextField('probeUnclassifiedField') → 'unclassified'
```

**B. Probe negative legs (the declarable gate).**

```text
run-start writer added for a carried field (gitChanges)
  → handoff-transport: FAIL — gitChanges did not cross its boundary cleanly  (exit 1)
cloneSessionState copies fileContext instead of sharing it
  → handoff-transport: FAIL — fileContext did not cross its boundary cleanly  (exit 1)
```

**Partitions.** `SessionState`: 2 keys (1 deep-copied, 1 shared-by-reference).
`ProjectFileContext`: 16 keys (10 refreshed-at-run-start, 6 carried-across-runs) —
plus an independent writer census over the two modules that assign
`fileContext.*`, which is what catches a new field arriving as a writer rather
than as a type key.

## Impact Assessment

### Affected Components

- **New module A:** `packages/agent-runtime/src/hooks/subagent-outcome.ts` —
  `SubagentOutcome`, `SubagentOutcomeStatus`, `buildSubagentOutcome`.
- **Wiring A:** `packages/agent-runtime/src/tools/handlers/tool/execute-subagent.ts`
  — the `SubagentStop` call site (the funnel shared by `spawn_agents` and
  `spawn_agent_inline`), outcome captured in a `finally` so a throw still reports.
- **New module B:** `common/src/types/session-boundary-fields.ts` —
  `SESSION_DEEP_COPIED`, `SESSION_SHARED_BY_REFERENCE`,
  `FILE_CONTEXT_REFRESHED_AT_RUN_START`, `FILE_CONTEXT_CARRIED_ACROSS_RUNS`,
  `classifySessionStateField`, `classifyFileContextField`, and the exhaustiveness
  + disjointness gates.
- **Probe:** `scripts/handoff-transport-check.ts` — extended from one boundary to
  three (299 lines, under the 300 ceiling).
- **Pins:** new `packages/agent-runtime/src/__tests__/subagent-stop-outcome.test.ts`
  (7) and `sdk/src/__tests__/session-boundary-transport.test.ts` (8, 81
  expectations).

### Risk Level

- [ ] Critical
- [x] High: (A) is the observability seam operator automation is meant to use, and
      a failure reported as a success is the one outcome a consumer cannot detect;
      (B) is the same silent-drift class FID-027 found live for governance fields,
      one boundary out.
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

**A.** Fill in the existing contract at the single funnel: compute the outcome on
every terminal branch (return, error-form return, throw) and pass it through the
payload builder the hook layer already has. Default to `failed` for "unknown", so
an unfinished branch fails loudly rather than reporting success. Deliberately
carry identity and shape, not content, so hook JSON stays bounded and cannot leak
a child's transcript.

**B.** Reuse FID-028's pattern verbatim — partition, reason-per-exemption,
`AssertNever` gates — and add the piece FID-028 could not have: behavioral pins
driven off the shipped lists, so a list that stops describing the code fails a
test. For `ProjectFileContext` the authoritative check is a writer census over the
two modules that actually assign `fileContext.*`, because a boundary can drift by
gaining a *writer* without gaining a type key.

### Steps

1. `hooks/subagent-outcome.ts` — `buildSubagentOutcome({agentType, result?, error?})`
   with the three endings and the unknown⇒failed default.
2. `execute-subagent.ts` — hold the outcome in a `let`, replace it from the loop
   result, replace it in the `catch` before rethrowing, and fire the hook with it
   in the `finally`.
3. `common/src/types/session-boundary-fields.ts` — both partitions, the reasons,
   the classifiers, the two exhaustiveness gates and two disjointness gates.
4. `sdk/src/__tests__/session-boundary-transport.test.ts` — identity/aliasing pins
   off `cloneSessionState`, live arms off `applyOverridesToSessionState` and
   `resolveSessionState`, and the writer census.
5. `packages/agent-runtime/src/__tests__/subagent-stop-outcome.test.ts` — the
   boundary pins plus the builder contract.
6. `scripts/handoff-transport-check.ts` — add the snapshot and run-start sections,
   reading the authority lists.
7. Prove every one of the above with a negative leg (recorded under Evidence).

### Accepted Risk

- **A.** Hook commands receive the outcome as JSON on stdin; a hook that wants the
  child's text still has to read the trace. Accepted deliberately — copying
  transcripts into every hook invocation is unbounded.
- **B.** The refreshed/carried split is described against the run boundary as it
  exists today (two writers). A third writer module would be caught by the census
  test and the probe, but only because both read the file list — a writer added
  somewhere neither list mentions (e.g. a plugin path) is outside the census.
  Stated rather than implied.
- **B.** `gitChanges` staleness on resume is now *declared*, not fixed: the FID
  records that a resumed session reports the diff as of its init. Changing it
  would change what the protocol's grounding evidence means, so it is a separate
  decision, not a silent side effect of this record.

## Verification

- A: 7 pins / 19 expectations through `handleSpawnAgents` → `executeSubagent`;
  negative leg (drop `toolResult: outcome`) → 3 red, restored.
- B: 8 pins / 81 expectations, every assertion driven by the shipped lists;
  three compile-time negative legs (`TS2344` for each partition, census
  `unclassified` for a new writer), all restored.
- Probe: `scripts/handoff-transport-check.ts` exit 0 across all three boundaries;
  two negative legs (carried-field writer; snapshot copying `fileContext`) → exit 1.
- Chain: `typecheck` 12/12 exit 0; `bun run test` exit 0 with **7567 pass / 0 fail**
  (15 new pins over FID-028's 7552); eslint 0 warnings; `lint:md` exit 0;
  `prettier --check .` PASS; `quality: PASS (1498 baselined files)`;
  `validate:repository` PASS; both scope probes PASS; `fid:verify --check` PASS.

## Verification Gates

- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/__tests__/subagent-stop-outcome.test.ts
- gate: test sdk/src/__tests__/session-boundary-transport.test.ts
- gate: probe scripts/handoff-transport-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:fb6eabb5dbb1a7747702db2953ef2b93c05e26598bb8051d3fbf2d60f806a5e5
- verified: 2026-09-19T21:57:33.375Z
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/__tests__/subagent-stop-outcome.test.ts: exit 0
- test sdk/src/__tests__/session-boundary-transport.test.ts: exit 0
- probe scripts/handoff-transport-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Iteration 1 — RED

**A.** `SubagentStop` fires with identity only: the three endings (returned,
error-form return, threw) are indistinguishable at the hook, and the contract it
is built on already had the fields to tell them apart (`tool_result`,
`error_message` — used by `PostToolUse`/`PostToolUseFailure`).

**B.** `SessionState` / `ProjectFileContext` have no completeness artifact:
injecting a field into either compiles clean, and a new `fileContext.x = …` writer
at run start compiles clean and silently refreshes a field declared carried.

### Iteration 2 — GREEN

`buildSubagentOutcome` + wiring at the single funnel; `session-boundary-fields.ts`
partitioning 2 + 16 keys with reasons and four gates; the SDK pins driven off the
shipped lists; the probe extended to three boundaries; 15 new pins.

### Iteration 3 — AUDIT / self-correction

- **Caught by writing the pin the naive way:** the first version of the hook pin
  built the outcome with `buildSubagentOutcome` directly. That would have passed
  against the *broken* code, because the defect was the call site, not the
  builder. Rewritten to drive `handleSpawnAgents` and capture the fired payload —
  which is what made the negative leg (3 red) meaningful.
- **Caught by the first test run:** the initial harness returned no fired hooks at
  all (no `SubagentStop` captured). Rather than relax the assertion, a throwaway
  probe compared against the repo's existing spawn tests and found the fixture was
  the problem (a `fileContext` missing the shape `validateAndGetAgentTemplate`
  requires). The pins now use the shared `mockFileContext` like their neighbours.
- **Caught by typecheck, not by reading:** `HookInputData` is exported from
  `hooks/types.ts`, not `hooks/engine.ts` — an import that looked right and only
  the compiler contradicted.
- **Caught by measuring the census:** the first design classified `fileContext`
  fields by *who refreshes them* and would have needed a heavy `resolveSessionState`
  fixture for four of them. Splitting the runtime pins by writer (empty-override
  `applyOverridesToSessionState` for the project-input half, a real
  `resolveSessionState` call for the run-option half) proved all ten without a
  tree-sitter fixture.
- **Caught by the line ceiling:** the extended probe landed at 317 lines, then 307
  after a first trim, against the 300 ceiling. Reduced to 299 by removing a
  redundant double-print and inlining a formatting helper — not by compressing
  comments.

### Missed Questions

1. **Should `SubagentStop` carry the child's output text?** No — decided against,
   with the reason written into the module header: the payload is stdin JSON for
   hook commands, so a transcript would be unbounded and would be a content-leak
   path. Consumers that need text read the run trace.
2. **Is the `gitChanges`-not-refreshed-on-resume behaviour a defect?** Not
   established here; it is now *declared* (`FILE_CONTEXT_CARRIED_ACROSS_RUNS`),
   citing `sdk/src/run-state/initial-state.ts:121`. Changing it would change what
   the protocol's grounding evidence means, so it needs its own decision — this
   record removes the "nobody noticed" state, not the behaviour.
3. **Should the partitions move next to the FID-028 one?** The `AgentState`
   partition lives in `agent-runtime` because it governs a constructor there;
   these two govern types owned by `common` and boundaries owned by `sdk`, so the
   enumeration sits with the types and the behavioral pins sit with the writers.
   Documented in the module header so the split is a decision, not an accident.
4. **What happens to a field that is neither refreshed nor carried but has no
   consequence?** It still needs a classification: `CARRIED_ACROSS_RUNS` requires
   a reason, and "no consequence" is not one — the six carried entries each state
   why carrying is correct.

### Code Verification Evidence

- [x] **Files referenced in Affected Components exist.**
      `packages/agent-runtime/src/hooks/subagent-outcome.ts` (new),
      `packages/agent-runtime/src/tools/handlers/tool/execute-subagent.ts`,
      `common/src/types/session-boundary-fields.ts` (new),
      `packages/agent-runtime/src/__tests__/subagent-stop-outcome.test.ts` (new),
      `sdk/src/__tests__/session-boundary-transport.test.ts` (new),
      `scripts/handoff-transport-check.ts`.
- [x] **Implementation matches the Proposed Solution.**
      `grep -n "buildSubagentOutcome" execute-subagent.ts` → the import, the
      unknown⇒failed default, the result assignment, the catch assignment, and
      `toolResult: outcome` at the `SubagentStop` call site;
      `grep -n "AssertNever\|classifySessionStateField\|classifyFileContextField"
      common/src/types/session-boundary-fields.ts` → the classifiers and all four
      gates; `grep -n "WRITER_FILES\|fileContext\." scripts/handoff-transport-check.ts`
      → the census over the two real writers.
- [x] **Typecheck/tests/lint pass with pasted tool output.** Receipt below
      (7/7 LIVE): three workspace typechecks, both declared test paths, the probe,
      and `quality` — each exit 0. Chain level: `typecheck` 12/12 exit 0;
      `bun run test` exit 0 with **7567 pass / 0 fail**; `eslint . --max-warnings 0`
      0; `lint:md` exit 0; `prettier --check .` PASS; `validate:repository` PASS;
      `scope-register-check` PASS (0 issues); `scope-guard-check` PASS (0 issues).
- [x] **Production call-graph evidence is present for the new wiring.**
      `handleSpawnAgents` → `runSingleSubagent` → `executeSubagent` (unchanged
      path) → `getHookEngine(projectRoot).fireAndForgetTrigger(...)` — exercised
      live by the pins, which capture the engine calls the production function
      makes (`fireAndForgetTrigger` spied on the real `HookEngine.prototype`), and
      by the probe for the partition side. The negative legs above prove each
      assertion is load-bearing rather than decorative.
- [x] **FID status reflects the actual implementation state.** `verified` at the
      time of this evidence — the module, the wiring, both partitions, the
      extension of the probe and all 15 pins are in the tree, receipt 7/7 LIVE
      below — then advanced to `closed` + archived on operator directive, with
      the receipt re-stamped at the archived path (see Resolution).

## Resolution

- **Closed Date:** 2026-09-19 21:56 UTC (closed with the commit SHA pending
  operator git execution, G2 withheld; file:line + grep evidence recorded
  instead, per the FID Lifecycle rule for `closed`)
- **Fix Description:** **(A)** `hooks/subagent-outcome.ts` builds a
  `SubagentOutcome` (`status`, `agentType`, `runId`, `creditsUsed`, `outputType`,
  `errorMessage`) and `executeSubagent` — the single funnel shared by
  `spawn_agents` and `spawn_agent_inline` — sets it on every terminal branch:
  from the loop result, from the `catch` before rethrowing, and in the `finally`
  that fires `SubagentStop`. The default before any branch is the truthful
  "unknown ⇒ failed", and `SubagentStart` stays outcome-free. The payload carries
  identity and shape only, never transcript content (hook JSON is stdin for hook
  commands). **(B)** `common/src/types/session-boundary-fields.ts` classifies
  `SessionState` against the snapshot boundary (2 keys: `mainAgentState`
  deep-copied, `fileContext` shared by reference with its reason) and
  `ProjectFileContext` against the run boundary (16 keys: 10 refreshed with
  write-site citations, 6 carried with a reason each, including `gitChanges`
  declared as captured-at-init and not refreshed on resume), with
  exhaustiveness + disjointness `AssertNever` gates; 8 pins driven off the shipped
  lists, a **writer census** over the two modules that assign `fileContext.*`, and
  `scripts/handoff-transport-check.ts` extended to ask all three boundary
  questions. Every gate was proven by a negative leg recorded under Evidence, with
  all sources restored.
- **Tests Added:** Yes —
  `packages/agent-runtime/src/__tests__/subagent-stop-outcome.test.ts` (7 pins,
  19 expectations, driven through the real `handleSpawnAgents` →
  `executeSubagent` boundary) and
  `sdk/src/__tests__/session-boundary-transport.test.ts` (8 pins, 81
  expectations, driven off the shipped classification lists).
- **Verification Evidence:** receipt below (seven gates, live) plus the negative
  legs under Evidence: dropping `toolResult: outcome` → 3 pins red; a field
  injected into `SessionState` → `error TS2344` at `session-boundary-fields.ts:155`
  and into `ProjectFileContext` → at `:163`; a new run-start writer → census
  `unclassified`; a writer on a carried field (`gitChanges`) and a copied
  `fileContext` → `handoff-transport-check` exit 1. Chain:
  `typecheck` 12/12 exit 0; `bun run test` exit 0 with **7567 pass / 0 fail**
  (15 new pins over FID-028's 7552); eslint 0; `lint:md` exit 0;
  `prettier --check .` PASS; `quality: PASS (1498 baselined files)`;
  `validate:repository` PASS; both scope probes PASS; `fid:verify --check` PASS;
  probe exit 0 across all three boundaries.
- **Archived:** 2026-09-19 21:56 UTC — moved to `dev/fids/archive/`; receipt
  re-stamped live at the archived path (7/7 gates)

## Lessons Learned

A boundary that reports *that* something crossed is not the same as one that
reports *what* crossed, and the cheaper half of the fix is usually already built:
`SubagentStop` already accepted an outcome, and `cloneSessionState`'s behaviour
was already correct — what was missing was a way for anyone (or any compiler) to
know it. When a type is copied, shared, or partially rewritten at a boundary,
enumerate it there; a behaviour that is merely *intended* is indistinguishable
from an oversight until someone writes it down.
