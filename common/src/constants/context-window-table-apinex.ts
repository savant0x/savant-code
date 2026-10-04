/**
 * APInex fallback-table rows — seam split for the gateway's silent-200k sweep
 * (FID-2026-1004-002; same move-only pattern as the kiosapi split,
 * FID-2026-1003-008).
 *
 * APInex publishes NO window fields on /v1/models (runtime-catalog row shape
 * observed 2026-10-04: {id, name, provider} — no contextLength), so the
 * fallback table is the ONLY source. Operator-ruled sourcing
 * (2026-10-04): cross-gateway rows ONLY — every value below is read off
 * existing rows for the same upstream model in context-window-table.ts /
 * context-window-table-kiosapi.ts. No fresh live probe, no family or
 * vendor-knowledge guesses (FID-2026-0914-002 deprecation holds).
 *
 * Row-value rule: consensus where ≥2 existing rows agree (rows cited);
 * single-source rows flagged `NEEDS-REVIEW`; conservative minimum on a
 * conflict; dated/serving variants inherit their parent row.
 *
 * Deliberately NO row (id keeps the flagged 200k default; census 2026-10-04):
 * - free/hy4: no cross-gateway row (no hy4 row exists on any keyed roster).
 * - free/kimi-k2.8: no cross-gateway row (k2.7-code and k2.6 rows are
 *   different models).
 * - free/mimo-v2.6-pro: no cross-gateway row (only the 2.6-flash variant is
 *   rowed).
 * - free/minimax-m3.1: no cross-gateway row (m3.1 ≠ m3).
 */
export const APINEX_CONTEXT_WINDOW_FALLBACKS: ReadonlyArray<
  readonly [string, number]
> = [
  // --- Anthropic Claude family (BR+TR+TH+CC+KIO rows agree: 1,000,000) ---
  ['apinex/claude-fable-5.1', 1_000_000], // BR + CC/-5-1 + KIO/-5-1
  ['apinex/claude-opus-5', 1_000_000], // BR + TH + CC + KIO
  // NEEDS-REVIEW: single source (KIO/claude-opus-5-5).
  ['apinex/claude-opus-5.5', 1_000_000],
  ['apinex/claude-sonnet-5', 1_000_000], // BR + TR + TH + CC + KIO
  // NEEDS-REVIEW: single source (KIO/claude-sonnet-5-5).
  ['apinex/claude-sonnet-5.5', 1_000_000],
  ['apinex/free/claude-opus-4.6', 1_000_000], // TR + CC + KIO
  ['apinex/free/claude-sonnet-4.6', 1_000_000], // CC + KIO
  // --- DeepSeek (TH + CC + KIO agree: 1,048,576; HC 1,310,720 is
  // route-keyed, excluded as route-specific) ---
  ['apinex/deepseek-v4-flash', 1_048_576], // TH + CC + KIO
  ['apinex/deepseek-v4-pro', 1_048_576], // TR + TH + CC + UNO + KIO
  ['apinex/deepseek-v4.1-flash', 1_048_576], // CC + KIO
  // NEEDS-REVIEW: single source (INF 0731:free row). Capability value;
  // serving caveat: providers serve 1,048,576 (serving-limits handles).
  ['apinex/free/deepseek-v4-flash-0731', 1_310_720],
  // NEEDS-REVIEW: dated snapshot inherits deepseek-v4-pro (consensus).
  ['apinex/free/deepseek-v4-pro-0813', 1_048_576],
  ['apinex/free/deepseek-v4.1-flash', 1_048_576], // CC + KIO
  // --- Google Gemini (TR/INF/KIO 3.1-pro-preview + UNO 3.6 + KIO agree) ---
  ['apinex/gemini-3.1-pro', 1_048_576], // TR + INF + KIO
  ['apinex/free/gemini-3.1-pro', 1_048_576], // TR + INF + KIO
  // NEEDS-REVIEW: inherits KIO/gemini-3.8-flash, itself a flagged family
  // inference — flag carried, not laundered.
  ['apinex/gemini-3.8-flash', 1_048_576],
  // NEEDS-REVIEW: same inheritance as gemini-3.8-flash.
  ['apinex/free/gemini-3.8-flash', 1_048_576],
  // --- Z.AI GLM (conservative minimum on the recorded conflicts) ---
  // CC gateway-advertised 1,000,000 (binding, FID-2026-0928-010) vs KIO
  // 1,048,576 → conservative minimum.
  ['apinex/glm-5.3', 1_000_000],
  // KIO OR-live 2026-10-03 (1,048,575) vs INF/UNO 1,310,720 → minimum.
  ['apinex/glm-5.3-flash', 1_048_575],
  ['apinex/free/glm-5.3-flash', 1_048_575], // same conflict, same minimum
  // --- OpenAI GPT (capability 1,050,000 family consensus) ---
  ['apinex/gpt-5.6-terra', 1_050_000], // BR + TH + CC + KIO (+TR)
  ['apinex/gpt-6-astra', 1_050_000], // TH + UNO + KIO
  // NEEDS-REVIEW: single source (KIO/gpt-6-luna).
  ['apinex/gpt-6-luna', 1_050_000],
  ['apinex/free/gpt-6-luna', 1_050_000], // same source as gpt-6-luna
  // NEEDS-REVIEW: single source (KIO/gpt-6.1-sol).
  ['apinex/gpt-6.1-sol', 1_050_000],
  // --- xAI Grok ---
  // NEEDS-REVIEW: single vendor (KIO/grok-4.7 + KIO/grok-4.7-free, 500,000).
  ['apinex/grok-4.7', 500_000],
  // --- Moonshot Kimi (HC + TB + TR + TH + CC + KIO agree: 1,048,576) ---
  ['apinex/kimi-k3', 1_048_576],
  ['apinex/free/kimi-k3', 1_048_576],
  // --- Xiaomi Mimo ---
  // NEEDS-REVIEW: single source (KIO/mimo-v2.6-flash).
  ['apinex/free/mimo-v2.6-flash', 1_048_576],
  // --- MiniMax (TB + TR + CC agree: 1,048,576) ---
  ['apinex/free/minimax-m3', 1_048_576],
  // --- Misc (KIO access-tier / operator-bug corroboration) ---
  // NEEDS-REVIEW: single source (KIO/muse-spark-1.3-contributor; the
  // -contributor suffix is KIO's access tier of the same upstream model).
  ['apinex/free/muse-spark-1.3', 1_048_576],
  ['apinex/free/qwen-3.8-max', 1_000_000], // TH + BR + CC/Qwen3.8-Max
]

/**
 * APInex silent ids with NO cross-gateway source — documented no-row register
 * (census 2026-10-04). Each id resolves to the flagged 200k default. Consumed
 * by the window-truth suite and the LIVE verify-window-truth census.
 */
export const APINEX_NO_ROW_IDS: ReadonlyArray<readonly [string, string]> = [
  ['apinex/free/hy4', 'no cross-gateway row (no hy4 row on any keyed roster)'],
  [
    'apinex/free/kimi-k2.8',
    'no cross-gateway row (k2.7-code/k2.6 rows are different models)',
  ],
  [
    'apinex/free/mimo-v2.6-pro',
    'no cross-gateway row (only the 2.6-flash variant is rowed)',
  ],
  [
    'apinex/free/minimax-m3.1',
    'no cross-gateway row (m3.1 is not the rowed m3)',
  ],
]
