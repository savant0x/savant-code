/**
 * FID-2026-1012-005 — Tiarina Cloud (ai.tiarina.cloud) pins.
 *
 * Locks the 19-model static-catalog integration:
 * 1. Every `tiarina/` id is cataloged in the common model map and served by the
 *    cli fetcher with its display name.
 * 2. Each window resolves from the fallback table to a CROSS-GATEWAY row
 *    (>=2 existing rows for the same upstream model) — compared against the
 *    independent oracle below, never against the same table the fetcher reads
 *    (the intern audit's anti-tautology rule).
 * 3. The one id with no cross-gateway row keeps the flagged conservative
 *    default instead of an invented window.
 * 4. The registry entry is a static, single-protocol, setup-available gateway on
 *    the probed OpenAI-compatible base URL, carrying console-verified roster
 *    evidence (FID-2026-1005-009).
 * 5. The provider declares a coverage disposition, is a member of
 *    `NO_PUBLISH_GATEWAY_IDS` (membership is what mechanically enforces the seam
 *    file + the window-truth suite), and derives ZERO exception kinds — so no
 *    manifest entry may exist for it.
 */
import {
  CONTEXT_WINDOW_FALLBACKS,
  getContextWindowFallback,
} from '@savant-code/common/constants/context-windows'
import { tiarinaModels } from '@savant-code/common/constants/model-config'
import {
  NO_PUBLISH_GATEWAY_IDS,
  WINDOW_COVERAGE_REGISTER,
} from '@savant-code/common/constants/window-coverage-register'
import { PROVIDER_EXCEPTION_MANIFEST } from '@savant-code/common/providers/provider-exception-manifest'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { describe, expect, test } from 'bun:test'

import { fetchTiarinaModels } from '../tiarina'

/**
 * The cross-gateway consensus rows, transcribed from the table read in the
 * FID's AUDIT round (rows cited in the seam file). This list is the independent
 * oracle: the fetcher derives its window from `getContextWindowFallback`, so
 * comparing the two would be a tautology.
 */
const CROSS_GATEWAY_ROWS: ReadonlyArray<readonly [string, number]> = [
  ['tiarina/deepseek-v4.1-flash', 1_048_576],
  ['tiarina/deepseek-v4.1-flash:free', 1_048_576],
  ['tiarina/deepseek-v4-flash:free', 1_048_576],
  ['tiarina/deepseek-v4-pro', 1_048_576],
  ['tiarina/deepseek-v4-pro:cloudflare', 1_048_576],
  ['tiarina/glm-5.3', 1_000_000],
  ['tiarina/glm-5.3:cloudflare', 1_000_000],
  ['tiarina/glm-5.3-flash:free', 1_048_575],
  ['tiarina/glm-5.2', 1_048_576],
  ['tiarina/kimi-k3', 1_048_576],
  ['tiarina/kimi-k2.6', 262_144],
  ['tiarina/kimi-k2.7-code', 262_144],
  ['tiarina/qwen3.8-max', 1_000_000],
  ['tiarina/qwen3.7-plus', 1_000_000],
  ['tiarina/qwen3.8-flash', 1_000_000],
  ['tiarina/qwen3.8-flash:free', 1_000_000],
  ['tiarina/mimo-v2.6-flash:free', 1_048_576],
  ['tiarina/gpt-oss-120b', 131_072],
]

/** The one measured id with no cross-gateway row anywhere in the table. */
const NO_ROW_ID = 'tiarina/glm-4.7-flash'

describe('FID-2026-1012-005: tiarina static catalog', () => {
  test('the catalog is exactly the 19 measured ids, routing-prefixed', () => {
    const catalogIds: string[] = Object.values(tiarinaModels)
    const oracleIds = [...CROSS_GATEWAY_ROWS.map(([id]) => id), NO_ROW_ID]
    expect(catalogIds).toHaveLength(19)
    expect([...catalogIds].sort()).toEqual([...oracleIds].sort())
    for (const id of catalogIds) {
      expect(id.startsWith('tiarina/')).toBe(true)
    }
  })

  test('the cli fetcher serves every id with its pinned window', () => {
    const oracle = new Map<string, number>(CROSS_GATEWAY_ROWS)
    const models = fetchTiarinaModels()
    expect(models).toHaveLength(19)
    for (const model of models) {
      expect(model.provider).toBe('tiarina')
      // Display name is the vendor's own bare id, not the routing-prefixed one.
      expect(model.name).toBe(model.id.slice('tiarina/'.length))
      const expected = oracle.get(model.id) ?? 200_000
      expect(model.contextLength, model.id).toBe(expected)
    }
  })

  test('every window is the cross-gateway row from the seam file', () => {
    for (const [id, window] of CROSS_GATEWAY_ROWS) {
      expect(CONTEXT_WINDOW_FALLBACKS.get(id), id).toBe(window)
    }
    // The two conflict rows are pinned at the MINIMUM of their disagreeing
    // >=2-row groups, never at the higher vote.
    expect(CONTEXT_WINDOW_FALLBACKS.get('tiarina/glm-5.3')).toBe(1_000_000)
    expect(CONTEXT_WINDOW_FALLBACKS.get('tiarina/glm-5.3-flash:free')).toBe(
      1_048_575,
    )
  })

  test('the no-row id keeps the flagged conservative default', () => {
    expect(CONTEXT_WINDOW_FALLBACKS.has(NO_ROW_ID)).toBe(false)
    expect(getContextWindowFallback(NO_ROW_ID)).toEqual({
      contextWindow: 200_000,
      source: 'default',
    })
  })

  test('registry entry is a static single-protocol setup-available gateway', () => {
    const entry = PROVIDER_REGISTRY.tiarina
    expect(entry.id).toBe('tiarina')
    expect(entry.label).toBe('Tiarina Cloud')
    expect(entry.kind).toBe('gateway')
    expect(entry.setupAvailable).toBe(true)
    expect(entry.credentials.envVar).toBe('TIARINA_API_KEY')
    expect(entry.baseUrl).toBe('https://ai.tiarina.cloud/v1')
    // Single protocol: the vendor's Anthropic claim is refuted on the wire
    // (keyed POST /v1/messages -> 404), so no protocolMap may appear here.
    expect(entry.protocol).toBe('openai')
    // No protocolMap on this entry at all (the literal type omits it) — a
    // mixed roster would need one, and this roster is measured single-protocol.
    expect(Object.hasOwn(entry, 'protocolMap')).toBe(false)
    expect(entry.idTransform).toBe('strip')
    expect(entry.domain).toBe('tiarina.cloud')
    expect(entry.order).toBe(4)
    const catalog = entry.catalog
    expect(catalog.source).toBe('static')
    if (catalog.source !== 'static') throw new Error('unreachable')
    expect(catalog.modelsRef).toBe('tiarina')
    expect(catalog.evidence).toEqual({
      class: 'console-verified',
      source:
        'GET https://ai.tiarina.cloud/v1/models (auth) — 19 rows observed 2026-10-12, every item carrying only id/object/created/owned_by',
      verified: '2026-10-12',
      witness: 'FID-2026-1012-005 live-probe receipt',
    })
  })

  test('the no-publish classification is what enforces the seam guards', () => {
    expect(WINDOW_COVERAGE_REGISTER.get('tiarina')?.disposition).toBe(
      'table-section',
    )
    expect(NO_PUBLISH_GATEWAY_IDS).toContain('tiarina')
  })

  test('no exception-manifest entry exists (this shape derives zero kinds)', () => {
    const owned = PROVIDER_EXCEPTION_MANIFEST.filter(
      (entry) => entry.providerId === 'tiarina',
    )
    expect(owned).toEqual([])
  })
})
