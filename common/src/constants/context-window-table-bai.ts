/**
 * B.AI (bai) fallback-table rows — seam split for the gateway's silent-200k
 * sweep (FID-2026-1004-002; same move-only pattern as the kiosapi split,
 * FID-2026-1003-008).
 *
 * B.AI publishes NO window fields on /v1/models (runtime-catalog row shape
 * observed 2026-10-04), so the fallback table is the ONLY source.
 * Operator-ruled sourcing (2026-10-04): cross-gateway rows ONLY — every value
 * below is read off existing rows for the same upstream model in
 * context-window-table.ts / context-window-table-kiosapi.ts. No fresh live
 * probe, no family or vendor-knowledge guesses (FID-2026-0914-002 holds).
 *
 * Row-value rule: consensus where ≥2 existing rows agree (rows cited);
 * single-source rows flagged `NEEDS-REVIEW`; conservative minimum on a
 * conflict; dated/serving variants inherit their parent row.
 */
export const BAI_CONTEXT_WINDOW_FALLBACKS: ReadonlyArray<
  readonly [string, number]
> = [
  // --- Anthropic Claude family (BR+TR+TH+CC+KIO rows agree: 1,000,000) ---
  ['bai/claude-fable-5', 1_000_000], // BR + TR + TH + CC + KIO
  ['bai/claude-fable-5.1', 1_000_000], // BR + CC + KIO
  // Consensus: CC/claude-haiku-4-5-20251001 + OR-live 2026-10-04
  // (anthropic/claude-haiku-4.5 = 200000).
  ['bai/claude-haiku-4.5', 200_000],
  ['bai/claude-opus-4.6', 1_000_000], // TR + CC + KIO
  ['bai/claude-opus-4.7', 1_000_000], // BR + TR + CC + KIO
  ['bai/claude-opus-4.8', 1_000_000], // BR + TR + CC + KIO
  ['bai/claude-opus-5', 1_000_000], // BR + TH + CC + KIO
  // NEEDS-REVIEW: single source (KIO/claude-opus-5-5).
  ['bai/claude-opus-5.5', 1_000_000],
  ['bai/claude-sonnet-4.6', 1_000_000], // CC + KIO
  ['bai/claude-sonnet-5', 1_000_000], // BR + TR + TH + CC + KIO
  // NEEDS-REVIEW: single source (KIO/claude-sonnet-5-5).
  ['bai/claude-sonnet-5.5', 1_000_000],
  // --- DeepSeek (TH + CC + KIO agree: 1,048,576) ---
  ['bai/deepseek-v4-pro', 1_048_576], // TR + TH + CC + UNO + KIO
  ['bai/deepseek-v4.1-flash', 1_048_576], // CC + KIO
  // --- Google Gemini ---
  ['bai/gemini-3.1-pro', 1_048_576], // TR + INF + KIO
  // NEEDS-REVIEW: inherits KIO/gemini-3-flash, itself a flagged family
  // inference — flag carried, not laundered. OR-live 2026-10-04: no listing
  // (rechecked in FID-2026-1004-004).
  ['bai/gemini-3-flash', 1_048_576],
  // Consensus: KIO/gemini-3.5-flash + OR-live 2026-10-04 (google/
  // gemini-3.5-flash = 1048576).
  ['bai/gemini-3.5-flash', 1_048_576],
  ['bai/gemini-3.6-flash', 1_048_576], // KIO + UNO
  // Consensus: KIO/gemini-3.8-flash + OR-live 2026-10-04 (google/
  // gemini-3.8-flash = 1048576).
  ['bai/gemini-3.8-flash', 1_048_576],
  // --- Z.AI GLM (conservative minimum on the recorded conflicts) ---
  // Consensus: TR row (the recorded 2-of-3 vote, FID-2026-0916-002) +
  // OR-live 2026-10-04 (z-ai/glm-5.1 = 204800).
  ['bai/glm-5.1', 204_800],
  ['bai/glm-5.2', 1_048_576], // TR 2-of-3 + TH + KIO
  // CC gateway-advertised 1,000,000 (binding) vs KIO 1,048,576 → minimum.
  ['bai/glm-5.3', 1_000_000],
  // KIO OR-live 2026-10-03 (1,048,575) vs INF/UNO 1,310,720 → minimum.
  ['bai/glm-5.3-flash', 1_048_575],
  // --- OpenAI GPT (capability 1,050,000 family consensus) ---
  ['bai/gpt-5.5', 1_050_000], // UNO + CC + KIO
  // Serving variant inherits gpt-5.5 (consensus; OR-live 2026-10-04 direct
  // openai/gpt-5.5 = 1050000).
  ['bai/gpt-5.5-instant', 1_050_000],
  ['bai/gpt-5.6-luna', 1_050_000], // BR + TH + CC + KIO
  ['bai/gpt-5.6-sol', 1_050_000], // BR + TH + CC + KIO (+TR)
  ['bai/gpt-5.6-terra', 1_050_000], // BR + TH + CC + KIO
  ['bai/gpt-6-astra', 1_050_000], // TH + UNO + KIO
  // Consensus: KIO/gpt-6-luna + OR-live 2026-10-04 (openai/gpt-6-luna =
  // 1050000).
  ['bai/gpt-6-luna', 1_050_000],
  // Consensus: KIO/gpt-6-sol + OR-live 2026-10-04 (openai/gpt-6-sol =
  // 1050000).
  ['bai/gpt-6-sol', 1_050_000],
  // Consensus: KIO/gpt-6.1-sol + OR-live 2026-10-04 (openai/gpt-6.1-sol =
  // 1050000).
  ['bai/gpt-6.1-sol', 1_050_000],
  // --- Moonshot Kimi (HC + TB + TR + TH + CC + KIO agree on k3) ---
  // Consensus: CC/moonshotai/Kimi-K2.6 + OR-live 2026-10-04
  // (moonshotai/kimi-k2.6 = 262144).
  ['bai/kimi-k2.6', 262_144],
  ['bai/kimi-k3', 1_048_576],
  // --- Xiaomi Mimo (conflict resolved as in the kiosapi section) ---
  // TH 1,050,000 ×2 vs KIO 1,048,576 → conservative minimum (same conflict,
  // same resolution as KIO/mimo-v2.5 — Law 11).
  ['bai/mimo-v2.5', 1_048_576],
  ['bai/mimo-v2.5-pro', 1_050_000], // TH + TR/xiaomi agree
  // Conservative minimum: KIO/mimo-v2.6-flash 1048576 vs OR-live 1050000
  // (2026-10-04) — min holds.
  ['bai/mimo-v2.6-flash', 1_048_576],
  // --- MiniMax ---
  // Consensus: CC/MiniMaxAI/MiniMax-M2.7 + OR-live 2026-10-04
  // (minimax/minimax-m2.7 = 204800).
  ['bai/minimax-m2.7', 204_800],
  ['bai/minimax-m3', 1_048_576], // TB + TR + CC
  // --- Qwen (capability 1,000,000 family consensus) ---
  // INF + UNO + CC agree; serving caveat: providers serve 262,144
  // (serving-limits handles).
  ['bai/qwen3.8-27b', 1_000_000],
  // Consensus: KIO/qwen3.8-flash-free (operator-reported bug row, OR-live
  // 2026-10-03 + operator-stated 1M) + OR-live 2026-10-04
  // (qwen/qwen3.8-flash = 1000000).
  ['bai/qwen3.8-flash', 1_000_000],
  ['bai/qwen3.8-max', 1_000_000], // TH + BR + CC/Qwen3.8-Max
]

/**
 * B.AI silent ids with NO cross-gateway source — documented no-row register
 * (census 2026-10-04). Each id resolves to the flagged 200k default. Consumed
 * by the window-truth suite and the LIVE verify-window-truth census.
 */
export const BAI_NO_ROW_IDS: ReadonlyArray<readonly [string, string]> = [
  ['bai/claude-opus-4.5', 'no cross-gateway row'],
  ['bai/claude-sonnet-4.5', 'no cross-gateway row'],
  ['bai/gemini-3.5-flash-lite', 'no cross-gateway row (no -lite row exists)'],
  ['bai/glm-5.3-flashx', 'no cross-gateway row (flashx variant unrowed)'],
  ['bai/gpt-5-mini', 'no cross-gateway row'],
  ['bai/gpt-5-nano', 'no cross-gateway row'],
  ['bai/gpt-5.2', 'no cross-gateway row'],
  ['bai/gpt-5.4', 'no cross-gateway row'],
  ['bai/gpt-5.4-mini', 'no cross-gateway row'],
  ['bai/gpt-5.4-nano', 'no cross-gateway row'],
  ['bai/gpt-5.4-pro', 'no cross-gateway row'],
  ['bai/gpt-image-2', 'image-generation model — no context-window semantics'],
  ['bai/hy3', 'no cross-gateway row'],
  ['bai/hy4-preview', 'no cross-gateway row'],
  ['bai/jev-1.13.0', 'stealth id — no vendor spec, no aggregator value'],
  ['bai/jev-latest', 'stealth id — no vendor spec, no aggregator value'],
  ['bai/kimi-k2.8-preview', 'no cross-gateway row'],
  ['bai/mimo-v2.6-pro', 'no cross-gateway row (only 2.6-flash is rowed)'],
]
