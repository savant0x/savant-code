/**
 * ChatAnywhere fallback-table rows — seam split for the no-publish gateway
 * (FID-2026-1005-010; the apinex/bai/kiosapi pattern, FID-2026-1004-002).
 *
 * ChatAnywhere publishes NO window fields on /v1/models (row shape observed
 * 2026-10-05: {id, object, created, owned_by}), so the fallback table is the
 * ONLY source. Sourcing (operator-ruled pattern): cross-gateway rows ONLY —
 * every value below is read off existing rows for the same upstream model in
 * context-window-table.ts / context-window-table-{apinex,bai,kiosapi}.ts.
 * No family or vendor-knowledge guesses.
 *
 * Row-value rule: consensus where >=2 existing rows agree (rows cited);
 * single-source rows flagged NEEDS-REVIEW. The vendor's own pricing page
 * states ">= 272,000 tokens" for gpt-5.6-sol (2026-10-05) — a floor only;
 * the cross-gateway consensus (1,050,000, four gateways) is the row value.
 *
 * Deliberately NO row (id keeps the flagged 200k default):
 * gpt-5, gpt-5.1, gpt-5.2, gpt-5-mini, gpt-5-nano, gpt-5.4-mini,
 * gpt-5.4-nano, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, gpt-4o, gpt-4o-mini,
 * gpt-3.5-turbo, deepseek-chat — no cross-gateway row (bai's NO_ROW_IDS
 * independently confirm gpt-5-mini/nano/5.2/5.4-mini-class has none).
 */
export const CHATANYWHERE_CONTEXT_WINDOW_FALLBACKS: ReadonlyArray<
  readonly [string, number]
> = [
  // --- GPT-5.x (TB+UNO+TR+CC / BR+TR+TH+CC consensus: 1,050,000) ---
  ['chatanywhere/gpt-5.5', 1_050_000], // TB + UNO + TR + CC
  ['chatanywhere/gpt-5.6-sol', 1_050_000], // BR + TR + TH + CC
  ['chatanywhere/gpt-5.6-luna', 1_050_000], // TB + BR + TH + CC
  ['chatanywhere/gpt-5.6-terra', 1_050_000], // BR + TR + TH + CC
  // TR single-source; NEEDS-REVIEW (bai rows gpt-5.4 as no-cross-gateway).
  ['chatanywhere/gpt-5.4', 1_050_000],
  // --- GPT-6.x (KIO + OR-live 2026-10-04 consensus: 1,050,000) ---
  ['chatanywhere/gpt-6-astra', 1_050_000], // TH + UNO + KIO
  ['chatanywhere/gpt-6-sol', 1_050_000], // KIO + OR-live
  ['chatanywhere/gpt-6-luna', 1_050_000], // KIO + OR-live
  ['chatanywhere/gpt-6.1-sol', 1_050_000], // KIO + OR-live
  // --- DeepSeek (TR+TH+CC+UNO / TH+CC+UNO / CC+KIO consensus) ---
  ['chatanywhere/deepseek-v4-pro', 1_048_576], // TR + TH + CC + UNO
  ['chatanywhere/deepseek-v4-flash', 1_048_576], // TH + CC + UNO
  ['chatanywhere/deepseek-v4.1-flash', 1_048_576], // CC + KIO
  // TR single-source; NEEDS-REVIEW.
  ['chatanywhere/deepseek-v3.2', 163_840],
]

/** No-source ids documented above (they keep the flagged 200k default). */
export const CHATANYWHERE_NO_ROW_IDS: ReadonlyArray<readonly [string, string]> =
  [
    ['chatanywhere/gpt-5', 'no cross-gateway row'],
    ['chatanywhere/gpt-5.1', 'no cross-gateway row'],
    ['chatanywhere/gpt-5.2', 'no cross-gateway row'],
    ['chatanywhere/gpt-5-mini', 'no cross-gateway row'],
    ['chatanywhere/gpt-5-nano', 'no cross-gateway row'],
    ['chatanywhere/gpt-5.4-mini', 'no cross-gateway row'],
    ['chatanywhere/gpt-5.4-nano', 'no cross-gateway row'],
    ['chatanywhere/gpt-4.1', 'no cross-gateway row'],
    ['chatanywhere/gpt-4.1-mini', 'no cross-gateway row'],
    ['chatanywhere/gpt-4.1-nano', 'no cross-gateway row'],
    ['chatanywhere/gpt-4o', 'no cross-gateway row'],
    ['chatanywhere/gpt-4o-mini', 'no cross-gateway row'],
    ['chatanywhere/gpt-3.5-turbo', 'no cross-gateway row'],
    ['chatanywhere/deepseek-chat', 'no cross-gateway row'],
  ]
