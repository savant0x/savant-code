# FID: The last five hook events, and the contract that described them

`Stop` / `Interrupt` split, the compaction attempt-vs-effect predicate,
`Notification`, a census that demands reachability, and the five places the hook
documentation had drifted from the code.

**Filename:** `FID-2026-0919-031-lifecycle-events-and-contract-truth.md`
**ID:** FID-2026-0919-031
**Severity:** high
**Status:** closed
**Created:** 2026-09-19 23:55
**Automation level:** 3
**YAGNI-Compliance:** Confirmed (no new capability or dependency: the events are
already declared in `HOOK_EVENTS` and documented as active; the wiring reuses the
existing `buildHookInput` + engine, the helpers are thin, and the two extractions
(`loop/completed-turn.ts`, `spawn-agent-inline-precompact.ts`) move code that
already existed rather than adding it)

---

## Summary

FID-2026-0919-030 found that 5 of the 12 declared hook events had no firing site
anywhere in the runtime and were documented as active — a hook declared for one
was silently inert. It classified all five **with their blockers** instead of
guessing, and ruled that wiring them "is the next FID, needing your ruling".

This record is the ruling and the wiring, plus the second half of the same
directive — *review the whole hook surface against the documented contract and
fix anything else that over-promises* — which found five more drifts:

| # | Over-promise | Reality before |
|---|---|---|
| 1 | Events table: five events documented as firing | Fired nothing (the FID-030 finding) |
| 2 | Payload-field table: `tool_result`, `error_message`, `tool_name`/`tool_input` scoped to the older events | The five new events are not named, so a consumer cannot know what arrives |
| 3 | `Source` list: `Parser: common/src/util/protocol-config.ts (parseHookConfigs)` | That function does not exist in that file — it is `protocol-config-parser.ts`, called from `protocol-config-sections.ts` |
| 4 | `Source` list wiring: `native.ts` / `custom.ts` (tool events) · `main-prompt.ts` (session) · `spawn-agent-utils.ts` (subagent) | Wrong on all three: the sites are `hook-gate.ts` + `custom.ts` (PreToolUse), `result-lifecycle.ts` + `custom-result.ts` (post-tool), `main-prompt-run.ts`, `execute-subagent.ts` |
| 5 | `matcher`: "RegExp tested against the tool name for tool-scoped events" | On a tool-less event the matcher is silently not consulted; nothing said what happens |

Plus the config table was missing `action` (FID-2026-0824-012) entirely.

## Environment

- **OS:** Windows (win32), bash shell
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Tool Versions:** tsc (12 workspaces), eslint, prettier, markdownlint
- **Commit/State:** `main`; the 0.0.33 working tree; nothing committed (G2
  withheld — the operator holds the commit)

## Detailed Description

### Problem

**A. `Stop` and `Interrupt` were documented as the same thing.** The doc read
`Cancellation / interruption` — one phrase for two names — so no boundary existed
to implement. The runtime's only terminal signal for a turn was
`SessionEnd` / `SubagentStop` reporting `failed` for a user cancellation, which is
actionable but cannot distinguish *the agent finished and I cancelled it*.

**B. `PostCompact` had no predicate.** Compaction runs through the pruner spawn,
which completes whether or not it compacted anything (`messagesRemoved` and
`tokensSaved` can both be 0). Firing "around compaction" without a
did-it-actually-happen test would emit an event that LIES — the exact failure
class the FID-030 classification existed to prevent.

**C. `Notification` had no trigger, no payload, no consumer.** Nothing to
implement against until the operator's instruction arrived ("implement the five
inert hook events"), so the trigger had to be chosen from what the runtime
actually does.

**D. The census could be satisfied by a mention.** While giving the probe teeth
for the helper-mediated events, a first negative leg showed the rule was
textual: `isHelperCalledElsewhere` matched the helper NAME anywhere, so
`// fireCompactionHook({…})` — or an `if (false)` branch — passed for a call
site. A second, per-helper weakness followed: with `Stop` and `Interrupt` served
by one helper, deleting the `Stop` call would leave the helper "reachable" and
the census green.

**E. The documented contract drifted from the code in five places** (table
above). The docs are written when a feature is declared and never re-read by the
runtime; the only thing that made the FID-030 event-table drift observable was a
census over the source.

### Expected Behavior

- Every declared event fires at exactly one named boundary, or is classified
  inert with a blocker (no third state).
- `Stop` = the turn finished on its own terms (carrying the outcome);
  `Interrupt` = the turn was cancelled; a failure fires neither (the turn did not
  finish and was not cancelled — `SessionEnd` carries it). Children fire neither
  (they report through `SubagentStop`).
- `PreCompact` = the compaction ATTEMPT begins; `PostCompact` = the compaction
  had an EFFECT (`messagesRemoved > 0 && tokensSaved > 0`, the runtime's existing
  `pruned` predicate). An ineffective attempt emits `PreCompact` only, and that
  unmatched pair IS the signal.
- `Notification` = the runtime hands control to the operator (an `ask_user`
  call), carrying the questions, and never claiming a tool that did not run.
- No event fires when no project root resolves (the existing contract, unchanged).
- The doc states what fires, what each payload carries, and where the code lives.

### Root Cause

The five events entered `HOOK_EVENTS` from the operator-facing feature set and
the documentation was written at declaration time; the runtime never had a
boundary that could honestly produce them, and nothing related the vocabulary to
the wiring. The documentation drift has the same shape: a doc written against
intent, with no gate that reads it back. FID-2026-0919-030 built that gate for
one dimension (does the event fire) and this record extends it to two more (is
the site *reachable*, and does the prose match the source).

### Evidence

Census before and after (12 declared, 7 with a site → 12 with a site), the four
negative legs below, and the file:line citations in the Resolution.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/hooks/lifecycle-hooks.ts` (new — the ruling + the
  three helpers)
- `run-agent-step/loop.ts`, `run-agent-step/loop/completed-turn.ts` (new),
  `run-agent-step/loop/exit-paths.ts` — `Stop` / `Interrupt`
- `tools/handlers/tool/spawn-agent-inline.ts`,
  `spawn-agent-inline-precompact.ts` (new),
  `spawn-agent-inline-pruner-outcome.ts` — the compaction pair
- `tools/handlers/tool/ask-user.ts` — `Notification`
- `common/src/types/hooks.ts` — the five moved into `FIRED_HOOK_EVENTS`;
  `NEVER_FIRED_HOOK_EVENTS` is now `{}`
- `scripts/hook-events-census.ts` (new) + `scripts/hook-events-check.ts` — the
  reachability census and its probe
- `docs/design/hook-system.md`, `packages/agent-runtime/src/hooks/engine.ts`,
  `engine.test.ts`

### Risk Level

**Medium.** The hook surface is observation-only (no event other than
`PreToolUse` can block), and every site fails open with no project root. The
behavioural change an operator sees is that hooks declared for these five events
now run — which is the point — so a project that declared one earlier gets
execution it had been silently denied. Unchanged: the block protocol, the
fail-open runner, the pre/post-tool paths, and `PreToolUse`'s payload.

## Proposed Solution

### Approach

Rule the semantics **where the wiring lives** (`hooks/lifecycle-hooks.ts`) so the
contract and the code are one artifact; wire each event at its own boundary
rather than a generic one; make the census demand *reachability* (a caller, and
for an event-parameterized helper, a caller passing that event) so the vocabulary
cannot advertise what nothing delivers; then read the documentation back against
the source and correct it.

### Steps

1. Write the ruling in `lifecycle-hooks.ts`: the `Stop`/`Interrupt` split, the
   attempt/effect asymmetry, and `Notification`'s trigger.
2. Wire `Stop` at the loop's single completed-turn exit (both the ordinary and
   compact-and-stop endings), `Interrupt` at the abort arms, `PreCompact` at the
   pruner spawn, `PostCompact` on the existing `pruned` predicate, and
   `Notification` at the `ask_user` handler (before the client call, so the
   request is observable even if the operator never answers).
3. Move the five into `FIRED_HOOK_EVENTS`; empty `NEVER_FIRED_HOOK_EVENTS`,
   keeping it as the extension point whose rule is the useful part.
4. Harden the census: strip line comments, require a caller for a helper mention,
   and require an event-parameterized helper's caller to pass the event.
5. Fix the documented contract: the events table, the payload-field table, the
   `Source` paths (parser and wiring), the missing `action` row, and a stated
   `Matcher and tool-less events` section pinned by an engine test.
6. Extract the code that crossed the 300-line ceiling (`quality` gate):
   `loop/completed-turn.ts` and `spawn-agent-inline-precompact.ts`, and split the
   probe and the hooks test suite.

### Verification

Behavioural pins at the REAL boundaries (the loop, the abort arm, the pruner
outcome, the tool dispatcher) plus the census; four negative legs, each restored.

## Verification

**Negative legs (every source restored; `diff` against a pre-leg copy verified
identical afterwards):**

```text
LEG 1  delete the fireNotificationHook call from ask-user.ts
       → 3 pins red (ask_user fires Notification, census live-site, census caller)
       → hook-events-check FAIL: "Notification advertised without a reachable
         firing site", UNREACHED, "not called outside …"
LEG 2  delete the `event: 'Stop'` call from loop.ts
       → 2 pins red (the loop fires exactly one Stop, census live-site)
       → hook-events-check FAIL with the precise cause:
         "fireMainAgentTerminalHook is event-parameterized but no caller passes
         'Stop'" (Interrupt's caller kept the helper reachable — the per-helper
         weakness in Problem D, caught)
LEG 3  widen the PostCompact predicate to `>= 0 && >= 0`
       → 1 pin red (an ineffective attempt emits NO PostCompact)
LEG 4  make a tool-less matcher suppress the hook
       → 1 pin red (a matcher on a tool-less event never suppresses the hook)
```

## Verification Gates

- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/hooks/__tests__/lifecycle-hooks.test.ts
- gate: test packages/agent-runtime/src/hooks/__tests__/lifecycle-hooks-compaction.test.ts
- gate: test packages/agent-runtime/src/hooks/__tests__/engine.test.ts
- gate: probe scripts/hook-events-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:341fc2fe35f7828b2f032a1ce24ee492dc7ba330c201fd641dcd9bcce0ce6cec
- verified: 2026-09-22T15:48:58.687Z
- typecheck common: exit 0
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/hooks/__tests__/lifecycle-hooks.test.ts: exit 0
- test packages/agent-runtime/src/hooks/__tests__/lifecycle-hooks-compaction.test.ts: exit 0
- test packages/agent-runtime/src/hooks/__tests__/engine.test.ts: exit 0
- probe scripts/hook-events-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Iteration 1 — RED

The five events have no firing site (FID-2026-0919-030's census: 12 declared, 7
with a site), and the five documentation drifts are readable in
`docs/design/hook-system.md` against the source: the events table says **no** for
events the operator has now asked to be implemented, the `Source` section names a
function in a file that does not contain it (`parseHookConfigs` lives in
`protocol-config-parser.ts`) and three wiring files that do not fire those events,
and the payload table omits the five events and the `action` config field.

### Iteration 2 — GREEN

`hooks/lifecycle-hooks.ts` carries the ruling and three helpers
(`fireMainAgentTerminalHook`, `fireCompactionHook`, `fireNotificationHook`); the
five boundaries are wired (`loop.ts` + `loop/completed-turn.ts`,
`loop/exit-paths.ts` at the abort and cancelled-error arms, the pruner spawn, the
pruner outcome, `ask-user.ts`); the classification moved the five into
`FIRED_HOOK_EVENTS`; the census gained comment stripping + caller proof + the
event-parameterized caller requirement; the documentation was corrected against
the source, including the previously unstated matcher behaviour (pinned in
`engine.test.ts`).

### Iteration 3 — AUDIT / self-correction

- **The first negative leg failed to fail.** Removing the `Notification` call site
  in a way that left the helper's NAME in the file (`if (false)
  fireNotificationHook({…})`) still satisfied the census. That is a REAL hole, not
  a test artifact: the rule was spelling, not reachability. Fixed by stripping
  line comments and, more importantly, by adding the caller-argument proof that
  LEG 2 exercises.
- **The pin found a real defect in the new code**: `fireNotificationHook` always
  set `tool_name: 'ask_user'`, so a notification raised for any other reason
  would name a tool that never ran. `toolName` is now the caller's (the `ask_user`
  site passes it). Fixed the helper, not the assertion.
- **A first cut of the extraction** used a field (`lastOutputWasCompact`) that
  does not exist; the branch was rewritten to preserve the FID-2026-0825-001
  semantics exactly before the loop tests were run.
- **`quality` caught four files over the 300-line ceiling** (the test suite 348,
  `loop.ts` 315, `spawn-agent-inline.ts` 322, the probe 370 — all +1 counted, so
  wc 347/314/321/369). Note the ceiling counts on the *file*, and the probe grew
  from a 117-line report into a 369-line census + report in this FID: it was
  split into `hook-events-census.ts` (242) + `hook-events-check.ts` (165), and the
  test suite into a harness + parent + sibling.

### Missed Questions

- **The doc's `matcher` behaviour** was pinned as *intended* (the census test at
  `engine.test.ts:27` covered a matcher without a tool name on `PreToolUse`, not a
  tool-less EVENT). It is now stated in the doc and pinned for tool-less events
  proper; the fail-open choice is deliberate (see the doc section).
- **`PreCompact`'s site is proven reachable, not driven end-to-end.** The attempt
  fires inside `handleSpawnAgentInline`, which the existing pruner suites exercise
  without asserting hook payloads; this FID pins the payload at the helper and the
  reachability at the census rather than adding a second spawn fixture. Stated
  because it is the one leg of the five without a behavioural pin at its exact
  call site.
- **The census is textual.** It catches drift, not adversarial evasion: dead code
  (a branch that never executes) still counts as a caller if it names the helper
  and the event. Bounded deliberately — the behavioural pins are the proof, the
  census is the tripwire.

### Code Verification Evidence

```text
packages/agent-runtime/src/hooks/lifecycle-hooks.ts        (new) the ruling + 3 helpers
packages/agent-runtime/src/run-agent-step/loop.ts          288 lines: Stop via finishCompletedTurn, Interrupt at setup-cancel
packages/agent-runtime/src/run-agent-step/loop/completed-turn.ts (new) 54: output resolution + Stop
packages/agent-runtime/src/run-agent-step/loop/exit-paths.ts        Interrupt at the abort and cancelled-error arms
packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline-precompact.ts (new) PreCompact attempt
packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline-pruner-outcome.ts PostCompact on the `pruned` predicate
packages/agent-runtime/src/tools/handlers/tool/ask-user.ts  Notification before the client call
common/src/types/hooks.ts                                   FIRED_HOOK_EVENTS 12; NEVER_FIRED_HOOK_EVENTS {}
scripts/hook-events-census.ts                               (new) reachability census
scripts/hook-events-check.ts                                165 lines: the probe (re-exports the census)
docs/design/hook-system.md                                  events/payload tables, Source paths, matcher section
```

## Resolution

- **Closed Date:** 2026-09-22
- **Fix Description:** **(A)** `hooks/lifecycle-hooks.ts` rules the semantics where
  the wiring lives: `Stop` = the turn finished on its own terms (carrying
  `completed` / `failed`), `Interrupt` = the turn was cancelled (including an
  abort observed while handling a failure), a failure fires neither, and both are
  gated to the main agent (`!agentState.parentId`) because a child reports
  through `SubagentStop`. `Stop` fires once at the loop's single completed-turn
  exit — extracted to `loop/completed-turn.ts` so the event and the output it
  describes cannot drift and the loop stays inside the 300-line budget.
  **(B)** The compaction pair is attempt/effect by construction: `PreCompact` is
  fired by `spawn-agent-inline-precompact.ts` when the pruner spawn begins
  (reporting the trigger's token count — a `Pre` event cannot know the effect);
  `PostCompact` fires from `spawn-agent-inline-pruner-outcome.ts` inside the
  runtime's existing `pruned` predicate (`messagesRemoved > 0 && tokensSaved > 0`),
  so an ineffective attempt emits `PreCompact` with no `PostCompact` — the
  unmatched pair is the signal. **(C)** `Notification` fires on `ask_user` before
  the client call, carrying the questions and the trigger reason; `toolName` is
  passed by the caller so a notification for another reason cannot name a tool
  that did not run. **(D)** The census (`scripts/hook-events-census.ts`, reported
  by `scripts/hook-events-check.ts`) strips line comments, requires a real caller
  for a helper mention, and requires an event-parameterized helper's caller to
  pass the event — proven by LEG 1 / LEG 2. **(E)** The contract was reconciled
  with the source: the events table, the payload-field table (outcome and
  compaction and notification fields), the `Source` section (the parser is
  `protocol-config-parser.ts` via `applyHooksSection`; the wiring list names the
  real files), the missing `action` config row, and a new *Matchers and tool-less
  events* section stating the fail-open behaviour, pinned by a new engine test.
- **Tests Added:** Yes — 16 pins.
  `hooks/__tests__/lifecycle-hooks.test.ts` (terminal pair + the loop and abort
  integration), `hooks/__tests__/lifecycle-hooks-compaction.test.ts` (compaction
  predicate, `Notification`, and the census reachability pins) over a shared
  `lifecycle-hooks-test-harness.ts`, plus one engine pin for the tool-less
  matcher. FID-2026-0919-030's inert-record pin was updated with its reason: the
  record is empty *because* those five are now wired, and the non-empty assertion
  was retired with them.
- **Verification Evidence:** receipt below (seven gates, live) plus the four
  negative legs. Chain: `typecheck` 12/12 exit 0 (0 `error TS` lines);
  `bun run test` exit 0 with **7593 pass / 0 fail** across the 12 workspaces
  (16 new pins over FID-2026-0919-030's 7577); `eslint . --max-warnings 0` exit 0;
  `lint:md` exit 0; `prettier --check .` PASS; `quality: PASS (1498 baselined
  files)`; `validate:repository` PASS; `scope-register-check` PASS (0 issues);
  both probe gates exit 0 (`handoff-transport` PASS, `hook-events` PASS).
- **Archived:** 2026-09-22 — moved to `dev/fids/archive/`; receipt re-stamped
  LIVE at the archived path (7/7 gates). Commit SHA pending operator git
  execution (G2 withheld).
