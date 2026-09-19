# FID-2026-0919-019 — KiosAPI sweep follow-through: case-insensitive terminal match + researched fallback rows

- **Filename:** `dev/fids/FID-2026-0919-019-kiosapi-sweep-ci-terminal-match-fallback-rows.md`
- **ID:** FID-2026-0919-019
- **Severity:** low
- **Status:** closed
- **Created:** 2026-09-19
- **Commit SHA:** a3d37313 (shared ladder/table commit with FID-2026-0919-018;
  operator-authorized 2026-09-19)
- **Closed Date:** 2026-09-19 (commit a3d37313)
- **Archived:** 2026-09-19 — moved to `dev/fids/archive/`
- **Parent:** FID-2026-0919-018 (its fix verified; this closes the gap class the
  live roster sweep found in the same hour)

## Symptom / provenance

Post-018 live sweep (`dev/scratchpad/sweep-kiosapi-defaults.ts`, operator
key, 2026-09-19): **8 of 19** kiosapi roster ids land on the 200k
conservative default. Classification (classification probe:
`dev/scratchpad/classify-kiosapi-defaults.ts`):

1. **Case-sensitivity miss (code defect):** `kiosapi/Qwen/Qwen3-8B` —
   catalog twin `qwen/qwen3-8b` (131,072) exists; branch 2b's `===`
   terminal compare is case-sensitive and misses it.
2. **Vendor-known window, no fallback row (data gap):**
   `kiosapi/atria-dawn-preview` — upstream window 262,144 already
   vendor-published (FID-2026-0916-005, `atria/Atria-Dawn-Preview`);
   kiosapi is a second gateway for the same upstream.
3. **Genuinely OpenRouter-absent (research needed):** agnes-2.0/2.5/3.0-
   flash, big-pickle, sensenova-6.8-flash-lite, diffusiongemma-26b-a4b-it —
   no catalog twin, roster sends no `context_length`.

Operator decision: fix (1)+(2), research (3).

## Loop 1 — RED (proven)

- Sweep output (19 ids, verbatim post-018 ladder): 8 defaults, listed
  above; the other 11 resolve `catalog:*` with correct windows — including
  `kiosapi/glm-5.3-flash-free → 1310720` and `kiosapi/grok-4.6-free →
  500000` (018/016 fixes confirmed live).
- Classification probe: `Qwen/Qwen3-8B` has a case-insensitive terminal
  twin `qwen/qwen3-8b` ctx=131072; strict `===` misses it. The other six
  have no OpenRouter candidate of any spelling.

## Loop 2 — GREEN (operator-approved)

1. **Case-insensitive branch 2b** (`cli/src/utils/openrouter-models/
   lookup.ts`): terminal-segment equality compares lowercased on both
   sides. Branches 1/2 (full-id exact) stay strict — only the
   terminal-segment heuristic relaxes. Catalog casing conventions are
   vendor-chosen (OpenRouter lowercases; upstreams like HuggingFace do
   not); a routing prefix spelling must not decide window truth.
2. **Fallback rows** (`common/src/constants/context-windows.ts`, new
   kiosapi section), researched 2026-09-19:
   - `kiosapi/agnes-2.0-flash`: 524,288 (vendor wiki "512K"; deprecated
     model page kept live; NEEDS-REVIEW: AgnesAI GitHub README claims
     "256K after June 2026 rollback" — vendor wiki outranks stale README)
   - `kiosapi/agnes-2.5-flash`: 524,288 (vendor wiki "512K", GA model)
   - `kiosapi/agnes-3.0-flash`: 524,288 (vendor wiki full spec page
     "512K"; max output 65,536 confirms binary-K convention; NOTE: the
     262,144 figure in third-party posts is the open-weight *Preview*
     checkpoint, not the production/API model)
   - `kiosapi/atria-dawn-preview`: 262,144 (upstream vendor console per
     FID-2026-0916-005; second gateway, same upstream id convention)
   - `kiosapi/sensenova-6.8-flash-lite`: 262,144 (xKiro spec sheet "262K";
     "256K" secondary source is the same number rounded)
   - `kiosapi/diffusiongemma-26b-a4b-it`: 262,144 (NVIDIA model card
     "256K token context window" = 262,144; vLLM recipe `--max-model-len
     262144`)
   - `kiosapi/big-pickle`: **no row** — stealth Zen model, no vendor spec;
     the only aggregator value (200K) equals our default, so a row adds
     nothing. Stays honest-default.
3. **Tests:** case-insensitivity pin (the `Qwen/Qwen3-8B` shape) in the
   018 suite; kiosapi row pins in the fallbacks suite; **live re-sweep**
   as the acceptance proof — expected: exactly 1 default left
   (`big-pickle`, where 200k is aggregator-correct).

## Verification Gates

- gate: typecheck cli
- gate: typecheck common
- gate: test cli/src/utils/__tests__/openrouter-models-fid-0919-018.test.ts
- gate: test cli/src/utils/__tests__/context-window-fallbacks.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:a016e61dcf5434100e235c906154dd7ee7069bd464e5280ea45c2056692ee1f6
- verified: 2026-09-19T07:24:34.673Z
- typecheck cli: exit 0
- typecheck common: exit 0
- test cli/src/utils/__tests__/openrouter-models-fid-0919-018.test.ts: exit 0
- test cli/src/utils/__tests__/context-window-fallbacks.test.ts: exit 0
- quality: exit 0

## Loop record

- Loop 1 RED: sweep + classification probes, 2026-09-19 (live, operator key).
- Loop 2 GREEN: implemented 2026-09-19 on operator approval. Two loop
  findings recorded honestly:
  1. The first acceptance re-sweep reused the morning's *verbatim-port*
     probe (stale: hardcoded empty fallback table, pre-019 strict `===`) —
     it still showed 8 defaults. Rewrote the acceptance sweep
     (`sweep-kiosapi-real-resolver.ts`) to import the REAL resolvers:
     result 1/19, exactly as predicted.
  2. The real-resolver sweep surfaced values differing from the raw
     catalog probe (glm-5.3-flash 1,048,576 vs 1,310,720;
     qwen3.8-27b 262,144 vs 1M). Root-caused, NOT a 019 defect: the
     catalog carries BOTH numbers (top-level = model capability,
     `top_provider.context_length` = the current top provider's serving
     limit), and the pre-existing `contextLengthOf` policy — documented in
     lookup.ts, predating today — prefers the conservative topProvider
     value. Branch 2b finds the correct twin; the field picker applies its
     deliberate policy. Flagged to the operator as a separate decision.
- Loop 3 AUDIT: Method-2 re-read of the final `lookup.ts` branch 2b (CI
  equality, exact branches untouched), the extracted
  `context-window-table.ts` (verbatim move, re-export keeps every import
  path stable), both test edits, and the acceptance sweep output.
  Gates: typecheck cli + common 0 · fid-0919-018 6/0 (incl. the new CI pin
  + negative identity pin) · fallbacks suite green (incl. 6 row pins +
  big-pickle rowless pin) · window-truth suite green · quality PASS ·
  eslint 0 (after one import/order autofix on the rewrite) · lint:md 0 ·
  receipt 5/5 via `--write`, `--check` PASS. LIVE acceptance: real-ladder
  sweep = 1 default of 19 (big-pickle, aggregator-correct). Self-caught
  during the loop: the fallback rows pushed `context-windows.ts` to
  312/300 — quality gate caught it; table extracted move-only to
  `context-window-table.ts` (FID-018 precedent).
