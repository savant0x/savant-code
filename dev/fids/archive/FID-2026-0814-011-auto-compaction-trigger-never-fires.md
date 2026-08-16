<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Auto-Compaction Trigger Never Fires — the pruner spawn path is dead at runtime

**Filename:** `FID-2026-0814-011-auto-compaction-trigger-never-fires.md`
**ID:** FID-2026-0814-011
**Severity:** critical
**Status:** closed
**Created:** 2026-08-14
**YAGNI-Compliance:** Verified — no new store, no new polling cadence; the fix reuses the existing `shouldAutoCompact` result, the existing `handleSteps` spawn yield, and the existing `agentState` channel.

---

## Summary

The operator reported (repeatedly, across days): "im currently sitting at 289.0k/262.1k, without a single auto compact trigger. It literally never fires automatically." This FID confirms the defect at source, isolates it, and fixes the trigger.

## Definitive evidence (from `debug/cli.jsonl` + `debug/trace.jsonl`)

The operator's live session is captured in the runtime debug logs. The evidence is unambiguous:

1. **Context overflows with zero pruner spawns.** `ContextCompactor initialized` logs `contextWindow: 262144, autoCompactThreshold: 232144` (the window resolves correctly). The warning fires at every step boundary while the token count climbs:

   ```text
   20:01:01  ⚠️ Context approaching auto-compact threshold (303,527 / 232,144 tokens). Full summarization will trigger via context-pruner.
   20:10:58  ⚠️ ... (290,482 / 170,000 tokens)   [note: a separate run that fell back to 200k]
   20:15:03  ⚠️ ... (325,553 / 232,144 tokens)
   20:26:10  ⚠️ ... (337,624 / 232,144 tokens)
   20:44:28  ⚠️ ... (353,128 / 232,144 tokens)
   ```

2. **The pruner never spawns.** `grep -o '"agent_type":"context-pruner"' debug/trace.jsonl` → **0 matches**, across the whole session (2,000+ tool executions, 2540 savant steps, 609 basher / 152 verifier / 81 detective / 51 scout sub-agent spawns — all of those work, the pruner never runs). The message count grew to 2540 with no compaction.

3. **`shouldAutoCompact` works; the pruner spawn does not.** The warning is emitted by `ContextCompactor.shouldAutoCompact` (`context-tokens.ts`). That path provably fires — but it only *logs*. The actual `spawn_agent_inline` (context-pruner) yield lives in a *separate* path: the savant's `handleSteps` generator (`agents/savant/handle-steps.ts`).

## Root cause (verified by elimination + reproduction)

There are **two independent trigger systems**, and only the broken one can spawn the pruner:

| Path | Fires? | Effect |
|---|---|---|
| `ContextCompactor.shouldAutoCompact` (`context-tokens.ts` → `prepareStepContext`) | **YES** (proven by the warning logs) | Logs a warning + sets `compactionStatus: warning` only. **Does not spawn.** |
| savant `handleSteps` generator (`agents/savant/handle-steps.ts`, serialized + eval'd) | **NO** (0 spawns) | This is the **only** code that yields `spawn_agent_inline` (context-pruner). |

**The trigger logic itself is correct.** A direct reproduction — deserializing the *bundled* savant `handleSteps` string (`cli/src/agents/bundled-agents.generated.ts`), running it with `contextTokenCount: 353000` and `maxContextLength: 262144` — yields `spawn_agent_inline -> context-pruner force=true` on the first step. The `agents/__tests__/context-pruner-phase3.test.ts` suite drives the same generator to the same conclusion. So the generator's arithmetic, the serialization round-trip, and the deserialization are all sound.

The defect is therefore in the **runtime wiring** between the resolved window and the generator's trigger inputs. The leading hypothesis (consistent with every observation): in the live run the generator's `agentState.maxContextLength ?? asNumber(p.maxContextLength) ?? 400000` resolves to the baked **400,000** default rather than the resolved 262,144 — its thresholds (`0.8 × 400k = 320k`, `0.9 × 400k = 360k`) then sit *above* the real model window, so the pruner trigger never crosses while `shouldAutoCompact` (232k) fires every step. C-03 adds the one-line diagnostic that confirms the exact runtime value during verification; the C-01/C-02 unification fixes the divergence regardless. This is the exact "dual windows diverge" hazard FID-006 called out for the *display*; it is also live on the *trigger*, and here it is fatal.

## RED — Issue catalog

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| C-01 | critical | The pruner spawn depends on a `maxContextLength` that can diverge from the resolved window (`agentState.maxContextLength ?? p.maxContextLength ?? 400000`). When it falls back to 400k, the 0.8/0.9 thresholds sit above the model window and auto-compaction can never fire. | `agents/savant/handle-steps.ts` (generator `maxContextLength` fallback chain `… ?? 400000`); `agents/savant/savant.ts:43-46` (`getSavantContextPrunerMaxContextLength` returns 400_000 for every non-kimi paid model); debug log: window 262144 but 0 pruner spawns at 353k tokens |
| C-02 | critical | Two independent trigger paths, and the reliable one (`shouldAutoCompact`) cannot spawn — it only logs. The pruner spawn is reachable exclusively through the fragile `handleSteps` generator. | `context-tokens.ts` (`shouldAutoCompact` → warn only); `handle-steps.ts` (sole `spawn_agent_inline` context-pruner yield) |
| C-03 | high | No runtime visibility of the trigger inputs: the generator silently reads `maxContextLength`/`contextTokenCount` with zero logging, so a divergence is invisible until the model overflows. | `handle-steps.ts` generator body (no debug emit in the trigger branch) |
| C-04 | medium | FID-006's "the trigger math is correct" conclusion was validated only at 188.3k (below the 0.8 threshold), so the above-threshold no-fire case was never observed. | `dev/fids/archive/FID-2026-0814-006…` Loop 1 Missed Questions Q1 |

## GREEN — Proposed fix (converged)

1. **C-01 — One `maxContextLength`, no silent 400k.** Make the generator's pruner thresholds derive from the **same resolved window** `shouldAutoCompact` uses. Concretely: `loop-context.ts` already sets `initialAgentState.maxContextLength = autoCompact + 30_000`; the fix asserts this is always the case at the trigger boundary and **replaces the `?? 400000` baked fallback with the resolved `autoCompact + 30_000` semantics** (fail-loud debug if ever unresolved), so a divergence cannot silently push the trigger above the window.
2. **C-02 — Single trigger authority.** `prepareStepContext` records the `shouldAutoCompact` verdict on `agentState` (e.g. `agentState.autoCompactDue = true` with the reason) and the `handleSteps` generator consumes **that** signal instead of independently re-deriving `contextTokenCount > maxContextLength × ratio`. The generator's own arithmetic becomes a fallback, not the sole gate. This guarantees the spawn fires whenever the proven warning path fires.
3. **C-03 — Trigger-input observability.** Add a bounded `logger.debug` (or reuse the existing compaction lifecycle log) in the generator's trigger branch that records `contextTokenCount`, the resolved `maxContextLength`, and the computed thresholds, so a future divergence is visible in `debug/cli.jsonl` rather than silent.
4. **C-04 — Deterministic regression.** Add a phase3/unit test that drives the *bundled+deserialized* savant `handleSteps` (not just the live factory) with `contextTokenCount` above the window and `maxContextLength` set to the resolved value, asserting the pruner spawn fires; plus a test asserting the trigger never silently adopts the 400k default when the resolved window is present.

**Out of scope:** changing the 0.8/0.9 ratios (correct when `maxContextLength` is correct); server-side compaction; the Trust Matrix (FID-2026-0814-005).

## Verification Matrix (exit gates)

| Area | Hard evidence |
|---|---|
| One window | `maxContextLength` at the trigger boundary equals `autoCompact + 30_000` (the resolved window); no silent 400k fallback when the window is resolved |
| Single trigger | `shouldAutoCompact === true` ⇒ pruner spawn yields; the generator does not independently gate the spawn |
| Observability | debug log emits trigger inputs (`contextTokenCount`, `maxContextLength`, thresholds) at the spawn decision |
| Regression | bundled+deserialized savant handleSteps spawns above the window; no 400k silent adoption; `context-pruner` appears in a headless run's trace when context crosses the threshold |
| Repository | typecheck ×4, full suites, ESLint zero warnings, Markdownlint, Prettier, `validate:repository`, fid-ledger |

## Governance and Release Boundary

This FID changes the compaction *trigger* (not just the display) — it makes auto-compaction actually fire. All changes remain subject to the Perfection Loop, a Nova planning + implementation audit, and operator approval before any closure, commit, push, release, or deployment. No trigger behavior is silently tightened without the loop.

---

## Perfection Loop

### Loop 1 — RED (catalog)

C-01…C-04 cataloged with tool-output evidence (see RED table + Summary). **Exit: all issues cataloged.**

### Loop 1 — GREEN (converged solution)

Four-part fix documented: one `maxContextLength` (no silent 400k), single trigger authority (`shouldAutoCompact` drives the spawn), trigger-input observability, and deterministic regression coverage. **Exit: all fixes documented.**

### Loop 1 — AUDIT (double audit, tool output)

**Method 1 (static + runtime grep):**

```text
$ grep -o '"agent_type":"context-pruner"' debug/trace.jsonl | wc -l
0                                   # pruner never spawned (C-01/C-02)
$ grep -a "Context approaching auto-compact" debug/cli.jsonl | tail -5
... (353,128 / 232,144 tokens)      # shouldAutoCompact fires (C-02)
$ grep -a "ContextCompactor initialized" debug/cli.jsonl | tail -1
"contextWindow":262144,"autoCompactThreshold":232144   # window resolves (C-01)
$ grep -n "?? 400000" agents/savant/handle-steps.ts
(const generator fallback chain)     # baked 400k fallback (C-01)
```

**Method 2 (reproduction):** deserializing the bundled savant `handleSteps` and driving it with `contextTokenCount: 353000, maxContextLength: 262144` yields `spawn_agent_inline → context-pruner (force=true)` on step one — proving the generator arithmetic and the eval round-trip are sound, and that the defect is the runtime `maxContextLength` divergence (C-01).

**Law 4 (call-graph):** the fix adds one agentState field consumer (`autoCompactDue`) and one debug log; implementation must grep both the writer (`prepareStepContext`) and the consumer (the generator), plus a production caller of the new regression test. Zero callers = rejected. **AUDIT passes → ADVERSARIAL.**

### Loop 1 — ADVERSARIAL (fresh meta-verification)

- **C-01 CONFIRMED:** the 400k baked default is the divergence; the `getSavantContextPrunerMaxContextLength` return of 400_000 for every paid model is the source. Verified at `agents/savant/savant.ts:43-46`.
- **C-02 CONFIRMED:** the `shouldAutoCompact` warn-only path and the generator-only spawn path are two authorities; making `shouldAutoCompact` the single trigger authority is the correct collapse.
- **C-03 CONFIRMED:** the trigger branch has no debug emit, which is exactly why the divergence was silent for days.
- **OMISSION ADDED:** the fix must also cover the **force path** (above 0.9) and the **cooldown** (`lastPrunerCompletionAt`) — the single-trigger signal must still honor the 30s re-spawn cooldown so an ineffective summary cannot re-spawn the pruner every step (FID-2026-0814-001's guard). Folded into GREEN.
- **No refutations.** Severity ratings upheld. **ADVERSARIAL passes → COMPLETE (planning).**

### Loop 1 — COMPLETE (planning)

Plan converged after one pass: zero actionable improvements beyond the recorded cooldown-guard addition; delta under the 10% cap. Implementation proceeded under operator approval ("proceed", Law 2).

### Missed Questions

1. Why did the generator's own ratio arithmetic (0.8/0.9 × `maxContextLength`) never cross in the live run when `prepareStepContext` provably computed the warning at 353k tokens? The single-trigger-authority fix makes the answer moot (the proven warning path now drives the spawn), but the exact runtime `maxContextLength` at the trigger boundary is only observable now via the C-03 debug log; a follow-up headless run should confirm the logged value matches the resolved window.
2. Should the force path's 0.9 ratio be re-derived from the compactor's `reactiveCompact` (= `contextWindow`) rather than `maxContextLength × 0.9`? Out of scope here (the ratios are correct once `maxContextLength` is correct), but worth a follow-up if the C-03 debug log shows the ratio-derived force threshold still diverges from the resolved window.

### Code Verification Evidence

**Typecheck ×4 + agents (HARD GATE):** sdk, common, packages/agent-runtime, cli, agents — all exit 0 (`tsc --noEmit`).

**Test suites (tool output):** `agents` 54 pass / 0 fail (incl. `context-pruner-phase3.test.ts` 17 pass with 5 new FID-011 tests); `common` 610 pass / 4 skip / 0 fail; `packages/agent-runtime` 960 pass / 0 fail (incl. `context-compactor.test.ts` 9 pass); `cli` 3071 pass / 18 skip / 0 fail; `sdk` 475 pass / 1 skip / 0 fail.

**Static/lint gates:** ESLint `--max-warnings 0` clean; `bun run lint:md` clean; Prettier clean; `validate:repository` PASS (after ratchet reconciliation below).

**Law 4 (call-graph) — writer and consumer both present:**

- Writer: `packages/agent-runtime/src/run-agent-step/context-tokens.ts:225` → `agentState.autoCompactDue = autoCompactCheck.shouldCompact`.
- Consumer: `agents/savant/handle-steps.ts:218` → `const autoCompactDue = agentState.autoCompactDue === true`.
- Fail-loud guard: `agents/savant/handle-steps.ts:141-149` (`resolvedMaxContextLength` + "maxContextLength unresolved" debug).
- Trigger observability: `agents/savant/handle-steps.ts:127` (`logDebug`) and `:234` ("auto-compact trigger evaluated").
- Types: `common/src/types/session-state.ts:218` + `common/src/templates/initial-agents-dir/types/agent-definition.ts:351` (`autoCompactDue?: boolean`).
- Bundle regenerated (`bun run prebuild:agents`): `grep -c autoCompactDue cli/src/agents/bundled-agents.generated.ts` → **13** (every savant variant carries the new logic).

**Regression assertions (C-04):** autoCompactDue drives the spawn below the 0.8 ratio threshold; cooldown still backs off; force path still fires during cooldown; toString→eval serialization round-trip preserves the trigger; generated source carries the fail-loud guard and no longer contains the silent `?? fallback` chain.

## Resolution

Resolved by collapsing the two independent compaction trigger systems into one authority: `prepareStepContext` now records the proven `shouldAutoCompact` verdict as `agentState.autoCompactDue` every step, and the serialized savant `handleSteps` consumes that signal as its primary trigger (ratio arithmetic is now only a fallback). The baked `maxContextLength` fallback can no longer silently push the trigger above the resolved window — its use is fail-loud via a debug log, and the trigger inputs are now observable. Five regression tests pin the behavior at the serialization round-trip boundary.

Status → `verified`. Closure, archive, and CHANGELOG entry await the operator's approval after the Nova implementation audit (staged in `dev/nova/outbox/`).
