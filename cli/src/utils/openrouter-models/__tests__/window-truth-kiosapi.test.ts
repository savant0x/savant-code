/**
 * FID-2026-1003-008 — kiosapi roster window pins.
 *
 * KiosAPI publishes NO window fields on /v1/models (probe 2026-10-03:
 * fields observed: created, id, object, owned_by, supported_endpoint_types),
 * so the fallback table is the ONLY source. The operator-reported bug row
 * (`kiosapi/qwen3.8-flash-free`) resolved to the 200k default while the
 * model serves 1M, steering compaction with a 5x-small denominator until a
 * run died on RequestInputBudgetError (estimate 1,347,990 vs window
 * 1,000,000). Split from window-truth.test.ts to respect the 300-line
 * quality ceiling (FID-2026-0919-019 seam-split precedent).
 */

import fs from 'node:fs'
import path from 'node:path'

import {
  CONTEXT_WINDOW_FALLBACKS,
  getContextWindowFallback,
} from '@savant-code/common/constants/context-windows'
import { describe, expect, test } from 'bun:test'

describe('FID-2026-1003-008: kiosapi roster windows', () => {
  test('the operator-bug row resolves 1M from the fallback table', () => {
    expect(getContextWindowFallback('kiosapi/qwen3.8-flash-free')).toEqual({
      contextWindow: 1_000_000,
      source: 'fallback-table',
    })
  })

  test('spot windows across the roster (OR-live 2026-10-03 + cross-votes)', () => {
    expect(
      getContextWindowFallback('kiosapi/qwen3.8-27b-free').contextWindow,
    ).toBe(1_000_000)
    expect(
      getContextWindowFallback('kiosapi/glm-5.3-flash').contextWindow,
    ).toBe(1_048_575)
    expect(
      getContextWindowFallback('kiosapi/deepseek-v4-pro').contextWindow,
    ).toBe(1_048_576)
    expect(
      getContextWindowFallback('kiosapi/claude-opus-5').contextWindow,
    ).toBe(1_000_000)
    expect(getContextWindowFallback('kiosapi/gpt-6.1-sol').contextWindow).toBe(
      1_050_000,
    )
    expect(
      getContextWindowFallback('kiosapi/grok-4.7-free').contextWindow,
    ).toBe(500_000)
    expect(
      getContextWindowFallback('kiosapi/step-3.7-flash').contextWindow,
    ).toBe(262_144)
    expect(
      getContextWindowFallback('kiosapi/space-bunny-alpha').contextWindow,
    ).toBe(1_000_000)
  })

  test('per-call -req variants inherit their parent windows', () => {
    expect(
      getContextWindowFallback('kiosapi/claude-opus-4-8-req').contextWindow,
    ).toBe(getContextWindowFallback('kiosapi/claude-opus-4-8').contextWindow)
    expect(
      getContextWindowFallback('kiosapi/deepseek-v4.1-flash-req').contextWindow,
    ).toBe(
      getContextWindowFallback('kiosapi/deepseek-v4.1-flash').contextWindow,
    )
    expect(
      getContextWindowFallback('kiosapi/glm-5.3-flash-req').contextWindow,
    ).toBe(getContextWindowFallback('kiosapi/glm-5.3-flash').contextWindow)
  })

  test('no-source ids stay on the flagged conservative default', () => {
    for (const id of [
      'kiosapi/big-pickle',
      'kiosapi/fledge-alpha',
      'kiosapi/kilo-auto',
      'kiosapi/longcat-2.5-preview',
      'kiosapi/gpt-image-2',
      'kiosapi/gpt-image-2.5-sunburst',
    ]) {
      expect(getContextWindowFallback(id)).toEqual({
        contextWindow: 200_000,
        source: 'default',
      })
    }
  })

  test('every row in the seam-split kiosapi file is wired into the Map', () => {
    // Seam-wiring census (Law 4): if the spread in context-window-table.ts
    // is ever dropped, every row below fails here instead of silently
    // reverting 69 ids to the 200k default.
    const tablePath = path.join(
      path.resolve(import.meta.dir, '../../../../..'),
      'common/src/constants/context-window-table-kiosapi.ts',
    )
    const source = fs.readFileSync(tablePath, 'utf8')
    const keys = [
      ...source.matchAll(/\['(kiosapi\/[^']+)',\s*\d[\d_]*\]/g),
    ].map((m) => m[1])
    expect(keys.length).toBeGreaterThan(60)
    const missing = keys.filter((key) => !CONTEXT_WINDOW_FALLBACKS.has(key))
    expect(missing).toEqual([])
  })
})
