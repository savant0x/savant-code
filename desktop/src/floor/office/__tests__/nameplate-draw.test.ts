// FID-2026-0901-006 P12 — AAA nameplate design contract. The pure draw module
// must produce a deterministic, accessible plate: uppercase title, muted
// subtitle, accent-driven title color that never lands accent-on-accent, and
// an active state that lightens the title for contrast without a raw luminance
// inversion. The drawing itself is GPU-free (bun tests have no canvas), so we
// pin the layout/typography/color decisions that drive the visual.

import { describe, expect, test } from 'bun:test'

import { blend, luminance, nameplateLayout } from '../nameplate-draw'

describe('nameplateLayout (FID-2026-0901-006 P12)', () => {
  test('title is uppercased; subtitle too', () => {
    const layout = nameplateLayout(
      'Thinker',
      'thinker · standby',
      '#22d3ee',
      false,
    )
    expect(layout.title).toBe('THINKER')
    expect(layout.subtitle).toBe('THINKER · STANDBY')
  })

  test('title font is bold and larger than the subtitle font', () => {
    const layout = nameplateLayout('Forge', 'forge', '#f59e0b', false)
    expect(layout.titleFont).toContain('700')
    expect(layout.subtitleFont).toContain('500')
    const size = (font: string): number =>
      Number.parseInt(font.match(/(\d+)px/)![1], 10)
    expect(size(layout.titleFont)).toBeGreaterThan(size(layout.subtitleFont))
  })

  test('active title lightens the accent (contrast, not accent-on-accent)', () => {
    const accent = '#22d3ee'
    const idle = nameplateLayout('S', 's', accent, false)
    const busy = nameplateLayout('S', 's', accent, true)
    // Active title is a lighter tint of the accent (higher luminance), so the
    // role name never sits as accent-on-accent against the glowing stroke.
    expect(luminance(busy.titleColor)).toBeGreaterThan(
      luminance(idle.titleColor),
    )
    // Both still derive from the same accent family (not a random hue).
    expect(busy.titleColor).toContain('#')
    expect(luminance(busy.titleColor)).toBeGreaterThan(luminance(accent))
  })

  test('blend darkens negative amounts and lightens positive amounts', () => {
    const accent = '#22d3ee'
    const light = blend(accent, 0.5)
    const dark = blend(accent, -0.5)
    expect(luminance(light)).toBeGreaterThan(luminance(accent))
    expect(luminance(dark)).toBeLessThan(luminance(accent))
  })

  test('the subtitle line never carries the accent (muted for readability)', () => {
    const layout = nameplateLayout(
      'Scribe',
      'scribe · working',
      '#a78bfa',
      true,
    )
    expect(layout.subtitleColor).toBe('rgba(228, 228, 232, 0.82)')
  })

  test('glass fill is a dark translucent panel (readable over any floor)', () => {
    const layout = nameplateLayout('S', 's', '#22d3ee', false)
    expect(layout.glassFill).toMatch(
      /^rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\.8\d*\s*\)$/,
    )
  })
})
