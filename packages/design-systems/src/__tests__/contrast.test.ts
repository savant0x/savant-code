import { describe, expect, test } from 'bun:test'

import { contrastRatio } from '../index'

// Contrast-ratio reference pairs fed to `contrastRatio`. Every value is a
// CURRENT savant-cyberpunk token (see `src/default.ts` and
// `cli/src/utils/theme-system/palette.ts`); the pre-brand-purge slate
// neutrals were replaced here so the suite asserts the current brand's
// contrast, not a legacy palette (A–Z v0.0.25 AV-002). This test asserts
// WCAG AA ratios for the current near-black + cyan brand; it does not itself
// define brand colors.
const REQUIRED_PAIRS = [
  ['foreground/background', '#e4e4e8', '#050508'],
  ['muted/background', '#8f8f99', '#050508'],
  ['primary/background', '#18faf9', '#050508'],
  ['success/background', '#39ff14', '#050508'],
  ['warning/background', '#ff9500', '#050508'],
  ['error/background', '#ff2d55', '#050508'],
  ['foreground/surface', '#e4e4e8', '#0b0b11'],
  ['muted/surface', '#8f8f99', '#0b0b11'],
  ['keyword/code-background', '#ffb000', '#111118'],
  ['inline-code/code-background', '#22d3ee', '#111118'],
  ['function/code-background', '#60a5fa', '#111118'],
  ['string/code-background', '#4ade80', '#111118'],
  ['number/code-background', '#fbbf24', '#111118'],
  ['diff-added/background', '#7ACC35', '#050508'],
  ['diff-removed/background', '#BF6C69', '#050508'],
] as const

describe('native dark contrast acceptance artifact', () => {
  test('all required normal/status pairs meet WCAG AA', () => {
    const measurements = REQUIRED_PAIRS.map(
      ([name, foreground, background]) => {
        const ratio = contrastRatio(foreground, background)
        return { name, foreground, background, ratio: Number(ratio.toFixed(2)) }
      },
    )

    // The structured value records the exact pair and measured ratio in a
    // failing Bun assertion, making the audit artifact actionable.
    expect(measurements.every(({ ratio }) => ratio >= 4.5)).toBe(true)
  })
})
