/**
 * FID-2026-1004-002 — apinex roster window pins.
 *
 * APInex publishes NO window fields on /v1/models (runtime-catalog row shape
 * observed 2026-10-04: {id, name, provider}), so the fallback-table section
 * is the only source. Operator-ruled sourcing: cross-gateway rows only.
 * Split from window-truth.test.ts to respect the 300-line quality ceiling
 * (kiosapi seam-split precedent, FID-2026-1003-008).
 */

import fs from 'node:fs'
import path from 'node:path'

import { APINEX_NO_ROW_IDS } from '@savant-code/common/constants/context-window-table-apinex'
import {
  CONTEXT_WINDOW_FALLBACKS,
  getContextWindowFallback,
} from '@savant-code/common/constants/context-windows'
import { describe, expect, test } from 'bun:test'

const sectionPath = (): string =>
  path.join(
    path.resolve(import.meta.dir, '../../../../..'),
    'common/src/constants/context-window-table-apinex.ts',
  )

describe('FID-2026-1004-002: apinex roster windows', () => {
  test('every section row is wired into the Map (seam census, Law 4)', () => {
    const source = fs.readFileSync(sectionPath(), 'utf8')
    const keys = [...source.matchAll(/\['(apinex\/[^']+)',\s*\d[\d_]*\]/g)].map(
      (m) => m[1],
    )
    expect(keys.length).toBe(32)
    const missing = keys.filter((key) => !CONTEXT_WINDOW_FALLBACKS.has(key))
    expect(missing).toEqual([])
  })

  test('the audit probe row resolves 1M from the fallback table', () => {
    // The row the coverage audit printed as the silent-200k reproducible.
    expect(getContextWindowFallback('apinex/free/qwen-3.8-max')).toEqual({
      contextWindow: 1_000_000,
      source: 'fallback-table',
    })
  })

  test('spot windows across the roster (cross-gateway consensus)', () => {
    expect(getContextWindowFallback('apinex/kimi-k3').contextWindow).toBe(
      1_048_576,
    )
    expect(getContextWindowFallback('apinex/glm-5.3').contextWindow).toBe(
      1_000_000,
    )
    expect(getContextWindowFallback('apinex/glm-5.3-flash').contextWindow).toBe(
      1_048_575,
    )
    expect(getContextWindowFallback('apinex/gpt-6.1-sol').contextWindow).toBe(
      1_050_000,
    )
    expect(
      getContextWindowFallback('apinex/free/deepseek-v4-flash-0731')
        .contextWindow,
    ).toBe(1_310_720)
    expect(
      getContextWindowFallback('apinex/claude-fable-5.1').contextWindow,
    ).toBe(1_000_000)
    expect(getContextWindowFallback('apinex/grok-4.7').contextWindow).toBe(
      500_000,
    )
    expect(getContextWindowFallback('apinex/gpt-5.6-terra').contextWindow).toBe(
      1_050_000,
    )
  })

  test('dated snapshots inherit their parent windows', () => {
    expect(
      getContextWindowFallback('apinex/free/deepseek-v4-pro-0813')
        .contextWindow,
    ).toBe(getContextWindowFallback('apinex/deepseek-v4-pro').contextWindow)
  })

  test('no-source ids stay on the flagged conservative default', () => {
    for (const [id] of APINEX_NO_ROW_IDS) {
      expect(getContextWindowFallback(id)).toEqual({
        contextWindow: 200_000,
        source: 'default',
      })
    }
  })

  test('no-row register ids never gained a table row behind the register', () => {
    const rowed = APINEX_NO_ROW_IDS.filter(([id]) =>
      CONTEXT_WINDOW_FALLBACKS.has(id),
    )
    expect(rowed).toEqual([])
  })
})
