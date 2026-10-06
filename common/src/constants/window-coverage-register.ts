/**
 * Registry-wide context-window coverage register (FID-2026-1004-002).
 *
 * Every provider in PROVIDER_REGISTRY must declare how its model ids acquire
 * a context window. The closed-world invariant is enforced by
 * cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts:
 * a NEW registry provider without an entry fails the suite, so the
 * "added later with no coverage gate" defect class (the root cause of the
 * 2026-10-04 sweep) cannot reopen.
 *
 * Dispositions:
 * - 'table-section'      — the gateway publishes no window fields; a
 *                          fallback-table section (+ coverage pins) is the
 *                          source of truth.
 * - 'runtime-published'  — the live catalog carries context_length per id;
 *                          rows self-correct at runtime.
 * - 'runtime-partial'    — some live rows publish windows; the silent gap
 *                          subset is rowed/registered (FID-2026-1004-002).
 * - 'no-runtime-rows'    — zero rows observed in the runtime catalog
 *                          (census 2026-10-04); disposition under T128-f.
 * - 'local'              — local daemon provider; no gateway catalog.
 *
 * Census provenance: dev/scratchpad/active/window-coverage-audit-output.txt
 * (probe re-run 2026-10-04, exit 0): 1,843 rows, 264 silent-200k, 66 rows
 * advertising exactly 200000, 5 registry providers with zero rows.
 *
 * Exactly-200000 census (FID-2026-1004-003, OpenRouter cross-vote 2026-10-04,
 * probe: dev/scratchpad/active/window-census-classify.ts): of the 66 rows
 * advertising exactly 200000 — 50 REAL (OpenRouter agrees: claude-haiku-4.5,
 * opus-4.1/4.5, sonnet-4, the o-series), 3 consistent with already-flagged
 * table defaults (commandcode haiku-4-5, tokenbom doubao, th-orchestra),
 * 7 LEAK-PROBABLE (the gateway's own catalog under-states the GLM-4.x/5
 * family: orcarouter/z-ai/glm-4.6|4.7|5|5.1 and vercel/zai/glm-4.6|4.7 at
 * 200000 vs OpenRouter 204800; vercel/zai/glm-5v-turbo 200000 vs 202752 —
 * catalog-owned divergence, ~2% under-window, self-correcting if the vendor
 * updates; registered, NOT rowed — a fallback row is inert while the catalog
 * value wins tier 1), 6 UNDETERMINED (vercel claude-3-haiku, claude-opus-4,
 * o3-fast, o4-mini-fast, glm-4.7-flashx; openrouter/free stealth alias — no
 * cross source lists them; NEEDS-REVIEW, re-census on vendor data).
 */

export type WindowCoverageDisposition =
  | 'table-section'
  | 'runtime-published'
  | 'runtime-partial'
  | 'no-runtime-rows'
  | 'local'

export type WindowCoverageEntry = {
  disposition: WindowCoverageDisposition
  note: string
}

/**
 * Gateways whose catalog API publishes NO window metadata — the fallback
 * table is their only possible source (kiosapi lesson,
 * FID-2026-1003-008). The LIVE verify-window-truth census covers each one's
 * published roster; their no-row ids are documented in their section files.
 */
export const NO_PUBLISH_GATEWAY_IDS: readonly string[] = [
  'apinex',
  'bai',
  'chatanywhere',
  'kiosapi',
]

export const WINDOW_COVERAGE_REGISTER: ReadonlyMap<
  string,
  WindowCoverageEntry
> = new Map([
  [
    'openrouter',
    {
      disposition: 'runtime-published',
      note: '6/6 runtime rows carry context_length (census 2026-10-04).',
    },
  ],
  [
    'tokenrouter',
    {
      disposition: 'table-section',
      note: 'Static catalog; vendor publishes no windows. FID-2026-0916-002.',
    },
  ],
  [
    'tokenharbor',
    {
      disposition: 'table-section',
      note: 'Static catalog. FID-2026-0916-002/-004.',
    },
  ],
  [
    'nvidia',
    {
      disposition: 'runtime-partial',
      note: '10/91 runtime rows publish; 9-row chat gap subset + grouped no-row register (FID-2026-1004-002).',
    },
  ],
  [
    'commandcode',
    {
      disposition: 'table-section',
      note: 'Roster publishes context_length per id (keyless, FID-2026-0928-010) but the table section is the pinned source. FID-2026-0916-002/-004.',
    },
  ],
  [
    'nous',
    {
      disposition: 'runtime-published',
      note: '424/424 runtime rows carry context_length (census 2026-10-04).',
    },
  ],
  [
    'cloudflare',
    {
      disposition: 'no-runtime-rows',
      note: 'Static curated catalog (modelsRef) + account-scoped API (baseUrl embeds {CLOUDFLARE_ACCOUNT_ID}); gateway-catalog population needs token + account id — not keyless (T129 census 2026-10-04). Not dead.',
    },
  ],
  [
    'ollama',
    {
      disposition: 'local',
      note: 'Local daemon; model list comes from the local runtime, not a gateway catalog. Daemon confirmed reachable (HTTP 200, 2026-10-04); excluded from the gateway catalog by design (kind local).',
    },
  ],
  [
    'kiosapi',
    {
      disposition: 'table-section',
      note: 'Publishes no window fields (shape observed 2026-10-03). FID-2026-1003-008.',
    },
  ],
  [
    'apinex',
    {
      disposition: 'table-section',
      note: 'Publishes no window fields (shape observed 2026-10-04). FID-2026-1004-002.',
    },
  ],
  [
    'orcarouter',
    {
      disposition: 'runtime-partial',
      note: '143/205 runtime rows publish; 6-row chat gap subset + grouped no-row register (FID-2026-1004-002).',
    },
  ],
  [
    'bai',
    {
      disposition: 'table-section',
      note: 'Publishes no window fields (shape observed 2026-10-04). FID-2026-1004-002.',
    },
  ],
  [
    'hcnsec',
    {
      disposition: 'table-section',
      note: 'FID-2026-0913-001.',
    },
  ],
  [
    'tokenbom',
    {
      disposition: 'table-section',
      note: 'FID-2026-0913-001.',
    },
  ],
  [
    'infron',
    {
      disposition: 'table-section',
      note: 'Vendor console metadata. FID-2026-0914-001/-0919-020.',
    },
  ],
  [
    'unorouter',
    {
      disposition: 'table-section',
      note: 'Vendor console metadata. FID-2026-0914-001/-0919-020.',
    },
  ],
  [
    'bazaarlink',
    {
      disposition: 'table-section',
      note: 'Keyed /v1/models windows; LIVE probe sample source. FID-2026-0915-006.',
    },
  ],
  [
    'atria',
    {
      disposition: 'table-section',
      note: 'Single-model static catalog. FID-2026-0916-005.',
    },
  ],
  [
    'intern',
    {
      disposition: 'table-section',
      note: 'Static 10-model catalog (FID-2026-1004-008). The authenticated /v1/models DOES publish windows, but in a non-OpenRouter schema_version "2.4" shape (input_modalities[].supported_inputs.max_context_length.value) the shared parser does not read; the 10 exact-id rows are pinned from the LIVE probe 2026-10-04.',
    },
  ],
  [
    'chatanywhere',
    {
      disposition: 'table-section',
      note: 'Static 27-model chat catalog (FID-2026-1005-010). The keyed /v1/models publishes NO window fields (row shape id/object/created/owned_by, 30 rows, probed 2026-10-05); 13 exact-id rows are cross-gateway consensus in the context-window-table-chatanywhere seam, 14 ids documented no-row.',
    },
  ],
  [
    'codecraft',
    {
      disposition: 'no-runtime-rows',
      note: 'Live catalog auth-gated: HTTP 401 keyless (probed 2026-10-04) — zero rows without CODECRAFT_API_KEY. Not dead; self-populates when a key is configured.',
    },
  ],
  [
    'xkiro',
    {
      disposition: 'no-runtime-rows',
      note: 'Live catalog NOW KEYLESS: HTTP 200 with 129 rows carrying context_length (probed 2026-10-04 — the T119-era 403 lifted). Fetcher is wired in gateway.ts; the runtime snapshot predates the lift, so rows appear on the next catalog rebuild and self-correct thereafter.',
    },
  ],
  [
    'openai',
    {
      disposition: 'runtime-published',
      note: '102/102 runtime rows carry context_length (census 2026-10-04).',
    },
  ],
  [
    'vercel',
    {
      disposition: 'runtime-published',
      note: '383/406 runtime rows publish; the 23 silent ids are all non-chat voice/tts/transcribe (register documented in context-window-table.ts, FID-2026-1004-002).',
    },
  ],
  [
    'cleanapis',
    {
      disposition: 'no-runtime-rows',
      note: 'Live catalog auth-gated (401 keyless — registry comment probe reconfirmed by the 2026-10-04 census) — zero rows without CLEANAPIS_API_KEY. Not dead; self-populates when a key is configured.',
    },
  ],
])
