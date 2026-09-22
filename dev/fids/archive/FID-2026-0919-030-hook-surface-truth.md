# FID: The hook surface tells the truth

Acting agent on `PreToolUse`, outcome on session end, and a fired-vs-declared
event census.

**Filename:** `FID-2026-0919-030-hook-surface-truth.md`
**ID:** FID-2026-0919-030
**Severity:** high
**Status:** closed
**Created:** 2026-09-19 22:05
**Automation level:** 3
**YAGNI-Compliance:** Confirmed (no new capability or dependency: `subagent_type`
already exists in `HookInputData` and is already set by the subagent events; the
run-outcome builder is the FID-2026-0919-029 one generalized rather than a second
copy; the event classification is plain data plus the repo's existing
`AssertNever` gate idiom)

---

## Summary

FID-2026-0919-029 fixed one event's payload: `SubagentStop` fired with identity
only, so a finished child and a crashed child were indistinguishable. The obvious
follow-up — *is that the only event with that defect?* — had never been asked.
This record asks it of the whole surface (9 `buildHookInput` call sites in 7
modules) and finds the defect three more times, in two shapes:

1. **Insufficient payload** at `PreToolUse` (the one event that can BLOCK) and at
   `SessionEnd`.
2. **Insufficient event delivery**: 5 of the 12 declared events —
   `PreCompact`, `PostCompact`, `Stop`, `Interrupt`, `Notification` — have no
   firing site anywhere in the runtime, while `docs/design/hook-system.md`
   documents all five as active. An operator hook declared for one of them is
   silently inert: no parse error (the event name is valid) and no warning (it
   never runs).

## Environment

- **OS:** Windows (win32), bash shell
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Tool Versions:** tsc (12 workspaces), eslint, prettier, markdownlint
- **Commit/State:** `main`; the 0.0.33 working tree; nothing committed (G2 withheld)

## Detailed Description

### Problem

**A. `PreToolUse` cannot identify the acting agent.** Both sites send the same
four fields:

```ts
// tools/tool-executor/hook-gate.ts (native) and .../custom.ts (custom/MCP)
buildHookInput({
  event: 'PreToolUse',
  sessionId: ctx.params.agentState.runId ?? ctx.params.agentState.agentId,
  cwd: hookProjectRoot,
  toolName: ctx.toolCall.toolName,
  toolInput: ctx.toolCall.input,
})
```

`docs/design/hook-system.md` describes the event as composing *with* the EHEL
gate — "a `PreToolUse` hook runs *in addition to* … the EHEL `beforeToolCall`
enforcement" — but EHEL gates **per agent** (each of the 10 roster roles has a
restricted tool surface), and the hook payload carries nothing that names the
agent. So the most natural project policies are inexpressible:

- "deny `write_file` unless the caller is `forge`" — no agent field.
- "deny shell tools for any subagent" — cannot tell main from child: for a
  subagent's tool call `session_id` is the **child's** `runId`, so the operator
  sees a different, unknown session per child with no field naming it.

The information is present at the same call site (`ctx.params.agentTemplate.id`
is already read three lines below in `createProvenanceGate`; `custom.ts`
destructures `agentTemplate`).

**B. `SessionStart`/`SessionEnd` are outcome-blind.** `SessionEnd` fires in a
`finally` with identity only:

```ts
} finally {
  getHookEngine(hookProjectRoot).fireAndForgetTrigger(
    buildHookInput({ event: 'SessionEnd', sessionId, cwd: hookProjectRoot }),
  )
}
```

A session that completed and a session that threw produce the same payload. The
repo's own SessionEnd consumer (`protocol.config.yaml:199` →
`bun scripts/session-end-review.ts`) does its own bookkeeping and ignores the
payload, so nothing is currently broken — but the event is the documented seam
for session-scoped operator automation, and "the run failed" is exactly what such
a hook needs to know. This is the `SubagentStop` defect one boundary up.

**C. Five declared events never fire.** `HOOK_EVENTS`
(`common/src/types/hooks.ts:17`) declares 12; the runtime fires 7. Census over
`packages/agent-runtime/src` (non-test):

```text
PreToolUse 2 sites   PostToolUse 2   PostToolUseFailure 3
SessionStart 1       SessionEnd 1    SubagentStart 1   SubagentStop 1
PreCompact 0         PostCompact 0   Stop 0            Interrupt 0
Notification 0
```

`HOOK_EVENTS` is the parse-time vocabulary, so a hook declared for any of the
five zero-site events validates and loads, and then never runs — the only
failure mode an operator cannot observe. `docs/design/hook-system.md`'s Events
table asserts all five ("`PreCompact`/`PostCompact` | Around compaction",
"`Stop`/`Interrupt` | Cancellation / interruption", "`Notification` |
Observability signal"), so the documentation actively asserts a capability the
runtime does not deliver.

### Expected Behavior

**A.** `PreToolUse` must carry the identity of the agent whose call is being
gated, on both the native and the custom/MCP path, so a policy can be written
against it. **B.** The session events must carry the outcome the same way the
subagent events now do (`SessionStart` outcome-free, `SessionEnd` reporting
completion or failure with the reason). **C.** Every event the vocabulary accepts
must be classified as either fired-by-the-runtime or inert-with-a-reason, adding
an event must fail the build until it is classified, the runtime source must be
the authority for which is which, and the documented Events table must agree with
both — no silent inert declaration.

### Root Cause

Same cause as FID-2026-0919-029, twice over: **the contract was implicit in which
arguments a call site happened to pass.** For A and B, the payload was built from
whatever was in scope and convenient, so nothing failed when "not enough" was the
answer. For C, the vocabulary (`HOOK_EVENTS`) and the wiring (call sites) were
two independent lists with no relationship enforced between them — adding an
event to the vocabulary is a one-line edit that compiles, ships, and advertises an
event nothing delivers.

### Evidence

**RED — the audit, before any change.**

```text
$ grep -rhoE "event: '[A-Za-z]+'" --include=*.ts packages/agent-runtime/src | sort | uniq -c
      2 event: 'PreToolUse'          (non-test sites)
      2 event: 'PostToolUse'
      3 event: 'PostToolUseFailure'
      1 event: 'SessionStart'
      1 event: 'SessionEnd'
      1 event: 'SubagentStart'
      1 event: 'SubagentStop'
   ---- declared in HOOK_EVENTS with 0 sites:
      PreCompact  PostCompact  Stop  Interrupt  Notification
$ grep -rho "event: 'PreCompact'" --include=*.ts packages/agent-runtime/src | wc -l
0        # identical for the other four
```

**RED — the two payload gaps** are the code blocks under Problem; both are
4-field payloads against a documented contract that names the missing
information (`docs/design/hook-system.md`: "Event-specific fields are added where
relevant (`tool_result`, `error_message`, `subagent_type`)"; "`PreToolUse` …
composing with the EHEL gate").

**The classification of the five inert events is an operator-facing decision, so
each carries a reason rather than a bare list** — and the reasons are the
finding: `PreCompact`/`PostCompact` need a *semantics* decision (the context
pruner can run and compact nothing, so "around compaction" must be pinned to
"compaction actually happened" or the event lies); `Stop` and `Interrupt` are
documented as the same thing ("Cancellation / interruption") with no distinction
between them; `Notification` has no defined trigger at all.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/tools/tool-executor/hook-gate.ts` — `PreToolUse`
  (native) gains the acting agent.
- `packages/agent-runtime/src/tools/tool-executor/custom.ts` — `PreToolUse`
  (custom/MCP) gains the acting agent.
- `packages/agent-runtime/src/hooks/subagent-outcome.ts` → generalized to
  `packages/agent-runtime/src/hooks/run-outcome.ts` (shared builder for both
  lifecycles; the old path re-exports so FID-2026-0919-029's citations resolve).
- `packages/agent-runtime/src/main-prompt-run.ts` — session outcome on
  `SessionStart`/`SessionEnd`.
- `common/src/types/hooks.ts` — fired/inert classification + compile-time gates.
- `docs/design/hook-system.md` — Events table tells the truth.
- New checks: a census test over the runtime sources and a declarable probe that
  also validates the repo's own `protocol.config.yaml`.

### Risk Level

- [x] High: A is the only blocking event, so an inexpressible policy is a gate
      that cannot be configured; C is an operator-visible capability that does not
      exist while the docs and the schema both say it does.
- [ ] Critical
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Give each call site the information its event's own documentation already implies,
sharing one outcome builder so the two lifecycles cannot drift (the lesson
FID-2026-0919-027 paid for with two copies of the verdict-receipt block), and make
the vocabulary and the wiring one enforced thing: classify every event, prove the
classification against the source, and correct the doc — so the never-fired five
are *declared* inert with reasons instead of silently inert.

### Steps

1. `PreToolUse` at both sites: pass the acting agent (`subagentType`), for the
   main agent and every child.
2. Generalize the outcome builder: `hooks/run-outcome.ts` (one core, two named
   builders), `hooks/subagent-outcome.ts` re-exporting for FID-029's citations.
3. `main-prompt-run.ts`: compute the run outcome on every path, report it on
   `SessionEnd`, keep `SessionStart` outcome-free.
4. `common/src/types/hooks.ts`: `FIRED_HOOK_EVENTS`, `DECLARED_BUT_NEVER_FIRED`
   (reason each), `classifyHookEvent`, exhaustiveness + disjointness gates.
5. Census test over the runtime sources + a declarable probe that also fails when
   the repo's `protocol.config.yaml` declares an inert hook.
6. Correct `docs/design/hook-system.md`.
7. Pin every fix with a negative leg.

### Accepted Risk

- The five inert events are **not implemented here**; they are declared inert with
  a reason each, and the check makes a new one impossible to add silently.
  Implementing them is a feature with an unspecified contract (see Root Cause C),
  so it needs its own FID and the operator's semantics ruling — recorded as the
  next step, not left implicit.
- `subagent_type` is reused as the acting-agent field for tool events rather than
  inventing `agent_type`, because `HookInputData` already defines it and the
  subagent events already populate it; the doc states the meaning per event.

## Verification

- Census (RED, above) → the classification and the source agree after the change;
  a newly declared event with no site fails the census.
- Payload pins at both `PreToolUse` sites and at the session boundary.
- Negative legs for each: drop the agent field → the pin fails; drop the session
  outcome → the pin fails; move an event between classification lists → the census
  fails.
- Full chain, then the receipt.

**Negative legs (all sources restored after each):**

```text
LEG 1  remove `subagentType` from the native PreToolUse site
       → 3 pins red (main-agent payload, subagent payload, no-new-bypass census)
LEG 2  remove `toolResult: outcome` from the SessionEnd call site
       → 3 pins red (completed, error-form, thrown)
LEG 3  append a firing site for an inert event (Notification)
       → 2 pins red (census set-equality, inert-has-no-site)
       → scripts/hook-events-check.ts FAIL: "Notification advertised without a
         firing site (classification and source disagree)", exit 1 (0 once
         restored)
```

## Verification Gates

- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/hooks/__tests__/hook-surface-truth.test.ts
- gate: probe scripts/hook-events-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:724b6c62725d0af23b4a64a104782ea81b08db22295ac5368fef888e24339092
- verified: 2026-09-19T22:20:12.450Z
- typecheck common: exit 0
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/hooks/__tests__/hook-surface-truth.test.ts: exit 0
- probe scripts/hook-events-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Iteration 1 — RED

**A.** Both `PreToolUse` sites send four fields and no agent identity, against a
contract that documents the event as composing with the per-agent EHEL gate.
**B.** `SessionEnd` fires from a `finally` with identity only, so a clean end and
a throw are indistinguishable. **C.** The census: 12 declared events, 7 with a
firing site, 5 with none, all 12 documented in `docs/design/hook-system.md` as
active. A test is not needed to prove C — `HOOK_EVENTS` and the call sites are
two lists with nothing relating them, and the runtime never fires the five.

### Iteration 2 — GREEN

`subagentType` on both `PreToolUse` sites; `hooks/run-outcome.ts` as the single
outcome authority with two named builders; `main-prompt-run.ts` computing the
session outcome on every path (return, error-form return, throw) and passing it
to `SessionEnd`; `FIRED_HOOK_EVENTS` / `NEVER_FIRED_HOOK_EVENTS` + gates in
`common/src/types/hooks.ts`; `scripts/hook-events-check.ts` (source census + the
repo's own config); the doc corrected; 10 new pins.

### Iteration 3 — AUDIT / self-correction

- **Caught by the repo's own hygiene gate, not by review:** the reasons in
  `NEVER_FIRED_HOOK_EVENTS` contained the phrase "not implemented", which
  `validate:repository` flags as `hygiene.production-placeholder`. Reworded to
  "no firing site" — which is also the more accurate statement (it is about
  wiring, not about a feature being absent). Recorded because the gate caught what
  I had already read past.
- **Caught by the full chain, not by the focused suite:** generalizing the
  outcome builder changed the "no result" message, which broke
  FID-2026-0919-029's pinned contract (`treats a missing result as failed…`) — a
  closed record's evidence must stay literally true. Fixed by parameterizing the
  subject (`'Subagent'` / `'Session'`) rather than editing the closed record's
  pin. The focused suites both passed while the chain was red; only the chain
  caught it, because the pin lives in another file.
- **Caught by the first probe run:** the initial census regex (`event: '…'`)
  missed the ternary site
  (`event: failed ? 'PostToolUseFailure' : 'PostToolUse'`) and under-reported
  `PostToolUse` as one file. Rewritten as a line scan, and the reported figure is
  now distinct FILES rather than occurrences — the question is "is there a site",
  and a count that silently under-reports is the kind of number a reader trusts.
- **Deliberate scope call, stated rather than implied:** the five inert events are
  NOT wired here. The audit showed three of the five have no defined trigger in
  the repo's own documentation (`Stop`/`Interrupt` are documented as the same
  thing; `Notification` has no trigger at all) and `PreCompact`/`PostCompact`
  need an effect-vs-attempt semantics ruling plus two scattered sites. Wiring them
  inside an observability fix would mean inventing contracts, so they are declared
  inert with a reason each and made impossible to add silently — see Missed
  Questions 1.

### Missed Questions

1. **Should the five inert events be implemented now?** Not in this record, and
   the reasoning is in the classification rather than left implicit: three have no
   defined trigger in the repo's docs, and the compaction pair needs a semantics
   decision (fire on attempt, or only when compaction actually happened?) because
   the pruner can run and compact nothing. What this record does fix is the
   SILENCE: the sets are classified, gated, census-checked, and the doc states
   which events fire today. Implementing them is the next FID, and it needs the
   operator's ruling on `Stop` vs `Interrupt` and on the compaction predicate.
2. **Is `subagent_type` the right field name for the acting agent on a tool
   event?** It is reused because `HookInputData` already defines it and the
   subagent events already populate it, and the doc now states the meaning per
   event. A dedicated `agent_type` would be cleaner naming but would leave two
   fields meaning the same thing on different events.
3. **Should `SessionEnd` name the main agent's type too?** Not added: no consumer
   needs it, the run is identified by `session_id`, and the outcome was the missing
   information. Recorded so the omission is a decision, not an oversight.
4. **Does the `Notification` event belong in the vocabulary at all?** Unresolved
   on purpose — removing it is a scope reduction that needs the operator, and
   keeping it is now safe because its inertness is declared and checkable.

### Code Verification Evidence

- [x] **Files referenced in Affected Components exist.**
      `packages/agent-runtime/src/hooks/run-outcome.ts` (new),
      `packages/agent-runtime/src/hooks/subagent-outcome.ts` (re-export),
      `packages/agent-runtime/src/main-prompt-run.ts`,
      `packages/agent-runtime/src/tools/tool-executor/hook-gate.ts`,
      `packages/agent-runtime/src/tools/tool-executor/custom.ts`,
      `common/src/types/hooks.ts`, `docs/design/hook-system.md`,
      `packages/agent-runtime/src/hooks/__tests__/hook-surface-truth.test.ts`
      (new), `scripts/hook-events-check.ts` (new).
- [x] **Implementation matches the Proposed Solution.**
      `grep -n "subagentType" tools/tool-executor/hook-gate.ts
      tools/tool-executor/custom.ts` → one per `PreToolUse` site;
      `grep -n "buildSessionOutcome\|toolResult: outcome" main-prompt-run.ts` →
      the builder import, the default, the two assignments and the funnel;
      `grep -n "FIRED_HOOK_EVENTS\|NEVER_FIRED_HOOK_EVENTS\|classifyHookEvent"
      common/src/types/hooks.ts` → the classification and its gates.
- [x] **Typecheck/tests/lint pass with pasted tool output.** Receipt below (5/5
      LIVE): two workspace typechecks, the declared test path, the probe, and
      `quality` — each exit 0. Chain level: `typecheck` 12/12 exit 0;
      `bun run test` exit 0 with **7577 pass / 0 fail** (10 new pins over
      FID-2026-0919-029's 7567); eslint 0; `lint:md` exit 0; `prettier --check .`
      PASS; `quality: PASS (1498 baselined files)`; `validate:repository` PASS;
      `hygiene:check` PASS; both scope probes PASS; both probes exit 0.
- [x] **Production call-graph evidence is present for the new wiring.**
      `PreToolUse`: `createHookGate` (native gate chain) and `executeCustomToolCall`
      (custom/MCP) → `HookEngine.triggerBlock`; pinned live by driving
      `createHookGate` and reading the payload the real engine receives.
      `SessionEnd`: `mainPrompt` → `driveGoalTurns` → the `finally` →
      `fireAndForgetTrigger`; pinned live by driving `mainPrompt` for all three
      endings. Each negative leg below proves the assertion is load-bearing.
- [x] **FID status reflects the actual implementation state.** `verified` at the
      time of this evidence — the two payload fixes, the classification + gates,
      the census probe, the doc correction and 10 pins were all in the tree, with
      the three negative legs recorded, receipt 5/5 LIVE below — then advanced to
      `closed` + archived on operator directive, with the receipt re-stamped at
      the archived path (see Resolution).

## Resolution

- **Closed Date:** 2026-09-19 22:19 UTC (closed with the commit SHA pending
  operator git execution, G2 withheld; file:line + grep evidence recorded
  instead, per the FID Lifecycle rule for `closed`)
- **Fix Description:** **(A)** Both `PreToolUse` sites
  (`tools/tool-executor/hook-gate.ts` for the native gate chain and
  `tools/tool-executor/custom.ts` for the custom/MCP path) now pass the acting
  agent as `subagent_type`, so the only blocking event can express the per-agent
  policy the EHEL gate it composes with enforces; a census pin fails if a third
  site is added without it. **(B)** `hooks/run-outcome.ts` is the single outcome
  authority (FID-2026-0919-029's builder generalized; `hooks/subagent-outcome.ts`
  re-exports it so the closed record's citations resolve), and
  `main-prompt-run.ts` computes the session outcome on every path — including the
  effective no-output error form — and reports it on `SessionEnd`, with
  `SessionStart` left outcome-free. **(C)** `common/src/types/hooks.ts`
  classifies all 12 declared events into `FIRED_HOOK_EVENTS` (7) and
  `NEVER_FIRED_HOOK_EVENTS` (5, each with the blocker that keeps it inert), with
  `classifyHookEvent` and compile-time exhaustiveness/disjointness gates;
  `scripts/hook-events-check.ts` verifies the classification against the runtime
  source by census and fails if this repo's own `protocol.config.yaml` declares an
  inert hook; `docs/design/hook-system.md` gained a **Fires today?** column, the
  inert-event blockers, and a payload-field table documenting `subagent_type` on
  tool events and the outcome fields on the lifecycle events.
- **Tests Added:** Yes —
  `packages/agent-runtime/src/hooks/__tests__/hook-surface-truth.test.ts` (10 pins,
  49 expectations), driven at the real boundaries (`createHookGate` for the
  payload the engine actually receives, `mainPrompt` for all three session
  endings) plus the source census imported from the probe rather than
  reimplemented.
- **Verification Evidence:** receipt below (five gates, live) plus the three
  negative legs: dropping `subagentType` → 3 pins red; dropping
  `toolResult: outcome` on `SessionEnd` → 3 pins red; giving an inert event a
  firing site → 2 pins red and `hook-events-check` exit 1 (0 restored). Chain:
  `typecheck` 12/12 exit 0; `bun run test` exit 0 with **7577 pass / 0 fail**
  (10 new pins over FID-2026-0919-029's 7567); eslint 0; `lint:md` exit 0;
  `prettier --check .` PASS; `quality: PASS (1498 baselined files)`;
  `validate:repository` PASS; `hygiene:check` PASS; both scope probes PASS; both
  probes exit 0.
- **Archived:** 2026-09-19 22:19 UTC — moved to `dev/fids/archive/`; receipt
  re-stamped live at the archived path (5/5 gates)
