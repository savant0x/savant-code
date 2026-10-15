# Session summary — FID-2026-0919-031: the last five hook events, and the contract that described them

**When:** 2026-09-19 23:55 → 2026-09-20 00:20 (local)
**Scope:** SCOPE.md Task 81 (T81-A … T81-I), automation level 3
**FID:** FID-2026-0919-031 — `verified`, receipt 7/7 LIVE (`sha256:2c55efb6…`)
**Commit:** none (G2 withheld — the operator holds the commit)

## Operator directives (verbatim)

> "Implement the five inert hook events, starting with the Stop vs Interrupt split
> and the compaction attempt-vs-effect predicate"

> "Review the whole hook surface against the documented contract and fix anything
> else that over-promises"

## What the directives meant, and how each was discharged

FID-2026-0919-030 had classified five declared events (`PreCompact`,
`PostCompact`, `Stop`, `Interrupt`, `Notification`) as having **zero firing
sites** while the config vocabulary accepted them and the docs presented them as
active — a hook declared for one was silently inert, the one failure mode nobody
can observe. It deliberately refused to guess, recording each blocker instead.
This session was the ruling and the wiring, plus the doc audit.

**T81-A — the ruling, written where the wiring lives.** `hooks/lifecycle-hooks.ts`
now carries the contract and the code in one artifact. `Stop` = the turn finished
on its own terms (carrying `completed`, or `failed` under `Stop` when the loop
returned the error form); `Interrupt` = the turn was cancelled, including an abort
observed while handling a failure; a **failure fires neither** (the turn did not
finish and was not cancelled — `SessionEnd` carries it, per FID-2026-0919-030).
Both are gated to `!agentState.parentId`: a child reports through `SubagentStop`,
so a subagent can never claim the session boundary.

**T81-B/C/D — wired at each event's own boundary**, never at a generic one.
`Stop` fires once at the loop's single completed-turn exit, which was extracted to
`loop/completed-turn.ts` so the event and the output it describes cannot drift and
the loop stays inside the 300-line budget; it covers the compact-and-stop ending
too (a turn that ends with no LLM step still finished). `Interrupt` fires at the
abort arm and the cancelled-error arm. `PreCompact` fires from
`spawn-agent-inline-precompact.ts` when the pruner spawn begins — the ATTEMPT,
reporting the trigger's token count, because a `Pre` event cannot know the effect
— and `PostCompact` fires from `spawn-agent-inline-pruner-outcome.ts` inside the
runtime's existing `pruned` predicate (`messagesRemoved > 0 && tokensSaved > 0`).
Consequence, stated so it is not read as a bug: an ineffective attempt emits a
`PreCompact` with no matching `PostCompact`, and that unmatched pair IS the signal.
`Notification` fires at the `ask_user` handler, before the client call, so a hook
observes the request even if the operator never answers.

**T81-E — the classification moved with the wiring.** `FIRED_HOOK_EVENTS` is now
12/12 and `NEVER_FIRED_HOOK_EVENTS` is `{}`. The empty record stays on purpose:
the rule it encodes is the useful part (a declared event must be listed as fired
with a real site, or listed inert with a blocker), and its compile-time gates keep
"we forgot to wire it" inexpressible. FID-2026-0919-030's non-empty assertion was
retired **with its reason** — an empty record is now the stronger claim.

**T81-F — the census, hardened twice, both times by failing legs.** Wiring five
events through helpers created a new way to be silently inert: a helper module
necessarily NAMES every event it can fire, in its own parameter types, and naming
an event is exactly what a type annotation does without firing anything. The first
negative leg (deleting the `Notification` call site) **passed when it should have
failed** — the rule matched the helper's name anywhere, so dead text counted as a
call. Fixed by stripping line comments and requiring a real caller. The second leg
(deleting only the `Stop` call, keeping `Interrupt`) exposed the per-helper
weakness: the helper stayed "reachable" and the census stayed green. Fixed with
the parameterized-helper rule — the caller must pass the event — and re-proven:
the probe now fails with `fireMainAgentTerminalHook is event-parameterized but no
caller passes 'Stop'`, naming the cause.

**T81-G — the contract read back against the source.** Five drifts, all
corrected: the events table (all twelve fire, with their semantics, plus a
*Semantics the events had to be given* section replacing the old *Not fired
today*); the payload-field table (terminal outcome, compaction facts, notification
reason, and `tool_input` on `Notification`); the `Source` section — which named
`parseHookConfigs` in a file that does not contain it (it is
`protocol-config-parser.ts`, called from `protocol-config-sections.ts`) and three
wiring files that fire nothing; the missing `action` config row (FID-2026-0824-012);
and the unstated `matcher` behaviour on tool-less events, now a documented,
pinned fail-open choice.

**T81-H — the quality ceiling honoured by extraction.** `quality:report` caught
four files over 300 lines: `loop.ts`, `spawn-agent-inline.ts`, the new probe (which
had grown from a 117-line report into a 369-line census + report) and the new test
suite. Split: `loop/completed-turn.ts`, `spawn-agent-inline-precompact.ts`,
`scripts/hook-events-census.ts` (242) + `scripts/hook-events-check.ts` (165, the
probe, re-exporting the census so the test import surface stayed true), and the
test suite into a harness + parent + `lifecycle-hooks-compaction` sibling. No
comments were sacrificed to fit.

**T81-I — verified.** FID-2026-0919-031, receipt **7/7 LIVE**,
`sha256:2c55efb6…`, verified 2026-09-19T23:11:00.649Z. Nothing committed.

## Evidence

**16 new pins** (`lifecycle-hooks.test.ts` terminal pair + loop/abort integration;
`lifecycle-hooks-compaction.test.ts` compaction predicate, `Notification`, census
reachability; one `engine.test.ts` pin for the tool-less matcher), all driven at
the real boundaries — the loop, the abort arm, the pruner outcome, the tool
dispatcher.

**Four negative legs, every source restored and `diff`-verified identical:**

```text
LEG 1  delete the fireNotificationHook call           → 3 pins red + probe FAIL
LEG 2  delete the `event: 'Stop'` call                 → 2 pins red + probe FAIL
       (names the cause: no caller passes 'Stop')
LEG 3  widen the PostCompact predicate to >= 0 && >= 0 → 1 pin red
LEG 4  make a tool-less matcher suppress the hook      → 1 pin red
```

```text
typecheck (12 workspaces)   exit 0, 0 `error TS`      quality:report   PASS (1498)
bun run test                exit 0, 7593 pass / 0 fail, 0 failing
eslint . --max-warnings 0   exit 0                    validate:repository PASS
lint:md                     exit 0                    scope-register   PASS (0 issues)
prettier --check .          PASS                      handoff probe    exit 0
fid:verify (7 gates)        PASS                      hook-events probe exit 0
```

## Things worth carrying forward

- **A gate that passes is not a gate that works.** The first version of the
  reachability rule passed against broken code. Running the leg is what found it,
  and the second leg found the next hole. Both are now pinned by the tests that
  failed.
- **A pin on new code found a real defect:** `fireNotificationHook` hardcoded
  `tool_name: 'ask_user'`, so a notification raised for any other reason would have
  named a tool that never ran. The helper was fixed, not the assertion.
- **The honest limit, stated in the record rather than papered over:** the census
  is textual (dead code that names a helper and an event still counts), and
  `PreCompact`'s site is proven reachable by the census with its payload pinned at
  the helper, not driven end-to-end through a second spawn fixture.
- **Documentation drifts silently in exactly the way events do.** The event table
  was fixed only because a census read the source back; the parser path and three
  wiring files were wrong for the same reason. Nothing reads prose back, so the
  correction was manual and the only defence is stating the source paths that a
  reader can check.

## Register / record updates

SCOPE.md Task 81 (T81-A … T81-I, automation level 3) · CHANGELOG 0.0.33 ·
`dev/fids/README.md` active-queue entry · `docs/design/hook-system.md` (events
table, semantics, payload table, matcher section, Source paths) ·
`common/src/types/hooks.ts` (classification + gates) ·
`packages/agent-runtime/src/hooks/engine.ts` (observation-path comment).
