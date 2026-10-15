<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Force-compaction threshold must anchor to the resolved window (reactiveCompact), not `autoCompact + 30_000`

**Filename:** `FID-2026-0814-012-force-threshold-reactive-compact-reconciliation.md`
**ID:** FID-2026-0814-012
**Severity:** low
**Status:** closed
**Created:** 2026-08-14
**YAGNI-Compliance:** Verified — no new field, no new store, no new config, no new authority. The fix switches two call sites from a `30_000`-magic reconstruction to the already-exposed `getThresholds().reactiveCompact` (Law 13 single source of truth), eliminating the duplication and making the denominator correct by construction.

---

## Summary

Follow-on to FID-2026-0814-011. That FID made the **proactive** trigger single-authority (`autoCompactDue`, sourced from `shouldAutoCompact`). This FID makes the **force** trigger (0.9) anchor to the same resolved window so it can never diverge either.

Today the force threshold is `maxContextLength × forceRatio`, but `maxContextLength` is **reconstructed** as `autoCompact + 30_000` rather than read from the compactor's authoritative `reactiveCompact` (= `contextWindow`). For realistic windows the two coincide — the `Math.max(…, 100_000)` clamp only overshoots for windows ≤ 130k, and the practical floor is 128k (a 2k delta, itself rare). This is therefore **not a live defect**: it is a single-source-of-truth (Law 13) reconciliation that makes the denominator correct by construction, so the force/proactive/percent denominators can never drift if the buffer or clamp floor ever changes. The baked `400_000` fallback remains the FID-011 fail-loud last resort.

## RED — Issue catalog

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| D-01 | low | The generator's force threshold is `maxContextLength × 0.9`, but `maxContextLength` is set to `autoCompact + 30_000` (a reconstruction), not the resolved window. `autoCompact = max(contextWindow − 30_000, 100_000)`, so for windows ≤ 130k the reconstruction overshoots — at the practical 128k floor it reads `130_000` (a 2k delta). They coincide for every realistic window ≥ 130k, so this is a redundancy that can drift, not a live defect. | `loop-context.ts:344-345` (`autoCompact + 30_000`); `context-compactor.ts:141-142` (`autoCompact` clamp + `reactiveCompact: this.contextWindow`); `handle-steps.ts:219-220` (`forceDue = contextTokenCount > maxContextLength × forceRatio`) |
| D-02 | low | The same reconstruction drives the sidebar percent denominator, so "N% of window" reads against the reconstructed value rather than the authoritative window — same theoretical drift, same fix. | `context-tokens.ts:216` (`const windowTokens = thresholds.autoCompact + 30_000`) |
| D-03 | low | The `30_000` buffer is duplicated as a magic number at both reconstruction sites instead of using the single `reactiveCompact` threshold (Law 13). | `context-tokens.ts:216`; `loop-context.ts:345`; `context-compactor/state.ts` (`AUTO_COMPACT_BUFFER = 30_000`) |

## GREEN — Proposed fix (converged)

1. **D-01/D-03:** `loop-context.ts` sets `initialAgentState.maxContextLength = contextCompactor.getThresholds().reactiveCompact` — the resolved window, exactly (never the clamped reconstruction). The generator's force threshold `maxContextLength × forceRatio` therefore becomes `contextWindow × 0.9`, anchored to the same window as `reactiveCompact`. The FID-011 fail-loud guard still covers the (now unreachable in the normal path) baked fallback.
2. **D-02/D-03:** `context-tokens.ts` uses `thresholds.reactiveCompact` as the percent denominator instead of `thresholds.autoCompact + 30_000`.
3. **Regression (Law 4):** a unit test asserts `getThresholds().reactiveCompact === contextWindow`, and that `maxContextLength` resolves to `reactiveCompact` — including a `contextWindow = 128_000` case where `autoCompact + 30_000` overshoots to `130_000`.

**Out of scope:** changing the 0.9 ratio itself; the proactive `autoCompactDue` signal (FID-011); the baked fallback (already fail-loud).

## Perfection Loop

### Loop 1 — RED

D-01…D-03 cataloged with grep evidence above. **Exit: all issues cataloged.**

### Loop 1 — GREEN

Two call-site fix + one regression test; the generator needs no source change because its denominator (`maxContextLength`) becomes the resolved window. **Exit: fixes documented.**

### Loop 1 — AUDIT (double audit, tool output)

**Method 1 (static grep):**

```text
$ grep -n "autoCompact + 30_000" packages/agent-runtime/src/run-agent-step/context-tokens.ts packages/agent-runtime/src/run-agent-step/loop-context.ts
context-tokens.ts:216:  const windowTokens = thresholds.autoCompact + 30_000   # D-02/D-03
loop-context.ts:345:    contextCompactor.getThresholds().autoCompact + 30_000  # D-01/D-03
$ grep -n "reactiveCompact" packages/agent-runtime/src/context-compactor.ts
142:      reactiveCompact: this.contextWindow,                                  # the single source of truth
```

**Method 2 (threshold arithmetic):** `autoCompact = max(contextWindow − 30_000, 100_000)` (`context-compactor.ts:141`). For `contextWindow = 262_144`, `autoCompact = 232_144` and `autoCompact + 30_000 = 262_144 === contextWindow` (exact). At the practical floor `contextWindow = 128_000`, `autoCompact = 100_000` and `autoCompact + 30_000 = 130_000` — a 2k overshoot (the reconstruction is not exact, but negligible in practice). `reactiveCompact = contextWindow` is exact in all cases, which is the point of the reconciliation.

**Law 4 (call-graph):** the fix consumes `getThresholds().reactiveCompact` (an existing public getter with an existing producer at `context-compactor.ts:142`) at two production sites (`loop-context.ts`, `context-tokens.ts`) plus a new regression test. Zero production consumers of the new value = rejected. **AUDIT passes → ADVERSARIAL.**

### Loop 1 — ADVERSARIAL (fresh meta-verification)

- **D-01 CONFIRMED (severity corrected to low):** `reactiveCompact` (= `contextWindow`) is the correct denominator; `autoCompact + 30_000` is a lossy reconstruction that the `Math.max` clamp breaks only at windows ≤ 130k (2k delta at the 128k floor — negligible, and rare). The fix is the correct single-source-of-truth collapse regardless of the small magnitude.
- **D-02 CONFIRMED:** the percent denominator should read against the window the pruner/trigger actually use; using `reactiveCompact` unifies it.
- **D-03 CONFIRMED:** the `30_000` magic number is now used only inside the compactor (via `AUTO_COMPACT_BUFFER`), not re-derived at the call sites.
- **OMISSION ADDED:** the fix must not change `reactiveCompact()` (the Layer-4 truncation method) — it only changes the *trigger denominator*. Folded into scope (no change to the truncation path).
- **No refutations.** Severity corrected to low per the operator's window-floor correction (128k is the practical floor, so the clamp overshoot is a non-issue for real models). **ADVERSARIAL passes → COMPLETE (planning).**

### Loop 1 — COMPLETE (planning)

Plan converged after one pass: zero actionable improvements beyond the recorded scope boundary; delta under the 10% cap. Implementation proceeded under operator approval ("run the Perfection Loop on it then install").

### Missed Questions

1. Is `reactiveCompact` (= `contextWindow`) the correct semantic for `maxContextLength` given the pruner also reads `maxContextLength` from spawn params as its own budget? Yes for the paid/multi-provider path (the model's window is the budget); confirm at implementation that no consumer depends on the `autoCompact + 30_000` reconstruction specifically (the AUDIT call-graph covers this).
2. Should the force ratio (0.9) itself be re-expressed as a fixed offset from `reactiveCompact` (e.g. `contextWindow − 15_000`) instead of a ratio, so the force tier tracks the window as the window shrinks? Out of scope here (the user asked only to reconcile the denominator); flag for a follow-up if the ratio proves too aggressive at very large windows.

### Code Verification Evidence

**Typecheck ×4** (sdk, common, agent-runtime, cli) — all exit 0 (`tsc --noEmit`).

**Test suites (tool output):** agent-runtime **963 pass / 0 fail** (incl. `context-compactor.test.ts` **12 pass** with 3 new FID-012 threshold tests); agents `context-pruner-phase3.test.ts` **17 pass / 0 fail** (unchanged — the generator's denominator is unaffected in source).

**Static/lint gates:** ESLint `--max-warnings 0` clean; `bun run lint:md` clean; Prettier clean; `validate:repository` PASS (quality-ratchet entries for `loop-context.ts` and `context-tokens.ts` raised to measured).

**Law 4 (call-graph):** both changed call sites consume the existing `getThresholds().reactiveCompact` getter (producer `context-compactor.ts:142` → `reactiveCompact: this.contextWindow`). The two `autoCompact + 30_000` reconstructions are gone (`grep -n "autoCompact + 30_000"` → 0 matches in `loop-context.ts` / `context-tokens.ts`).

**Regression assertions:** `reactiveCompact === contextWindow` at 262_144 and 128_000; the reconstruction coincides at 262_144 but overshoots to 130_000 at the 128_000 clamp floor — the exact divergence the fix eliminates.

## Resolution

Resolved: the two `autoCompact + 30_000` reconstructions now read the compactor's `reactiveCompact` (= the resolved `contextWindow`) directly. `loop-context.ts` sets `maxContextLength = reactiveCompact`, so the generator's force threshold is `contextWindow × 0.9` — anchored to the exact resolved window, never diverging. `context-tokens.ts` uses `reactiveCompact` as the percent denominator. One source of truth for the window, no `30_000` magic-number duplication, three regression tests pin the invariant at the clamp floor.

Status → `closed`. Archive + CHANGELOG entry follow under the operator's closure direction.
