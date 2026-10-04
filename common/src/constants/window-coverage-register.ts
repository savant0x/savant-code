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
      note: 'Static catalog, zero runtime rows observed (census 2026-10-04) — T128-f census pending.',
    },
  ],
  [
    'ollama',
    {
      disposition: 'local',
      note: 'Local daemon; model list comes from the local runtime, not a gateway catalog.',
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
    'codecraft',
    {
      disposition: 'no-runtime-rows',
      note: 'Live catalog, zero runtime rows observed (census 2026-10-04) — T128-f census pending.',
    },
  ],
  [
    'xkiro',
    {
      disposition: 'no-runtime-rows',
      note: 'Live catalog, zero runtime rows (HTTP 403 paywall observed, T119) — T128-f census pending.',
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
      note: 'Live catalog, zero runtime rows observed (census 2026-10-04) — T128-f census pending.',
    },
  ],
])
