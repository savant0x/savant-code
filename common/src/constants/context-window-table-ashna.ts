/**
 * Ashna fallback-table rows — seam split for the silent-window gateway
 * (FID-2026-1016-018; the apinex/bai/chatanywhere/kiosapi/tiarina pattern).
 *
 * Ashna publishes NO window fields on /v1/api/models (row shape observed
 * 2026-10-16: `{id, object, created, owned_by}` — 0 of 104 rows carry a
 * window), so the fallback table is the ONLY source. Sourcing (the
 * chatanywhere rule): cross-gateway rows ONLY — every value below is read
 * off existing rows for the same upstream id in `context-window-table.ts` /
 * `context-window-table-{apinex,bai,kiosapi,tokenharbor,tiarina}.ts`. No
 * family or vendor-knowledge guesses (FID-2026-0914-002 holds).
 *
 * Row-value rule: consensus where >=2 existing rows agree (rows cited
 * inline); single-source rows flagged `NEEDS-REVIEW`; when two >=2-row
 * groups disagree the conservative MINIMUM is pinned (the repo's documented
 * tie-break — a gateway proxies at most the upstream window, so the lower
 * value can never over-allocate); route-specific reads (hcnsec route-keyed,
 * tokenharbor vendor-republished credit routes) are excluded from upstream
 * consensus; a dated/serving variant with no independent row inherits its
 * parent's consensus — a suffixed id is a separate roster entry and must be
 * rowed rather than left to the 200k default (the kiosapi lesson).
 */
export const ASHNA_CONTEXT_WINDOW_FALLBACKS: ReadonlyArray<
  readonly [string, number]
> = [
  // --- GPT-5.x/6.x generation: 1,050,000 everywhere it is measured ---
  ['ashna/gpt-5.5', 1_050_000], // TB + UNO + TR + CC + KIO + BAI + CHA
  ['ashna/gpt-5.6-sol', 1_050_000], // BR + TR + TH + CC + KIO + BAI + CHA
  ['ashna/gpt-5.6-luna', 1_050_000], // TB + BR + TH + CC + KIO + BAI + CHA
  ['ashna/gpt-5.6-terra', 1_050_000], // BR + TR + TH + CC + KIO + BAI + CHA
  ['ashna/gpt-6-sol', 1_050_000], // TH + KIO + BAI + CHA (+ OR-live)
  ['ashna/gpt-6-luna', 1_050_000], // TH + APX + BAI (+ OR-live)
  ['ashna/gpt-6.1-sol', 1_050_000], // TH + KIO + APX + BAI (+ OR-live)
  ['ashna/gpt-6-astra', 1_050_000], // TH + UNO + KIO + BAI + APX
  // NEEDS-REVIEW: TR single-source; B.AI documents gpt-5.4 as no-row (the
  // chatanywhere precedent row kept the single-source flag).
  ['ashna/gpt-5.4', 1_050_000], // TR (single source)
  // --- GPT codex / OSS ---
  ['ashna/gpt-5.3-codex', 400_000], // TB + TR + CC
  ['ashna/gpt-oss-120b', 131_072], // TR + UNO + TIARINA
  // NEEDS-REVIEW: TR single-source (the chatanywhere deepseek/v3.2 rule).
  ['ashna/grok-4.3', 1_000_000], // TR (single source)
  // --- Claude 5 / 4.8 / 4.6 generation: 1,000,000 ---
  ['ashna/claude-sonnet-5', 1_000_000], // BR + TR + TH + CC + KIO + APX + BAI
  ['ashna/claude-opus-5', 1_000_000], // BR + TH + CC + KIO + APX + BAI
  ['ashna/claude-fable-5', 1_000_000], // BR + TR + CC + KIO + BAI
  ['ashna/claude-opus-4-8', 1_000_000], // CC + KIO (+ KIO -req variant)
  ['ashna/claude-opus-4-6', 1_000_000], // TR(dot) + CC + KIO + BAI(dot) + APX
  ['ashna/claude-sonnet-4-6', 1_000_000], // CC + KIO + TH(dot) + BAI + APX
  // --- Claude haiku-4.5 family: CC dated + BAI dot spellings agree ---
  ['ashna/claude-haiku-4-5', 200_000], // CC dated row + BAI(dot) + OR-live
  ['ashna/claude-haiku-4.5', 200_000], // parent claude-haiku-4-5 (variant)
  ['ashna/claude-haiku-4-5-20251001', 200_000], // CC dated row (exact id)
  // --- DeepSeek v4 family: 1,048,576 upstream; route reads excluded ---
  ['ashna/deepseek-v4-flash', 1_048_576], // APX + KIO + CC + UNO + TIARINA
  // (TH's vendor-republished 1,000,000 chat-credit route and HC's
  // route-keyed 1,310,720 are route-specific and stay out of the vote.)
  ['ashna/deepseek-v4-pro', 1_048_576], // TR + TH + CC + UNO + KIO + BAI
  ['ashna/deepseek-v4.1-flash', 1_048_576], // CC + KIO + TH + TIARINA
  // --- GLM: two >=2-row groups disagree -> conservative minimum ---
  ['ashna/glm-5.3', 1_000_000], // CC + BAI + APX + NV + TIARINA vs KIO+intern
  ['ashna/glm-5.2', 1_000_000], // CC + TH vendor-pubs vs TR + KIO + BAI + TI
  ['ashna/glm-5.3-flash', 1_048_575], // KIO + APX + NV + BAI (min, HL: route)
  ['ashna/kimi-k3', 1_048_576], // HC + TB + TR + TH + CC + KIO + NV + BAI + APX
]

/**
 * Retained chat ids with NO cross-gateway window row anywhere (census
 * 2026-10-16, 104-row roster minus the voyage/rerank/diffusion exclusions).
 * Each keeps the flagged conservative 200k default in the picker. Grouped
 * by reason; 50 ids total.
 */
export const ASHNA_NO_ROW_IDS: ReadonlyArray<readonly [string, string]> = [
  // The vendor's own id — proprietary, no spec, no aggregator value.
  ['ashna-x1', 'proprietary vendor id, no cross-gateway row'],
  // Bare aliases resolve to evolving targets; no single window is honest.
  ['auto', 'bare vendor alias — evolving target'],
  ['sonnet', 'bare vendor alias — evolving target'],
  ['haiku', 'bare vendor alias — evolving target'],
  ['opus', 'bare vendor alias — evolving target'],
  // Claude 3.5/3.7 generation and pre-4.6/4.8 ids: no cross-gateway row
  // (B.AI documents the same no-row list for the dot spellings).
  ['claude-3-5-haiku', 'no cross-gateway row (pre-4.6 generation)'],
  ['claude-3-5-haiku-20241022', 'no cross-gateway row (dated pre-4.6)'],
  ['claude-3-5-sonnet', 'no cross-gateway row (pre-4.6 generation)'],
  ['claude-3-5-sonnet-20241022', 'no cross-gateway row (dated pre-4.6)'],
  ['claude-3-7-sonnet', 'no cross-gateway row (pre-4.6 generation)'],
  ['claude-3-7-sonnet-20250219', 'no cross-gateway row (dated pre-4.6)'],
  ['claude-opus-4', 'no cross-gateway row (pre-4.6 generation)'],
  ['claude-opus-4-1', 'no cross-gateway row (pre-4.6 generation)'],
  ['claude-opus-4-1-20250805', 'no cross-gateway row (dated pre-4.6)'],
  ['claude-opus-4-20250514', 'no cross-gateway row (dated pre-4.6)'],
  ['claude-opus-4-5', 'no cross-gateway row (bai/claude-opus-4.5 no-row)'],
  ['claude-opus-4.1', 'no cross-gateway row (pre-4.6 generation)'],
  ['claude-opus-4.5', 'no cross-gateway row (same upstream, dash spelling)'],
  ['claude-sonnet-4', 'no cross-gateway row (pre-4.6 generation)'],
  ['claude-sonnet-4-20250514', 'no cross-gateway row (dated pre-4.6)'],
  ['claude-sonnet-4-5', 'no cross-gateway row (bai/claude-sonnet-4.5 no-row)'],
  ['claude-sonnet-4.5', 'no cross-gateway row (same upstream, dash spelling)'],
  // GPT generations below the rowed set: no cross-gateway row (B.AI's
  // no-row list covers gpt-5/5.1/5.2 and the 4.1/4o classes).
  ['gpt-4.1', 'no cross-gateway row (unrowed generation)'],
  ['gpt-4.1-mini', 'no cross-gateway row (unrowed generation)'],
  ['gpt-4.1-nano', 'no cross-gateway row (unrowed generation)'],
  ['gpt-4o', 'no cross-gateway row (unrowed generation)'],
  ['gpt-4o-mini', 'no cross-gateway row (unrowed generation)'],
  ['gpt-5', 'no cross-gateway row (unrowed generation)'],
  ['gpt-5-codex', 'no cross-gateway row (unrowed codex generation)'],
  ['gpt-5-mini', 'no cross-gateway row (unrowed generation)'],
  ['gpt-5.1', 'no cross-gateway row (unrowed generation)'],
  ['gpt-5.1-codex', 'no cross-gateway row (unrowed codex generation)'],
  ['gpt-5.2', 'no cross-gateway row (unrowed generation)'],
  ['gpt-5.2-codex', 'no cross-gateway row (unrowed codex generation)'],
  ['gpt-5.2-thinking', 'no cross-gateway row (thinking variant unrowed)'],
  ['gpt-5.4-thinking', 'no cross-gateway row (thinking variant unrowed)'],
  ['gpt-o1', 'no cross-gateway row (unrowed generation)'],
  ['gpt-o3-mini', 'no cross-gateway row (unrowed generation)'],
  ['gpt-o4-mini', 'no cross-gateway row (unrowed generation)'],
  ['gpt-oss-20b', 'no cross-gateway row (only :free legacy says 8k)'],
  // GLM/kimi/grok/mistral and inception ids nobody else serves: no row.
  ['glm-4.7', 'no cross-gateway row (flash variant unrowed)'],
  ['kimi-2.6', 'not the rowed kimi-k2.6 slug (distinct roster entry)'],
  ['kimi-k2-thinking', 'no cross-gateway row (thinking variant unrowed)'],
  ['kimi-k2.5-thinking', 'no cross-gateway row (thinking variant unrowed)'],
  ['grok-4-1-non-reasoning', 'no cross-gateway row (variant spelling)'],
  ['mistral-3b-latest', 'no cross-gateway row (small serving)'],
  ['mistral-large-3', 'no cross-gateway row (only TH large-4/2512 rowed)'],
  ['mistral-open-8.22B', 'no cross-gateway row (vendor-only spelling)'],
  ['mercury-2', 'inception id — no cross-gateway row'],
  ['nemotron-ultra', 'id spelling differs from rowed nemotron-3-ultra-550b'],
]
