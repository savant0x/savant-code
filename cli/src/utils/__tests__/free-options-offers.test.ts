/**
 * FID-2026-1016-010 — advertised-offer DISPLAY pins (bounded command view,
 * grouped markdown reference, catalog delta), split out of
 * free-options.test.ts when the 300-line ceiling refused that file. The rows
 * come from free-options-test-fixtures.ts, shared with the announce pins.
 */
import { describe, expect, test } from 'bun:test'

import {
  buildFreeOptionsReport,
  renderCommandOutput,
  renderFreeOptionsMarkdown,
} from '../free-options'
import { catalogDeltaLine } from '../free-options-offers'
import { CATALOG, CTX, offerRow } from './free-options-test-fixtures'

import type { FreeOfferRow } from '../free-options-types'

describe('FID-2026-1016-010: offer rows are bounded, grouped and attributed', () => {
  const known = (n: number, category: string): FreeOfferRow =>
    offerRow({
      title: `Known ${String(n).padStart(2, '0')}`,
      category,
      deadlineLabel: 'advertised deadline 2026-10-31',
      providerLabels: ['Vercel AI Gateway'],
    })
  // 12 attributed rows (11 Coding, 1 Student) + 2 unattributed: 64%-style
  // dumps are what the command view must stop printing.
  const rows: FreeOfferRow[] = [
    ...Array.from({ length: 11 }, (_, i) => known(i + 1, 'Coding')),
    known(12, 'Student'),
    offerRow({ title: 'Unattributed A', category: 'Startup programs' }),
    offerRow({ title: 'Unattributed B', category: 'Startup programs' }),
  ]
  const report = {
    ...buildFreeOptionsReport(CATALOG, CTX),
    discoveryOffers: rows,
    discoveryOffersEndingSoon: 1,
  }

  test('the command view bounds the attributed list and counts the remainder', () => {
    const joined = renderCommandOutput(report).join('\n')
    expect(joined).toContain(
      'Advertised offers naming a provider in your registry (12 of 14):',
    )
    expect(joined).toContain(
      '- Known 01 — advertised deadline 2026-10-31 · known: Vercel AI Gateway',
    )
    expect(joined).toContain('- Known 10 —')
    expect(joined).not.toContain('- Known 11 —')
    expect(joined).toContain(
      '… and 2 more — the full list is in free-options.md',
    )
    expect(joined).toContain(
      'Categories: Coding 11 · Startup programs 2 · Student 1',
    )
  })

  test('the markdown reference keeps every offer, grouped, with marks', () => {
    const md = renderFreeOptionsMarkdown(report)
    expect(md).toContain('## Advertised offers')
    expect(md).toContain('### Coding (11)')
    expect(md).toContain('### Startup programs (2)')
    expect(md).toContain('### Student (1)')
    const offerLines = md
      .split('\n')
      .filter((line) => /^- \[(Known|Unattributed)/.test(line))
    expect(offerLines.length).toBe(14)
    expect(md).toContain('· known: Vercel AI Gateway')
  })

  test('an unattributed-only feed says so instead of printing a dump', () => {
    const joined = renderCommandOutput({
      ...report,
      discoveryOffers: [offerRow({ title: 'Solo' })],
    }).join('\n')
    expect(joined).toContain('(0 of 1):')
    expect(joined).toContain(
      'none — every advertised offer is unattributed review material',
    )
    expect(joined).toContain('Categories: API providers 1')
  })

  test('the catalog delta reaches both headers and vanishes when empty', () => {
    const base = buildFreeOptionsReport(CATALOG, CTX)
    const line = 'new since the previous catalog: 1 model(s) — qwen-3-coder'
    expect(renderFreeOptionsMarkdown(base)).toContain(line)
    expect(renderCommandOutput(base).join('\n')).toContain(line)
    const none = { ...base, newModelIds: [] }
    expect(renderFreeOptionsMarkdown(none)).not.toContain(
      'new since the previous catalog',
    )
    expect(renderCommandOutput(none).join('\n')).not.toContain(
      'new since the previous catalog',
    )
  })

  test('a delta longer than five ids is bounded with an ellipsis', () => {
    expect(catalogDeltaLine(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toContain(
      '7 model(s) — a, b, c, d, e, …',
    )
    expect(catalogDeltaLine([])).toBeNull()
  })
})
