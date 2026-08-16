<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Nova Implementation Sign-off Request — FID-2026-0814-011 (Auto-compaction trigger never fires)

**Date:** 2026-08-14
**Scope:** The operator's days-long report that auto-compaction "literally never fires" at 289k/353k tokens against a 262,144 window, with no visible feedback. This FID isolates the two competing trigger systems, collapses them into a single authority, and makes the trigger observable.
**Status:** REQUESTED
**Priority:** Critical (the pruner spawn was provably dead at runtime — `grep -o '"agent_type":"context-pruner"' debug/trace.jsonl` → 0 matches across a 2,540-step session).

## Request

Please independently audit the FID-2026-0814-011 implementation at source and return one of:

- `PASS — implementation independently verified; eligible for operator closure`
- `FAIL — implementation requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is an **implementation audit only**. It does **not** authorize closure, commit, push, release, publication, or deployment. Operator closure remains a separate decision after your PASS.

## Root cause the fix addresses

Two independent trigger paths existed, and only the broken one could spawn the pruner:

| Path | Fired? | Effect |
|---|---|---|
| `ContextCompactor.shouldAutoCompact` (`context-tokens.ts` → `prepareStepContext`) | YES (proven by the warning logs at every step boundary) | logs a warning + sets `compactionStatus: warning` only — **does not spawn** |
| savant `handleSteps` generator (`agents/savant/handle-steps.ts`, serialized + eval'd) | NO (0 pruner spawns) | the **only** code that yields `spawn_agent_inline → context-pruner` |

The generator's trigger inputs (`agentState.maxContextLength ?? p.maxContextLength ?? 400_000`) could diverge from the resolved window, pushing its 0.8/0.9 thresholds above the real model window so it never crossed while `shouldAutoCompact` fired every step.

## What changed (three surgical changes, no new architecture)

1. **Single trigger authority (C-02).** `prepareStepContext` now records the proven `shouldAutoCompact` verdict on `agentState.autoCompactDue` every step (`packages/agent-runtime/src/run-agent-step/context-tokens.ts:225`), and the serialized savant `handleSteps` consumes **that** signal as its primary proactive trigger (`agents/savant/handle-steps.ts:218`). The generator's own ratio arithmetic is now only a fallback. The 30s post-pruner cooldown (`lastPrunerCompletionAt`) and the 0.9 force path are preserved.
2. **One `maxContextLength`, no silent 400k (C-01).** The generator resolves `resolvedMaxContextLength` from the agent state, and only falls back to the baked default with a fail-loud debug log (`agents/savant/handle-steps.ts:141-149`) so a divergence can never be silent again.
3. **Trigger-input observability (C-03).** A guarded `logDebug` helper (`agents/savant/handle-steps.ts:127`) records `contextTokenCount`, `maxContextLength`, `autoCompactDue`, `forceDue`, and both ratios at the spawn decision (`agents/savant/handle-steps.ts:234`).

Types added: `AgentState.autoCompactDue?: boolean` in both `common/src/types/session-state.ts:218` and the agents-side mirror `common/src/templates/initial-agents-dir/types/agent-definition.ts:351`. The bundle was regenerated (`bun run prebuild:agents`).

## Verification evidence (reproduce independently)

- Typecheck ×4 + `agents` — clean (`tsc --noEmit`).
- Full suites: agent-runtime 960/0 · common 610 pass / 4 skip / 0 fail · SDK 475 pass / 1 skip / 0 fail · CLI 3071 pass / 18 skip / 0 fail · agents 54/0 (incl. `context-pruner-phase3.test.ts` 17 pass with 5 new FID-011 regression tests).
- ESLint `--max-warnings 0`, lint:md, Prettier, `validate:repository` PASS.

## Hard questions Nova must verify at source

1. **Writer and consumer both present (Law 4).** Confirm `context-tokens.ts:225` writes `agentState.autoCompactDue = autoCompactCheck.shouldCompact` (set unconditionally each step — never stale) and `handle-steps.ts:218` reads `agentState.autoCompactDue === true` as the primary trigger.
2. **Cooldown + force semantics preserved.** Confirm the 0.8 proactive path still gates on `Date.now() - lastPrunerCompletionAt > prunerCooldownMs` and the 0.9 force path still bypasses the cooldown with `force: true`; the `autoCompactDue` signal must not resurrect a per-step re-spawn loop.
3. **No silent 400k fallback.** Confirm `handle-steps.ts:141-149` computes `resolvedMaxContextLength` and logs a fail-loud debug only when both `agentState.maxContextLength` and `p.maxContextLength` are absent; the generated source stays closure-free (literals/params/`agentState`/`logger` only).
4. **Bundle regenerated.** Confirm `grep -c autoCompactDue cli/src/agents/bundled-agents.generated.ts` → 13 (every savant variant carries the new logic) and the serialized form round-trips through `toString → eval` (covered by the new regression test).
5. **Observability cannot break the trigger.** Confirm `logDebug` is guarded (try/catch + `typeof logger.debug === 'function'`) so a missing/throwy logger never gates compaction.
6. **No new authority.** Confirm no new store, no new polling cadence, no new tool, no write path — the change reuses the existing `shouldAutoCompact` result, the existing `handleSteps` spawn yield, and the existing `agentState` channel.

## Authorization boundary

Implementation review of FID-2026-0814-011 only. No closure, commit, push, release, publication, or deployment authority. Operator closure remains a separate decision after your PASS.
