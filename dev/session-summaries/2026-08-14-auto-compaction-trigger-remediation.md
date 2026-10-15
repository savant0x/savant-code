# Session Summary — FID-2026-0814-011 auto-compaction trigger remediation (2026-08-14)

## Scope

The operator reported (repeatedly, across days) that auto-compaction never fired —
context climbed to 289k/353k tokens against a 262,144 window with zero pruner
spawns and no visible feedback. This session isolated the defect, wrote
FID-2026-0814-011, ran the Perfection Loop, implemented the converged fix under
operator approval, verified it end to end, and (after Nova's implementation
PASS + operator approval) closed and archived the FID.

## Root cause

Two independent compaction trigger systems existed, and only the broken one
could spawn the pruner:

- `ContextCompactor.shouldAutoCompact` (fires every step, proven by the warning
  logs) only logged a warning and set `compactionStatus` — it never spawned.
- The serialized savant `handleSteps` generator was the only code that yielded
  `spawn_agent_inline → context-pruner`, but its trigger inputs
  (`agentState.maxContextLength ?? p.maxContextLength ?? 400_000`) could
  diverge from the resolved window, pushing its 0.8/0.9 thresholds above the
  real model window so it never crossed.

## Implementation

1. **Single trigger authority (C-02)** — `prepareStepContext` records the
   proven `shouldAutoCompact` verdict as `agentState.autoCompactDue` every step
   (`context-tokens.ts:225`); the generator consumes it as the primary
   proactive trigger (`handle-steps.ts:218`), with the ratio arithmetic as a
   fallback only. The 30s cooldown and 0.9 force path are preserved.
2. **No silent fallback (C-01)** — the generator resolves
   `resolvedMaxContextLength` and only adopts the baked default with a
   fail-loud debug log (`handle-steps.ts:141-149`).
3. **Observability (C-03)** — a guarded `logDebug` records the trigger inputs at
   the spawn decision (`handle-steps.ts:127`, `:234`).
4. **Types + bundle + tests (C-04)** — `AgentState.autoCompactDue?` added to
   both the runtime type and the agents-side mirror; the bundle was regenerated
   (13 savant variants); 5 new regression tests cover the `toString→eval`
   round-trip and the removed silent fallback chain.

## Verification (all green)

- Typecheck ×4 + agents clean.
- agent-runtime 960/0 · common 610 pass / 4 skip / 0 fail · SDK 475 pass /
  1 skip / 0 fail · CLI 3071 pass / 18 skip / 0 fail · agents 54/0.
- ESLint `--max-warnings 0`, lint:md, Prettier, `validate:repository` PASS
  (fid-ledger + quality ratchet reconciled for the 4 grown files).

## Closure

Nova's implementation audit returned **PASS** and the operator approved
closure. FID-2026-0814-011 is `closed` and archived at
`dev/fids/archive/FID-2026-0814-011-auto-compaction-trigger-never-fires.md`.
CHANGELOG, `dev/fids/README.md`, `dev/fids/archive/README.md`,
`docs/features.md`, `docs/index.md`, and
`dev/test-prompts/az-v0.0.24-harness-live-test.md` (new `5g` phase,
V024-174…178) were updated. The active FID queue is empty.

No commit, push, release, publication, or deployment was performed.
