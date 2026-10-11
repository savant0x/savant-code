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
 *
 * FID-2026-1010-003 — the same defect class returned on the model the
 * operator was running: `kiosapi/step-5-preview` had no row either, so the
 * ladder closed on the 200k default while upstream reads 1,000,000. The
 * two pins below are the regression guard for that report.
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

  // FID-2026-1010-003: the operator was running step-5-preview through
  // kiosapi and watched the sidebar report a 200k window on a model whose
  // upstream capability is 1M. OpenRouter live read 2026-10-10 for upstream
  // `stepfun/step-5-preview`: context_length 1,000,000, top_provider agrees,
  // modality text+image+video->text, max_completion_tokens 64,000.
  test('step-5-preview resolves 1M, not the 200k default', () => {
    expect(getContextWindowFallback('kiosapi/step-5-preview')).toEqual({
      contextWindow: 1_000_000,
      source: 'fallback-table',
    })
    // The :free id is a separate roster entry and must be pinned too, or
    // KiosAPI's free tier silently re-lands on the 5x-small denominator.
    expect(getContextWindowFallback('kiosapi/step-5-preview-free')).toEqual({
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
