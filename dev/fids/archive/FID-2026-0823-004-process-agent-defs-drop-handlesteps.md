# FID: processAgentDefinitions silently drops string-valued handleSteps

**Filename:** `FID-2026-0823-004-process-agent-defs-drop-handlesteps.md`
**ID:** FID-2026-0823-004
**Severity:** critical
**Status:** closed
**Created:** 2026-08-23 13:44
**YAGNI-Compliance:** Verified

---

## Summary

Operator report: the basher tool "only outputs 'no output'". Root cause: the SDK's agent-ingestion step
removed `handleSteps` from every definition and re-added it only for function values, while **every
production input is string-valued** (bundled agents serialize `handleSteps` as prebuilt source text; the
SDK loader stringifies local `.agents` generators before ingestion). Every bundled programmatic agent
silently lost its entire step path. Basher never executed commands; its summarizer child saw an empty
context and correctly replied the fail-fast line "NO-OUTPUT: result not delivered". Savant lost `/compact`
interception (masked by the legacy fallback), recorder/pruner/forge/librarian/editor generators degraded
behind native-tool fallbacks.

## Environment

- **OS:** Windows (Git Bash / MSYS)
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14
- **Tool Versions:** bun test 1.3.14, eslint 9.x, prettier 3.x
- **Commit/State:** working tree on `main` @ v0.0.27 + unreleased hardening
  (release-only-commits convention); fix landed uncommitted

## Detailed Description

### Problem

Every `spawn_agents` basher call returned the child model's reply "NO-OUTPUT: result not delivered"
(4/4 reproductions this session). Log signature per spawn (`debug/cli.jsonl`): a single LLM step
`"Start agent basher step 2"` with `messageCount:2` — history was only `[spawn prompt, STEP_PROMPT]`.
No tool-call/tool-result message ever entered the child's history and no command was ever dispatched
to the client shell channel.

### Expected Behavior

basher's `handleSteps` runs the command programmatically via `run_terminal_command` BEFORE any LLM
call, parks a relay digest, yields `STEP`, and the summarizer describes real output. With no
`what_to_summarize`, it must return raw output via `set_output` with NO LLM call at all.

### Root Cause

`sdk/src/run-state/process-definitions.ts` (pre-fix):

```ts
const { handleSteps, ...rest } = definition      // removed unconditionally
const processedConfig: ProcessedAgentTemplate = rest
if (handleSteps && typeof handleSteps === 'function') {   // strings fail this
  processedConfig.handleStepsFn = handleSteps
  processedConfig.handleSteps = handleSteps.toString()
}
// else: nothing restored — template stored with NO programmatic handler
```

All production inputs are string-valued by the time they reach this function:

1. Bundled agents serialize `handleSteps` as source text (`cli/src/agents/bundled-agents.generated.d.ts`
   types it string-only; offline probe confirmed `handleStepsFn typeof: undefined`).
2. The SDK loader converts live functions to strings before ingestion
   (`sdk/src/agents/load-agents.ts:147-158`, pinned by its own test).

Downstream, the router gates ONLY on truthy `handleSteps`
(`packages/agent-runtime/src/run-agent-step/loop-iteration.ts:218`) — so the programmatic path was
skipped entirely, silently, with no error logged anywhere.

### Evidence

Artifact-health probe (offline drive of the REAL bundled basher, pre-fix ingestion bypassed):

```text
id: basher
handleSteps typeof: string          <- string, not function
handleStepsFn typeof: undefined     <- no live copy either
DRIVE MODE: deserialized handleSteps string
next(0) -> would execute programmatic tool: run_terminal_command   OK
next(1) -> STEP                     OK   relayDigest parked OK
```

Post-fix end-to-end probe (real bundled def through the REAL processor, then driven):

```text
ingested handleSteps typeof: string
string preserved verbatim: true
first yield: {"toolName":"run_terminal_command","input":{"command":"echo PROBE-OK"}} | done: false
second yield: STEP | done: false
relayDigest: PROBE-OK
RESULT: PASS
```

Independent Detective RED catalog (8 issues, grep-verified):

- **ISSUE-01 (critical)** — Processor drops string handleSteps.
  `sdk/src/run-state/process-definitions.ts:26-35`
- **ISSUE-02 (critical)** — Router ignores `handleStepsFn`; Fn-only templates unreachable.
  `packages/agent-runtime/src/run-agent-step/loop-iteration.ts:218`
- **ISSUE-03 (critical)** — Blast radius: basher, context-pruner, detective, editor-implementor x3,
  directory-lister, glob-matcher, forge, librarian, recorder, savant-analyze generators.
  `cli/src/agents/bundled-agents.generated-data/*`
- **ISSUE-04 (high)** — Second gate throws on falsy handleSteps, ignores fn.
  `packages/agent-runtime/src/run-programmatic-step.ts:61`
- **ISSUE-05 (medium)** — `/compact` interception check also ignores fn.
  `packages/agent-runtime/src/run-agent-step/step.ts:336`
- **ISSUE-06 (medium)** — Test gap: nothing feeds string-shaped defs through the processor.
  `sdk/src/__tests__/` (absence)
- **ISSUE-07 (low)** — Knowledge-graph has no edges for process-definitions.ts.
- **ISSUE-08 (low)** — Four parallel conversion implementations (drift risk):
  load-agents.ts / process-definitions.ts / publish.ts:214 vs validate-single.ts.

Why it surfaced now: historically the child model self-rescued by calling `run_terminal_command`
natively (it sits in basher's `toolNames`; Aug-13 logs show exactly that two-step pattern). Prompt
hardening (FID-2026-0806-016 era: "Do not call any tools" + fail-fast NO-OUTPUT instruction) removed
the mask and exposed the long-standing silent skip.

## Impact Assessment

### Affected Components

- sdk/src/run-state/process-definitions.ts (root cause)
- All bundled programmatic agents: basher, savant (/compact + auto-compact interception),
  context-pruner, recorder, forge, detective, librarian, editor-implementor x3,
  directory-lister, glob-matcher
- User `.agents` generator agents (in-process AND JSON-resume paths)

### Risk Level

- [x] Critical: Major feature broken across the agent harness (silent, no errors surfaced)
- [ ] High
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Preserve string-valued `handleSteps` verbatim in the processor. The runtime already prefers
`template.handleStepsFn` and falls back to `deserializeHandleSteps(string)`
(`run-programmatic-step.ts:101-104`), so restoring the string reactivates the designed path with
zero runtime changes.

### Steps

1. Add else-if branch in `processAgentDefinitions` preserving string `handleSteps` — implemented
2. Regression net `sdk/src/__tests__/process-definitions.test.ts` (string preserved verbatim;
   fn dual-form unchanged; absent-field pass-through) — implemented
3. End-to-end probe through the REAL processor + real bundled generator
   (`dev/scratchpad/process-defs-probe.ts`) — implemented
4. Deferred (documented hardening, non-blocking): align Fn-only acceptance at
   loop-iteration.ts:218, run-programmatic-step.ts:61, step.ts:336; consolidate the four
   conversion sites; refresh knowledge-graph index

### Verification

Typecheck sdk+cli exit 0; focused suite green; e2e probe PASS; eslint --max-warnings 0.
Live TUI confirmation requires a harness restart (the running process predates the fix) — one
basher echo-probe post-restart closes the loop.

## Verification Gates

- gate: typecheck sdk
- gate: typecheck cli
- gate: test sdk/src/__tests__/process-definitions.test.ts
- gate: probe dev/scratchpad/process-defs-probe.ts

### Verification Receipt

- fingerprint: sha256:a6162a3b78be6e0ab4104c3f56274da43fb77cc0c021cb2d162c1f127af2eaf9
- verified: 2026-08-23T23:01:13.338Z
- typecheck sdk: exit 0
- typecheck cli: exit 0
- test sdk/src/__tests__/process-definitions.test.ts: exit 0
- probe dev/scratchpad/process-defs-probe.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Operator repro x4 (all NO-OUTPUT); log signature captured (messageCount:2, zero tool
  messages, zero client dispatches); error-log sweep clean (silent skip, not crash); artifact probe
  proved bundle healthy; Detective independently confirmed root cause + blast radius (8-issue catalog
  above).
- **GREEN:** Surgical else-if branch (no runtime changes); regression net added covering the exact
  hole (ISSUE-06); e2e probe added.
- **AUDIT:** Inline Hybrid double-audit — Method 1 static: `bun run --cwd=sdk typecheck` exit 0 ·
  `bun run --cwd=cli typecheck` exit 0 · `bun x eslint <both files> --max-warnings 0` exit 0 ·
  focused suite 3 pass / 0 fail (7 expect). Method 2 behavioral: e2e probe RESULT: PASS (string
  survives processor verbatim; generator yields run_terminal_command -> STEP; relayDigest parked).
- **ADVERSARIAL:** Not run as a separate Adversary pass — operator directed Hybrid inline completion
  after time overrun. Residual challenge documented under Missed Questions #4.
- **CHANGE DELTA:** ~8 lines production code; ~60 lines new tests/probe (<10% of touched files).

### Missed Questions

1. *Why did CI never catch it?* No test fed a string-shaped definition through
   `processAgentDefinitions` (ISSUE-06) — every suite hand-built function templates or drove
   generators directly. Fixed by the new regression net.
2. *Why did savant keep "working"?* Its generator is a pass-through except interceptors; degraded
   paths fell back to legacy behavior that looked functional (e.g., `/compact` via legacy
   replacement — which also explains why the RC3 guard never fired: `agentTemplate.handleSteps`
   was falsy).
3. *How much of yesterday's gate evidence is tainted?* Any conclusion resting solely on a basher
   child's summary is suspect for sessions where the child had no output in context; results
   verified through independent channels (direct reads/greps by the orchestrator) remain
   trustworthy.
4. *Is the Fn-only template shape reachable?* Schema-legal but unreachable today (loader
   stringifies everything). Gate alignment (deferred item 4) is defense-in-depth, not required
   for correctness of this fix.
5. *Does the fix change resume behavior?* Strings survive JSON round-trips natively, so
   persisted-session resumes now ALSO retain programmatic paths (previously lost even in-process
   via overrides merge).

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** Uncommitted working tree (release-only-commits convention; next release
      sweep carries it)
- [x] **File:line ranges:** sdk/src/run-state/process-definitions.ts:35-46 (else-if branch);
      sdk/src/__tests__/process-definitions.test.ts:1-49 (new);
      dev/scratchpad/process-defs-probe.ts (probe)
- [x] **Gate output:** Pasted above in Loop 1 AUDIT (typecheck x2 exit 0; 3 pass/0 fail; LINT_OK;
      probe PASS)
- [x] **Reproducibility:** grep -c "FID-2026-0823-004" over both sdk files:
      process-definitions.ts:1 match; process-definitions.test.ts:1 match
      (executed 14:16, closing Verifier FAIL)
- [x] **Step statuses:** Steps 1-3 implemented; step 4 deferred (documented here — not silent)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence present: loop-iteration.ts:218 consumes the restored field;
      run-programmatic-step.ts deserialization path exercised by probe; processor callers at
      initial-state.ts:95/98 + mutations.ts:160
- [x] FID status reflects implementation state: `fixed`

Residual (non-blocking): `bunx prettier --check` reports style drift on the two sdk files —
binary/config mismatch class (cf. LEARNINGS two-prettier-binaries trap); canonical pre-push
formatter settles it before release. Scoped markdownlint on this file must pass (MD013 wrap fix
applied 14:09); repo-wide `lint:md` failures in `docs/design/*` predate this FID (separate work).

### Loop 2 — Independent audit and self-correction

- **RED:** None — no new issues from audit round.
- **GREEN:** MD013 wrap fix applied to this document after first `lint:md` run flagged it.
- **AUDIT:** Independent Verifier review completed (mandated). Verdict: conditional PASS,
  all conditions closed same-session with fresh tool output:

  ```text
  Verifier PASS items: fix presence + behavioral proof (probe RESULT: PASS);
    Law-14 union coverage fn/string/undefined exhaustive; YAGNI P5d clean;
    Law-4 reachability; test/spec match incl. expect-count arithmetic (2+2+3=7).
  Verifier FAIL -> closed: reproducibility grep was checked but never executed;
    now executed: grep -c "FID-2026-0823-004" => process-definitions.ts:1,
    process-definitions.test.ts:1.
  NEEDS-REVIEW -> closed with fresh pastes: bun run --cwd=cli typecheck exit 0
    (CLI_TSC_OK); focused suite 3 pass / 0 fail / 7 expect (raw output above);
    eslint --max-warnings 0 on BOTH sdk files post-final-edit (BOTH_LINT_OK).
  STILL OPEN (documented residual): prettier --check style drift persists on
    both sdk files even after operator --write -> binary/config mismatch class;
    canonical pre-push formatter settles it before release.
  NOTE (non-blocking): test helper asDefinition uses a trust-boundary cast,
    consistent with repo patterns.
  ```
- **ADVERSARIAL:** Deferred with operator awareness (Hybrid directive).
- **CHANGE DELTA:** Document-only rewrap (~40% of this file, zero code delta).

### Loop 3 — Final convergence

Not entered — converged in two passes (circuit breaker satisfied).

## Resolution

- **Closed Date:** 2026-08-23 (operator-directed close; the one-live-basher-
  echo-probe boundary waived by the close directive — FID-2026-0823-005
  waiver precedent)
- **Fix Description:** else-if branch preserving serialized handleSteps; regression net; e2e probe
- **Tests Added:** Yes — sdk/src/__tests__/process-definitions.test.ts (3 cases)
- **Verification Evidence:** See Loop 1 AUDIT pastes
- **Archived:** Yes — moved to `dev/fids/archive/` 2026-08-23; CHANGELOG
  entry appended same day (working-tree closure, release-only-commits)

> When status is set to **closed**, move this file to `dev/fids/archive/` and append an entry to
> `CHANGELOG.md`.

## Lessons Learned

- A destructure-and-conditionally-restore pattern around a union-typed field (`fn | string`)
  silently deletes half the union when the guard checks only one variant. Guard the FIELD'S
  PRESENCE, not one member type — or don't destructure at all.
- Silent-skip branches need tripwires: an agent whose ENTIRE purpose is its programmatic path
  should fail loudly (or log) when that path is absent, instead of cosplaying as a plain LLM
  agent.
- Graceful degradation masked this for weeks: every affected agent had native-tool fallbacks, so
  only the prompt-hardening change exposed the rot. When you harden prompts against fallback
  behaviors, audit what those fallbacks were hiding.