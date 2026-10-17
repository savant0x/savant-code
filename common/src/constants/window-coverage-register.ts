import { TIER1_WINDOW_COVERAGE_ENTRIES } from './window-coverage-register-tier1'

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
  'tiarina',
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
      // FID-2026-1010-001: the authenticated /v1/models DOES publish
      // context_length for 51 of 68 ids (probed 2026-10-10) — the entry
      // stays `table-section` because the checked-in catalog is static and
      // the table is its pinned source, but the note must not claim the
      // vendor publishes nothing (the intern entry's stated divergence is
      // the same shape).
      disposition: 'table-section',
      note: 'Static catalog (68 ids, FID-2026-1010-001). The authenticated /v1/models publishes context_length for 51/68 ids (probed 2026-10-10); the checked-in table section remains the pinned source, with the 17 null-publishing ids cross-voted or conservatively pinned (3 NEEDS-REVIEW). FID-2026-0916-002/-004.',
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
      disposition: 'runtime-published',
      note: 'Reconciled from census 33 rows (FID-2026-1006-001, 2026-10-06); live catalog auth-gated — 401 keyless (probed 2026-10-04), self-populates when a key is configured.',
    },
  ],
  [
    'xkiro',
    {
      disposition: 'runtime-published',
      note: 'Live catalog keyless: HTTP 200 with 129 rows carrying context_length (probed 2026-10-04 — the T119-era 403 lifted); reconfirmed 129 rows by the FID-2026-1006-001 census 2026-10-06.',
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
      disposition: 'runtime-published',
      note: 'Reconciled from census 33 rows (FID-2026-1006-001, 2026-10-06); live catalog auth-gated — 401 keyless (probed 2026-10-04), self-populates when a key is configured.',
    },
  ],
  [
    'mistral',
    {
      // FID-2026-1009-005: chat rows publish `max_context_length` (probed
      // 2026-10-09, 46-row authenticated catalog), usable only after the
      // dedicated parser maps it to contextLength — the shared parser reads
      // `context_length` and would extract zero. The roster is MIXED
      // (embeddings, moderation, OCR, audio alongside chat), so only a
      // full-roster census — not sampling — would justify
      // `runtime-published`; `runtime-partial` is the truthful default.
      disposition: 'runtime-partial',
      note: 'Live catalog auth-gated (401 keyless, probed 2026-10-09); 46 rows authenticated, chat rows publish max_context_length via the dedicated parser (cli/src/utils/openrouter-models/mistral.ts). Mixed roster (embeddings/moderation/OCR/audio) — full-roster census pending before runtime-published.',
    },
  ],
  [
    'tiarina',
    {
      disposition: 'table-section',
      note: 'Static 19-model catalog (FID-2026-1012-005). The keyed /v1/models publishes NO window fields (row shape id/object/created/owned_by — 19 rows, 0 window fields, probed 2026-10-12); 18 exact-id rows are cross-gateway consensus in the context-window-table-tiarina seam and 1 id (glm-4.7-flash) is documented no-row.',
    },
  ],
  [
    'apixo',
    {
      // FID-2026-1013-003: the vendor's own catalog publishes the window on
      // every row, so the runtime value is the source of truth and no
      // fallback-table section is owed.
      disposition: 'runtime-published',
      note: 'Live catalog keyless: HTTP 200 with 35/35 rows carrying context_window + max_output_tokens (probed 2026-10-13, FID-2026-1013-003); the keyless body is byte-identical to the authenticated one, so no key is needed for the census.',
    },
  ],
  [
    'aihubmix',
    {
      // FID-2026-1013-004: the rich public catalog retains all 698 LLM rows,
      // but the vendor publishes positive limits only on a subset. Zero and
      // missing values remain unknown rather than inheriting a fallback.
      disposition: 'runtime-partial',
      note: 'Live catalog keyless: HTTP 200 with 869 rows and 698 LLM rows (probed 2026-10-13); positive finite context_length on 358/698 and max_output on 306/698. 642/698 LLM rows have empty endpoints; rows remain retained because endpoints metadata is sparse (FID-2026-1013-004).',
    },
  ],
  [
    'ashna',
    {
      // FID-2026-1016-018: the keyed catalog publishes NO window fields on
      // any row (shape id/object/created/owned_by), so exact windows come
      // from the cross-gateway consensus table and the rest keep default.
      disposition: 'table-section',
      note: 'Live catalog auth-gated (401 keyless, probed 2026-10-16); 104 rows authenticated, none carry window fields. 28 exact-id rows are cross-gateway consensus in the context-window-table-ashna seam; the remaining 50 retained ids are documented no-row (aliases/variants/unrowed upstreams) in the same seam.',
    },
  ],
  ...TIER1_WINDOW_COVERAGE_ENTRIES,
])
