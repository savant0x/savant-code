/**
 * MarsAI fallback-table rows — seam split for the free-tier static catalog
 * (FID-2026-1016-004; the tiarina/chatanywhere/kiosapi pattern,
 * FID-2026-1004-002).
 *
 * Sourcing (operator-ruled pattern, the tiarina rule): cross-gateway rows
 * ONLY — every value below is read off existing rows for the same upstream
 * model in `context-window-table.ts` / `context-window-table-{*}.ts`. No
 * family or vendor-knowledge guesses. Variant ids inherit their parent's
 * consensus value.
 *
 * One row takes the conservative floor of conflicting upstream rows:
 * `Qwen3.8-27B-free` — the 1M rows all carry the "providers serve
 * 262,144" caveat, and a lower value can never over-allocate.
 *
 * Deliberately NO rows (they keep the flagged 200k default; the tiarina
 * no-row treatment): `auto-free` (router id; no upstream row to read),
 * `cat-jam-free` (no cross-gateway row exists anywhere), and the two
 * tier1-only ids `Meta-Llama-3_3-70B-Instruct-free` + `Qwen3.6-27B-free`
 * (first-party rows exist in the tier1 snapshot, but that file class is
 * outside the cross-gateway sourcing universe — flagged for an operator
 * ruling rather than guessed).
 */
export const MARSAI_CONTEXT_WINDOW_FALLBACKS: ReadonlyArray<
  readonly [string, number]
> = [
  // --- DeepSeek ---
  ['marsai/deepseek-v4.1-flash-free', 1_048_576], // CC + KIO + CHA
  // --- Poolside ---
  ['marsai/laguna-xs-2.1-free', 262_144], // KIO + OR-live
  // --- Xiaomi ---
  ['marsai/mimo-v2.6-flash-free', 1_048_576], // TH + KIO + BAI + APINEX
  ['marsai/muse-spark-1.3-free', 1_048_576], // TH + KIO + APINEX
  // --- MiniMax ---
  ['marsai/MiniMax-M2.7-free', 204_800], // CC + BAI (OR-live consensus)
  // --- NVIDIA ---
  ['marsai/nemotron-3-super-120b-a12b:free', 262_144], // TR + KIO
  ['marsai/nemotron-3-ultra-free', 262_144], // KIO + OR-live (parent)
  // --- Cohere ---
  ['marsai/north-mini-code:free', 256_000], // UNO + KIO (Cohere docs)
  // --- Qwen ---
  ['marsai/Qwen3.8-27B-free', 262_144], // conservative floor (see header)
  // --- StepFun ---
  ['marsai/step-5-preview-free', 1_000_000], // KIO + OR-live
]

/** No-source ids documented above (they keep the flagged 200k default). */
export const MARSAI_NO_ROW_IDS: ReadonlyArray<readonly [string, string]> = [
  ['marsai/auto-free', 'router id; no upstream row'],
  ['marsai/cat-jam-free', 'no cross-gateway row'],
  [
    'marsai/Meta-Llama-3_3-70B-Instruct-free',
    'tier1-only rows; no cross-gateway row',
  ],
  ['marsai/Qwen3.6-27B-free', 'tier1-only rows; no cross-gateway row'],
]
