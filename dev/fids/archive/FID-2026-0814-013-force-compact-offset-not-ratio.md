<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Force-compact trigger re-expressed as a fixed window offset, not a ratio

**Filename:** `FID-2026-0814-013-force-compact-offset-not-ratio.md`
**ID:** FID-2026-0814-013
**Severity:** low
**Status:** closed
**Created:** 2026-08-14
**YAGNI-Compliance:** Verified — no new field of a *different kind*, no new store, no new authority. The existing `compression.forceCompactRatio` config key is re-typed from a ratio (`0.9`) to a token offset (`15000`); the trigger arithmetic switches from multiplication to subtraction. One semantic, one name, one site (Law 13).

---

## Summary

Follow-on to FID-2026-0814-012 (which fixed the force threshold's *denominator*) and to FID-2026-0814-011 (which made the proactive trigger single-authority). FID-012's "Missed Question 2" flagged exactly this: the force tier is `maxContextLength × 0.9`, and a **ratio** makes the force tier's distance from the hard limit grow linearly with the window.

Today the force tier sits at `0.9 × window`: for a 128k window that is 115.2k (12.8k of headroom), for a 262k window 235.8k (26.2k headroom), for a 400k window 360k (40k headroom). The safety requirement is actually a **constant headroom below the hard limit**, not a constant fraction — re-expressing it as `contextWindow − forceCompactOffset` (default `15_000`) makes the force tier track the window at a fixed 15k margin regardless of size. This is a predictability/semantics refinement, not a live defect: the ratio path over-compacts (fires *earlier*) at large windows, which is the safe direction.

## RED — Issue catalog

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| E-01 | low | The force tier is a **ratio** (`maxContextLength × forceRatio`), so its headroom below the hard limit grows with the window (12.8k @ 128k → 40k @ 400k). A fixed offset (`window − 15_000`) is the actual safety semantic and keeps a constant margin. | `agents/savant/handle-steps.ts:220` (`forceDue = contextTokenCount > maxContextLength * forceRatio`); `:159` (`const forceRatio = ${forceCompactRatioLiteral}`) |
| E-02 | low | The config field is named `forceCompactRatio` (unitless 0–1) but should be `forceCompactOffset` (tokens). The rename makes the unit explicit and prevents a future reader from passing a ratio where a token count is expected. | `protocol.config.yaml:126` (`forceCompactRatio: 0.9`); `common/src/util/protocol-config.ts:38` (`forceCompactRatio: number`), `:125` (`forceCompactRatio: 0.9`) |
| E-03 | low | The field is threaded under the old name through five layers (config → run-config → SDK run types → runtime loop params → savant handleSteps factory). Renaming requires touching every layer or the bundle regen will fail the drift gate. | `sdk/src/run/types.ts:199`; `cli/src/utils/create-run-config.ts:58`; `packages/agent-runtime/src/run-agent-step/types.ts:141`; `agents/savant/savant.ts:254` |
| E-04 | low | Two documentation surfaces and one generated bundle still name the ratio; stale docs + a stale bundle would re-introduce the ambiguity. | `docs/sdk-overview.md:146`; `docs/design/Token Optimization & Context Engineering Redesign.md:354`; `common/src/constants/protocol-bundle.generated.ts` (generated) |

## GREEN — Proposed fix (converged)

1. **E-02/E-03 — rename the config key** `compression.forceCompactRatio` → `compression.forceCompactOffset` (integer token count, default `15_000`) across:
   - `protocol.config.yaml:126` → `forceCompactOffset: 15000`
   - `common/src/util/protocol-config.ts` interface (`:38`), default (`:125`), parse + assign (`:373-375`, `:394-395`)
   - `packages/agent-runtime/src/run-agent-step/types.ts:141`, `sdk/src/run/types.ts:199`, `cli/src/utils/create-run-config.ts:58` (the `compression` shape)
   - `agents/savant/savant.ts:254` (threading) and the `:100` comment
2. **E-01 — switch the trigger arithmetic** in the serialized `handleSteps` factory (`agents/savant/handle-steps.ts`): `forceCompactRatio` param → `forceCompactOffset`; the generated source computes `forceDue = contextTokenCount > maxContextLength - forceCompactOffset` (replacing `maxContextLength * forceRatio`); the debug log field `forceRatio` → `forceCompactOffset`; the pre-baked `handleStepsFree250k` literal (`:308`) → `forceCompactOffset: 15_000`.
3. **E-04 — docs + bundles:** update `docs/sdk-overview.md:146` and `docs/design/Token Optimization & Context Engineering Redesign.md:354`; regenerate `common/src/constants/protocol-bundle.generated.ts` (`bun run generate:protocol-bundle`) and `cli/src/agents/bundled-agents.generated.ts` (`bun run prebuild:agents`).
4. **Tests (Law 4):** update `common/src/util/__tests__/protocol-config.test.ts` (default/parse expectations `0.9` → `15_000`, fixture `0.95` → a representative offset) and `agents/__tests__/context-pruner-phase3.test.ts` (source-shape assertion `forceRatio` → the offset literal; threaded-value assertion `forceCompactRatio: 0.85` → `forceCompactOffset: 12_000`); add a regression assertion that the generated force condition is subtraction-based (`maxContextLength - forceCompactOffset`) and that the default offset yields a force tier below the proactive tier for both the 262k and 128k windows.

**Out of scope:** changing `autoCompactRatio` (stays a ratio — proactive compaction is legitimately a fraction of the window); the FID-011 `autoCompactDue` single-trigger authority; the FID-011 fail-loud fallback.

## Perfection Loop

### Loop 1 — RED

E-01…E-04 cataloged with grep evidence above. **Exit: all issues cataloged.**

### Loop 1 — GREEN

Four-step fix documented above: config rename (all five layers), trigger arithmetic switch, docs + bundle regen, test/regression updates. **Exit: fixes documented.**

### Loop 1 — AUDIT (double audit, tool output)

**Method 1 (static grep — exact search):**

```text
$ grep -rn "forceCompactRatio" --include="*.ts" --include="*.yaml" --include="*.md" .
protocol.config.yaml:126:  forceCompactRatio: 0.9
common/src/util/protocol-config.ts:38,125,373,375,394,395
common/src/util/__tests__/protocol-config.test.ts:62,170,213,243
common/src/constants/protocol-bundle.generated.ts (bundled config copy)
agents/savant/handle-steps.ts:22,30,38,45,93,107,113,159,220,232,308
agents/savant/savant.ts:100,254
packages/agent-runtime/src/run-agent-step/types.ts:141
sdk/src/run/types.ts:194,199
cli/src/utils/create-run-config.ts:52,58
agents/__tests__/context-pruner-phase3.test.ts:328,343,349,365
docs/sdk-overview.md:146
docs/design/Token Optimization & Context Engineering Redesign.md:354
```

That is the **complete** call-graph of the field — every site above is in scope; the rename is total, so after implementation `grep -rn "forceCompactRatio"` must return **0 matches** (the Law 4 absence check).

**Method 2 (arithmetic sanity):** with `forceCompactOffset = 15_000`, the force tier is `window − 15_000`. For `window = 262_144` → `247_144` (vs. `0.9 × 262_144 = 235_930`, so force now fires later, closer to the limit); for `window = 128_000` → `113_000` (vs. `0.9 × 128_000 = 115_200`). In both cases the force tier stays **above** the proactive tier (`0.8 × window` = `209_715` / `102_400`), so tier ordering (proactive first, force last) is preserved — `15_000 < 0.2 × 128_000 = 25_600` always holds at the practical floor.

**Law 4 (call-graph):** the renamed field has producers (parse in `protocol-config.ts`) and consumers (`savant.ts` threading → `handle-steps.ts` generator → serialized source). Zero production consumers after rename = the absence grep above. **AUDIT passes → SELF-CORRECT (none) → COMPLETE (planning).**

### Loop 1 — ADVERSARIAL (fresh meta-verification)

- **E-01 CONFIRMED:** the ratio headroom grows with the window; the fixed offset is the correct safety semantic. Severity stays low (current behavior over-compacts, the safe direction).
- **E-02 CONFIRMED:** `forceCompactOffset` (tokens) is self-documenting; `forceCompactRatio` (unitless) invites a unit mismatch.
- **E-03 CONFIRMED:** the five-layer threading list is exhaustive (verified by grep above); missing a layer would leave a dangling reference that typecheck or the bundle drift gate catches.
- **E-04 CONFIRMED:** the protocol bundle embeds `protocol.config.yaml` verbatim (`generate-protocol-bundle.ts`), so the bundle MUST be regenerated or `validate:repository`'s drift gate fails.
- **OMISSION ADDED:** the debug-log field name inside the generated source must also flip (`forceRatio` → `forceCompactOffset`) so the FID-011 observability channel stays coherent. Folded into step 2.
- **EDGE CASE CONSIDERED:** if an operator sets `forceCompactOffset ≥ window`, the force tier would go ≤ 0 and force would fire every step (noisy but safe — it over-compacts, never overflows). This is the same trust domain as the unvalidated `autoCompactRatio`; no new validation is added to match the existing pattern. Default `15_000` is provably below `0.2 × minimum-window` for every real window.
- **No refutations.** **ADVERSARIAL passes → COMPLETE (planning).**

### Loop 1 — COMPLETE (planning)

Plan converged after one pass: zero actionable improvements beyond the recorded scope boundary; delta under the 10% cap. Implementation proceeds under operator approval.

### Missed Questions

1. **Should the force tier ever fall below the proactive tier?** No — force is the last-resort path. With the default offset the force tier is always above the proactive tier at every real window (verified in AUDIT Method 2); no clamp is needed.
2. **Should `autoCompactRatio` also become an offset?** No — proactive compaction is legitimately a fraction of the window (the earlier "compact at 80%" is the intended early-warning semantic); only the *force* (hard-limit) tier needs a fixed margin. Recorded as out of scope.
3. **Backward compatibility for old configs with `forceCompactRatio`?** Old keys are simply ignored (fall back to the `15_000` default) — the same behavior as any other removed/renamed config key. This is pre-release operator-owned config; a deprecated-alias read would be YAGNI debt. No alias.

### Code Verification Evidence

**Typecheck ×5** (sdk, common, agent-runtime, cli, agents) — all exit 0 (`tsc --noEmit`).

**Test suites (tool output):** common **610 pass / 4 skip / 0 fail**; agents **54 pass / 0 fail** (incl. `context-pruner-phase3.test.ts` **17 pass**); agent-runtime **963 pass / 0 fail**; sdk **548 pass / 1 skip / 0 fail**; cli **3071 pass / 18 skip / 0 fail**.

**Static/lint gates:** ESLint `--max-warnings 0` clean; `bun run lint:md` clean; Prettier clean; `validate:repository` PASS (quality-ratchet entry for `handle-steps.ts` raised to the measured 323 lines); `bun run generate:protocol-bundle:check` → up to date.

**Law 4 (call-graph / absence check):** `grep -rn "forceCompactRatio"` in live source → **0 matches** (the only remaining references are archival records — `dev/fids/archive/*`, `dev/nova/*`, `CHANGELOG.md`, and this FID's own RED evidence quoting the old name). The generated factory source contains `forceCompactOffset` and the subtraction form `maxContextLength - forceCompactOffset` (verified via the factory `toString()` round-trip).

**Regression assertions:** `protocol-config.test.ts` pins the `forceCompactOffset: 15_000` default and the parse of a `20000` fixture; `context-pruner-phase3.test.ts` pins the threaded `forceCompactOffset: 12_000` literal (`forceCompactOffset = 12000`), and the force path at `240k > 250k − 15k (235k)` bypasses cooldown while `220k` stays proactive.

## Resolution

Resolved: the force tier is now `contextTokenCount > maxContextLength - forceCompactOffset` (default offset `15_000`) instead of `maxContextLength × 0.9`. The config key is renamed `compression.forceCompactRatio` → `compression.forceCompactOffset` across all five layers (config → run-config → SDK → runtime loop params → savant handleSteps factory), the serialized generator bakes the offset as a literal, both generated bundles are regenerated, and docs + tests reflect the new unit. The force tier now keeps a constant 15k margin below the hard limit regardless of window size.

Status → `closed`. Archive + CHANGELOG entry follow.

## Lessons Learned

A trigger's **unit** (ratio vs. token offset) is part of its contract. Ratios are correct for *early-warning* tiers (proactive compaction at a fraction of the window), but a *hard-limit* tier wants a fixed margin so its headroom is constant regardless of window size. Naming the field after its unit (`forceCompactOffset`, not `forceCompactRatio`) prevents a unit mismatch at the five-layer threading boundary.
