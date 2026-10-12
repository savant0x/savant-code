/**
 * FID-2026-1012-005 — tiarina roster window pins.
 *
 * Tiarina Cloud publishes NO window fields on `/v1/models` (probe 2026-10-12:
 * 19 rows, fields observed `created, id, object, owned_by` — 0 window fields),
 * so the fallback table is the ONLY source. Every row is a cross-gateway row for
 * the same upstream model, and two of them are pinned at the conservative
 * MINIMUM of two disagreeing >=2-row groups rather than at the higher vote.
 * Split into its own suite because the provider is a `NO_PUBLISH_GATEWAY_IDS`
 * member, which the register lint requires to carry both a seam file and a
 * window-truth suite (window-coverage-register.test.ts:67-83).
 */

import fs from 'node:fs'
import path from 'node:path'

import { TIARINA_NO_ROW_IDS } from '@savant-code/common/constants/context-window-table-tiarina'
import {
  CONTEXT_WINDOW_FALLBACKS,
  getContextWindowFallback,
} from '@savant-code/common/constants/context-windows'
import { tiarinaModels } from '@savant-code/common/constants/model-config'
import { describe, expect, test } from 'bun:test'

describe('FID-2026-1012-005: tiarina roster windows', () => {
  test('spot windows across the roster (cross-gateway consensus)', () => {
    expect(
      getContextWindowFallback('tiarina/deepseek-v4.1-flash').contextWindow,
    ).toBe(1_048_576)
    expect(
      getContextWindowFallback('tiarina/deepseek-v4-pro').contextWindow,
    ).toBe(1_048_576)
    expect(getContextWindowFallback('tiarina/glm-5.3').contextWindow).toBe(
      1_000_000,
    )
    expect(getContextWindowFallback('tiarina/glm-5.2').contextWindow).toBe(
      1_048_576,
    )
    expect(getContextWindowFallback('tiarina/glm-4.7-flash')).toEqual({
      contextWindow: 200_000,
      source: 'default',
    })
    expect(getContextWindowFallback('tiarina/kimi-k3').contextWindow).toBe(
      1_048_576,
    )
    expect(getContextWindowFallback('tiarina/kimi-k2.6').contextWindow).toBe(
      262_144,
    )
    expect(
      getContextWindowFallback('tiarina/kimi-k2.7-code').contextWindow,
    ).toBe(262_144)
    expect(getContextWindowFallback('tiarina/qwen3.8-max').contextWindow).toBe(
      1_000_000,
    )
    expect(getContextWindowFallback('tiarina/qwen3.7-plus').contextWindow).toBe(
      1_000_000,
    )
    expect(getContextWindowFallback('tiarina/qwen3.8-flash')).toEqual({
      contextWindow: 1_000_000,
      source: 'fallback-table',
    })
    expect(getContextWindowFallback('tiarina/gpt-oss-120b').contextWindow).toBe(
      131_072,
    )
    expect(
      getContextWindowFallback('tiarina/mimo-v2.6-flash:free').contextWindow,
    ).toBe(1_048_576)
  })

  test('free and channel variants are rowed, not left on the default', () => {
    // The kiosapi lesson: a suffixed id is a separate roster entry. Leaving it
    // unrowed silently re-lands it on the 5x-small denominator.
    for (const variant of [
      'tiarina/deepseek-v4.1-flash:free',
      'tiarina/deepseek-v4-flash:free',
      'tiarina/glm-5.3-flash:free',
      'tiarina/qwen3.8-flash:free',
      'tiarina/mimo-v2.6-flash:free',
      'tiarina/deepseek-v4-pro:cloudflare',
      'tiarina/glm-5.3:cloudflare',
    ]) {
      expect(getContextWindowFallback(variant).source, variant).toBe(
        'fallback-table',
      )
    }
    // Channel variants mirror their bare parent's consensus value.
    expect(
      getContextWindowFallback('tiarina/deepseek-v4-pro:cloudflare')
        .contextWindow,
    ).toBe(getContextWindowFallback('tiarina/deepseek-v4-pro').contextWindow)
    expect(
      getContextWindowFallback('tiarina/glm-5.3:cloudflare').contextWindow,
    ).toBe(getContextWindowFallback('tiarina/glm-5.3').contextWindow)
  })

  test('no-source ids stay on the flagged conservative default', () => {
    expect(TIARINA_NO_ROW_IDS.map(([id]) => id)).toEqual([
      'tiarina/glm-4.7-flash',
    ])
    for (const [id] of TIARINA_NO_ROW_IDS) {
      expect(getContextWindowFallback(id)).toEqual({
        contextWindow: 200_000,
        source: 'default',
      })
    }
  })

  test('every catalog id is either rowed or documented as no-row', () => {
    // Total coverage: the 19 measured ids are partitioned between the seam rows
    // and the documented no-row list — no id can drift in unaccounted for.
    const catalogIds = Object.values(tiarinaModels)
    expect(catalogIds).toHaveLength(19)
    const unaccounted = catalogIds.filter(
      (id) =>
        !CONTEXT_WINDOW_FALLBACKS.has(id) &&
        !TIARINA_NO_ROW_IDS.some(([noRowId]) => noRowId === id),
    )
    expect(unaccounted).toEqual([])
  })

  test('every row in the seam-split tiarina file is wired into the Map', () => {
    // Seam-wiring census (Law 4): if the spread in context-window-table.ts is
    // ever dropped, every row below fails here instead of silently reverting
    // 19 ids to the 200k default.
    const tablePath = path.join(
      path.resolve(import.meta.dir, '../../../../..'),
      'common/src/constants/context-window-table-tiarina.ts',
    )
    const source = fs.readFileSync(tablePath, 'utf8')
    const keys = [
      ...source.matchAll(/\['(tiarina\/[^']+)',\s*\d[\d_]*\]/g),
    ].map((m) => m[1])
    expect(keys).toHaveLength(18)
    const missing = keys.filter((key) => !CONTEXT_WINDOW_FALLBACKS.has(key))
    expect(missing).toEqual([])
  })
})
