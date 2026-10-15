/**
 * Tiarina Cloud fallback-table rows — seam split for the no-publish gateway
 * (FID-2026-1012-005; the apinex/bai/kiosapi/chatanywhere pattern,
 * FID-2026-1004-002).
 *
 * Tiarina Cloud publishes NO window fields on `/v1/models` (row shape observed
 * 2026-10-12: `{id, object, created, owned_by}` — 0 of 19 rows carry a window),
 * so the fallback table is the ONLY source. Sourcing (operator-ruled pattern,
 * the chatanywhere rule): cross-gateway rows ONLY — every value below is read
 * off existing rows for the same upstream model in `context-window-table.ts` /
 * `context-window-table-{apinex,bai,kiosapi,tokenharbor}.ts`. No family or
 * vendor-knowledge guesses.
 *
 * Row-value rule: consensus where >=2 existing rows agree (rows cited inline);
 * when two >=2-row groups disagree, the conservative MINIMUM is pinned (the
 * repo's documented tie-break — a gateway proxies at most the upstream window,
 * so the lower value can never over-allocate); a variant id with no independent
 * row (`:free`, `:cloudflare`) is pinned to its parent's consensus value — the
 * kiosapi lesson that a suffixed id is a separate roster entry and must be
 * rowed rather than left to the 200k default.
 *
 * Deliberately NO row (the id keeps the flagged 200k default; the only such id
 * in this roster): `glm-4.7-flash` — no cross-gateway row exists anywhere in
 * the table. The only `glm-4.7-flash`-family rows in the repo are catalog-owned
 * orcarouter/vercel values the register explicitly does NOT row
 * (`window-coverage-register.ts:38`, FID-2026-1004-003). Inventing a value from
 * the family name is the failure mode this rule exists to prevent.
 */
export const TIARINA_CONTEXT_WINDOW_FALLBACKS: ReadonlyArray<
  readonly [string, number]
> = [
  // --- DeepSeek ---
  ['tiarina/deepseek-v4.1-flash', 1_048_576], // CC + NV + CHA
  ['tiarina/deepseek-v4.1-flash:free', 1_048_576], // parent (variant)
  ['tiarina/deepseek-v4-flash:free', 1_048_576], // UNO + INF + ORC + CHA
  ['tiarina/deepseek-v4-pro', 1_048_576], // TR + CC + UNO + CHA + KIO
  ['tiarina/deepseek-v4-pro:cloudflare', 1_048_576], // parent (channel variant)
  // --- GLM (both conflict rows take the minimum) ---
  ['tiarina/glm-5.3', 1_000_000], // BAI + APINEX + NV vs KIO + intern -> min
  ['tiarina/glm-5.3:cloudflare', 1_000_000], // parent (channel variant)
  ['tiarina/glm-5.3-flash:free', 1_048_575], // KIO + NV vs UNO + INF + HC -> min
  ['tiarina/glm-5.2', 1_048_576], // TR (2-of-3) + BAI + KIO
  // --- Moonshot ---
  ['tiarina/kimi-k3', 1_048_576], // HC + TB + TR + NV + TH + BAI + APINEX + CC
  ['tiarina/kimi-k2.6', 262_144], // intern + NV + BAI + TH + CC
  ['tiarina/kimi-k2.7-code', 262_144], // INF + TR + CC
  // --- Qwen ---
  ['tiarina/qwen3.8-max', 1_000_000], // BR + BAI + TH + CC
  ['tiarina/qwen3.7-plus', 1_000_000], // TR + CC
  ['tiarina/qwen3.8-flash', 1_000_000], // BAI + KIO (+ OR-live 2026-10-10)
  ['tiarina/qwen3.8-flash:free', 1_000_000], // KIO `:free` + parent
  // --- Xiaomi / OpenAI OSS ---
  ['tiarina/mimo-v2.6-flash:free', 1_048_576], // TH + KIO + BAI + APINEX
  ['tiarina/gpt-oss-120b', 131_072], // UNO + TR
]

/** No-source ids documented above (they keep the flagged 200k default). */
export const TIARINA_NO_ROW_IDS: ReadonlyArray<readonly [string, string]> = [
  ['tiarina/glm-4.7-flash', 'no cross-gateway row'],
]
