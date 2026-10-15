import { afterEach, describe, expect, test } from 'bun:test'

import { _resetGlyphCacheForTests, activeGlyphTier, glyph } from '../glyphs'

const original = process.env.SAVANT_GLYPH_TIER
afterEach(() => {
  if (original === undefined) delete process.env.SAVANT_GLYPH_TIER
  else process.env.SAVANT_GLYPH_TIER = original
  _resetGlyphCacheForTests()
})

describe('explicit terminal glyph tiers', () => {
  for (const tier of ['ascii', 'unicode', 'nerdfont'] as const) {
    test(tier, () => {
      process.env.SAVANT_GLYPH_TIER = tier.toUpperCase()
      _resetGlyphCacheForTests()
      expect(activeGlyphTier()).toBe(tier)
      expect(glyph('treeExpanded')).toBe(
        tier === 'ascii' ? 'v' : tier === 'unicode' ? '▼' : '󰅀',
      )
      if (tier === 'ascii') {
        for (const name of [
          'treeCollapsed',
          'phaseActive',
          'alertWarning',
          'navBack',
        ] as const) {
          expect(glyph(name)).toMatch(/^[\x20-\x7e]+$/)
        }
      }
    })
  }
})
