/**
 * FID-2026-1004-002 — bai roster window pins.
 *
 * B.AI publishes NO window fields on /v1/models, so the fallback-table
 * section is the only source. Operator-ruled sourcing: cross-gateway rows
 * only. Split from window-truth.test.ts to respect the 300-line quality
 * ceiling (kiosapi seam-split precedent, FID-2026-1003-008).
 */

import fs from 'node:fs'
import path from 'node:path'

import { BAI_NO_ROW_IDS } from '@savant-code/common/constants/context-window-table-bai'
import {
  CONTEXT_WINDOW_FALLBACKS,
  getContextWindowFallback,
} from '@savant-code/common/constants/context-windows'
import { describe, expect, test } from 'bun:test'

const sectionPath = (): string =>
  path.join(
    path.resolve(import.meta.dir, '../../../../..'),
    'common/src/constants/context-window-table-bai.ts',
  )

describe('FID-2026-1004-002: bai roster windows', () => {
  test('every section row is wired into the Map (seam census, Law 4)', () => {
    const source = fs.readFileSync(sectionPath(), 'utf8')
    const keys = [...source.matchAll(/\['(bai\/[^']+)',\s*\d[\d_]*\]/g)].map(
      (m) => m[1],
    )
    expect(keys.length).toBe(41)
    const missing = keys.filter((key) => !CONTEXT_WINDOW_FALLBACKS.has(key))
    expect(missing).toEqual([])
  })

  test('spot windows across the roster (cross-gateway consensus)', () => {
    expect(getContextWindowFallback('bai/claude-haiku-4.5').contextWindow).toBe(
      200_000,
    )
    expect(getContextWindowFallback('bai/glm-5.1').contextWindow).toBe(204_800)
    expect(getContextWindowFallback('bai/glm-5.2').contextWindow).toBe(
      1_048_576,
    )
    expect(getContextWindowFallback('bai/glm-5.3').contextWindow).toBe(
      1_000_000,
    )
    expect(getContextWindowFallback('bai/glm-5.3-flash').contextWindow).toBe(
      1_048_575,
    )
    expect(getContextWindowFallback('bai/gpt-5.5').contextWindow).toBe(
      1_050_000,
    )
    expect(getContextWindowFallback('bai/kimi-k2.6').contextWindow).toBe(
      262_144,
    )
    expect(getContextWindowFallback('bai/kimi-k3').contextWindow).toBe(
      1_048_576,
    )
    expect(getContextWindowFallback('bai/mimo-v2.5').contextWindow).toBe(
      1_048_576,
    )
    expect(getContextWindowFallback('bai/mimo-v2.5-pro').contextWindow).toBe(
      1_050_000,
    )
    expect(getContextWindowFallback('bai/minimax-m2.7').contextWindow).toBe(
      204_800,
    )
    expect(getContextWindowFallback('bai/qwen3.8-27b').contextWindow).toBe(
      1_000_000,
    )
    expect(getContextWindowFallback('bai/qwen3.8-flash').contextWindow).toBe(
      1_000_000,
    )
  })

  test('serving variants inherit their parent windows', () => {
    expect(getContextWindowFallback('bai/gpt-5.5-instant').contextWindow).toBe(
      getContextWindowFallback('bai/gpt-5.5').contextWindow,
    )
  })

  test('no-source ids stay on the flagged conservative default', () => {
    for (const [id] of BAI_NO_ROW_IDS) {
      expect(getContextWindowFallback(id)).toEqual({
        contextWindow: 200_000,
        source: 'default',
      })
    }
  })

  test('no-row register ids never gained a table row behind the register', () => {
    const rowed = BAI_NO_ROW_IDS.filter(([id]) =>
      CONTEXT_WINDOW_FALLBACKS.has(id),
    )
    expect(rowed).toEqual([])
  })
})
