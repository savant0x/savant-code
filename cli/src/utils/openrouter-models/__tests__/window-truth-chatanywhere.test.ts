/**
 * FID-2026-1005-010 — chatanywhere roster window pins.
 *
 * ChatAnywhere publishes NO window fields on /v1/models (runtime-catalog row
 * shape observed 2026-10-05: {id, object, created, owned_by}), so the
 * fallback-table section is the only source. Sourcing: cross-gateway rows
 * only (the apinex operator-ruled pattern).
 * Split from window-truth.test.ts to respect the 300-line quality ceiling
 * (kiosapi seam-split precedent, FID-2026-1003-008).
 */

import fs from 'node:fs'
import path from 'node:path'

import { CHATANYWHERE_NO_ROW_IDS } from '@savant-code/common/constants/context-window-table-chatanywhere'
import {
  CONTEXT_WINDOW_FALLBACKS,
  getContextWindowFallback,
} from '@savant-code/common/constants/context-windows'
import { describe, expect, test } from 'bun:test'

const sectionPath = (): string =>
  path.join(
    path.resolve(import.meta.dir, '../../../../..'),
    'common/src/constants/context-window-table-chatanywhere.ts',
  )

describe('FID-2026-1005-010: chatanywhere roster windows', () => {
  test('every section row is wired into the Map (seam census, Law 4)', () => {
    const source = fs.readFileSync(sectionPath(), 'utf8')
    const keys = [
      ...source.matchAll(/\['(chatanywhere\/[^']+)',\s*\d[\d_]*\]/g),
    ].map((m) => m[1])
    expect(keys.length).toBe(13)
    const missing = keys.filter((key) => !CONTEXT_WINDOW_FALLBACKS.has(key))
    expect(missing).toEqual([])
  })

  test('the vendor-pinned probe row resolves from the fallback table', () => {
    // gpt-5.6-sol: cross-gateway consensus 1,050,000 (BR+TR+TH+CC); the
    // vendor pricing page states only a ">= 272,000" floor (2026-10-05).
    expect(getContextWindowFallback('chatanywhere/gpt-5.6-sol')).toEqual({
      contextWindow: 1_050_000,
      source: 'fallback-table',
    })
  })

  test('spot windows across the roster (cross-gateway consensus)', () => {
    expect(
      getContextWindowFallback('chatanywhere/gpt-6-astra').contextWindow,
    ).toBe(1_050_000)
    expect(
      getContextWindowFallback('chatanywhere/gpt-6.1-sol').contextWindow,
    ).toBe(1_050_000)
    expect(
      getContextWindowFallback('chatanywhere/deepseek-v4-pro').contextWindow,
    ).toBe(1_048_576)
    expect(
      getContextWindowFallback('chatanywhere/deepseek-v4.1-flash')
        .contextWindow,
    ).toBe(1_048_576)
    expect(
      getContextWindowFallback('chatanywhere/deepseek-v3.2').contextWindow,
    ).toBe(163_840)
  })

  test('no-source ids stay on the flagged conservative default', () => {
    for (const [id] of CHATANYWHERE_NO_ROW_IDS) {
      expect(getContextWindowFallback(id)).toEqual({
        contextWindow: 200_000,
        source: 'default',
      })
    }
  })
})
