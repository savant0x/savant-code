# FID: Child agents inherit compaction policy and resolved window

**Filename:** `FID-2026-1012-008-child-agent-compaction-and-window-propagation.md`
**ID:** FID-2026-1012-008
**Severity:** high
**Status:** closed
**Created:** 2026-10-12
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

A spawned child builds its own `ContextCompactor`, but the spawn boundary
dropped the two inputs it needs: the run's `compression` policy and its
resolved `contextWindow`. Children compacted with micro-compaction ON while the
run had it off — clearing fetched research records at 11% of the threshold —
and sized their thresholds against a 200,000 fallback. This record implements
candidate `LF-002` of the lesson-driven feature pipeline.

## Environment

- Windows, Bun 1.3.14, TypeScript monorepo, initial HEAD `7fbecd99` (the
  LF-001 fix, FID-2026-1012-007, landed first).
- Candidate source: `dev/feature-pipeline/candidates.json` `LF-002` (P1,
  `ready`, `observed-gap`), derived from the lessons "A new AgentState field is
  not a free edit", "An embedded scope cannot import — give it data-shaped
  seams" and "A marker that names a possibility is not a locator".

## Detailed Description

### Problem and expected behavior

A child agent must run under the same context policy as the run that spawned
it: the operator's `compression` configuration (micro-compaction off, recent
tail retained, digest caps) and the resolved window of the model the child
actually runs. Instead, `extractSubagentContextParams` copied a fixed field
list that omits both, and `executeSubagent` spreads exactly that object into
`loopAgentSteps`, so the child's compactor was built from `undefined`.

### Root cause and evidence

- `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts:55`
  (`extractSubagentContextParams`) returned a whitelist of fields; neither
  `compression` nor `contextWindow` was on it.
- `packages/agent-runtime/src/run-agent-step/loop-context.ts:239-250` builds
  the child's `ContextCompactor` from the loop params it was handed —
  `microCompactEnabled: loopParams.compression?.microCompact` and
  `contextWindow: loopParams.contextWindow` — so both omissions matter.
- `packages/agent-runtime/src/context-compactor.ts:102`:
  `microCompactEnabled = options.microCompactEnabled ?? true`. Absent policy
  means micro-compaction ON, which is why a run configured
  `microCompact: false` (`protocol.config.yaml:139`) still lost early paper
  records inside the child.
- `packages/agent-runtime/src/context-compactor.ts:89`:
  `contextWindow = options.contextWindow ?? 200_000`. Absent window means the
  child sized its thresholds from a fallback that has nothing to do with the
  model it runs.
- Both spawn sites spread the extracted object:
  `spawn-agents-child-run.ts:158` and `spawn-agent-inline.ts:175` (the same
  funnel, `execute-subagent.ts:196-208`).

## Impact Assessment

High: the acceptance failure that produced this pipeline — a scholarly run
whose fetched paper records were compacted away mid-synthesis — is a direct
consequence, and it is invisible in the parent, which was behaving correctly.
It also means compaction thresholds in every child disagreed with the run's
real model window.

## Proposed Solution

1. Add `compression` to the child context params and copy it in
   `extractSubagentContextParams`; the compaction policy is model-independent,
   so every child inherits it.
2. Add `resolveChildContextWindow`, the exact analogue of the existing
   `resolveChildOutputBudget`: the resolved window propagates only when the
   child runs the model it was resolved for, so a child pinned to a different
   model resolves its own window instead of inheriting a foreign limit.
3. Wire both spawn paths through it, and pin the wiring so a third spawn path
   that forgets either half fails a test.
4. Leave the propagation snapshot untouched: it proves identity and governance
   inheritance, and these two values are runtime inputs, not identity.

### Verification

A hermetic suite proves the policy is carried, that the inherited policy keeps
eight early research records while a child without it clears them (the
load-bearing control), that the window reaches a same-model child and not a
pinned-model child, that the resolved value really does size the child's
thresholds, and — statically — that both spawn sites route through the guard.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/__tests__/subagent-compaction-propagation.test.ts
- gate: test packages/agent-runtime/src/__tests__/subagent-propagation-contract.test.ts
- gate: test packages/agent-runtime/src/__tests__/spawn-handoff-transport.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:14f896b67677f181b57946b59f105342fa69adcdcfa43256c065d2fd980dae3c
- verified: 2026-10-12T20:35:56.573Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/__tests__/subagent-compaction-propagation.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/subagent-propagation-contract.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/spawn-handoff-transport.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED / GREEN / AUDIT / ADVERSARIAL

RED: the child compactor's inputs were traced from the spawn sites to
`loop-context.ts:239-250`, and both defaults were read from the source
(`microCompactEnabled ?? true`, `contextWindow ?? 200_000`) rather than assumed
from the symptom. The parent's configuration was confirmed live in
`protocol.config.yaml:139`.

GREEN: two fields and one guard, following the shape the codebase already uses
for the run's output budget — no new concept, no new module, no protocol
change.

AUDIT: the guard must not be applied to the policy. `compression` is
model-independent, so gating it on a model match would drop micro-compaction
off from every pinned-model child; the window is model-scoped, so inheriting it
ungated would size thresholds against a limit the child's model does not have.
The two halves therefore travel by different routes on purpose, and the
snapshot stays a governance contract only.

ADVERSARIAL: does passing an extra field into `loopAgentSteps` widen the child's
authority? No — both fields are already read by the child loop's own compactor
construction; nothing new becomes reachable. Does it hide the parent's config
behind a default? No — the opposite: the default was the bug. Could a
different-model child regress further? No — it keeps resolving its own window,
which is what it did before.

Converged; implementation proceeded under recorded automation level 3.

### Missed Questions

- Should the propagation snapshot carry these values? No. The snapshot exists
  to prove a child belongs to the run (identity and governance); runtime inputs
  are spread, not proven, and adding them there would weaken the contract's
  meaning.
- Do digest caps need separate propagation? No — they are stamped onto the
  child state by the child's own `loop-context` from the same `compression`
  object this record now forwards.

## Resolution

### Code Verification Evidence

Commit `7fbecd99`; the suite's absence assertion was corrected in `e3bea01e`
(structural — the extractor has no `contextWindow` field by design, so naming it
could not compile).
`packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts:40` adds
`compression` to `SubagentContextParams`, `:107` copies it into every child
context, and `:167` adds `resolveChildContextWindow`. Both spawn paths call
that guard (`spawn-agents-child-run.ts:85`, `spawn-agent-inline.ts:79`) and
pass `contextWindow: childContextWindow` into the shared funnel
(`spawn-agents-child-run.ts:158`, `spawn-agent-inline.ts:175`), which forwards
it to the child loop (`execute-subagent.ts:196-208`), where
`loop-context.ts:239-250` builds the compactor.

Focused verification: 6 pass (propagation suite, including the control that
fails without the propagation and the static census over both spawn sites),
plus the two neighbouring spawn-contract suites. Full agent-runtime suite
after the change: 2020 pass / 0 fail; common 853 pass / 0 skip-fail; SDK 618
pass. Root typecheck, ESLint, Markdown lint, formatting, `quality:report` and
`validate:repository` pass.

Boundaries recorded honestly: the child compactor is proven at the option-set
level (the option set is copied from `loop-context.ts:239-250`) and by the
static two-site census, not by a live multi-agent scholarly run — no model
inference was executed in this session, and the acceptance criterion "a
live-style scholarly sequence retains early paper records through synthesis"
is therefore met deterministically, not live. The aggregate `bun run ci` red is
the separately characterized Savant-Free disposition (T122), not this change.

## Lessons Learned

Every derived value a child loop reads has to be propagated by name; a whitelist
extractor fails silently, because the omitted field falls back to a default that
looks healthy in the parent and only shows up as lost evidence one layer down.
Model-scoped inputs and model-independent inputs need different routes — the
same guard is correct for one and wrong for the other.
