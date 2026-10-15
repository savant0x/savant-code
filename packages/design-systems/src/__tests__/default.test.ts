import { createHash } from 'node:crypto'

import { describe, expect, test } from 'bun:test'

import {
  DEFAULT_SOURCE,
  contrastRatio,
  getDefaultDesignSystemResource,
} from '../index'

describe('native Savant Cyberpunk design system', () => {
  test('uses the near-black cyan-led semantic palette without violet branding', () => {
    const resource = getDefaultDesignSystemResource()
    const colors = resource.tokens.colors

    expect(colors).toMatchObject({
      primary: '#18faf9',
      secondary: '#18faf9',
      background: '#050508',
      surface: '#0b0b11',
      surfaceHover: '#14141c',
      success: '#39ff14',
      warning: '#ff9500',
      error: '#ff2d55',
      muted: '#8f8f99',
      syntaxKeyword: '#ffb000',
      inlineCodeFg: '#22d3ee',
      listBulletFg: '#39ff14',
    })

    // No navy/slate in the neutral family (operator directive 2026-08-16:
    // the navy scale was pre-fork Freebuff branding; Savant is near-black +
    // cyan only).
    const neutralValues = [
      colors.surface,
      colors.surfaceHover,
      colors.border,
      colors.foreground,
      colors.muted,
    ]
    expect(neutralValues.join(' ')).not.toMatch(
      /#(?:0f172a|1e293b|94a3b8|64748b|e2e8f0)/i,
    )

    const nativeSemanticColors = [
      colors.secondary,
      colors.syntaxKeyword,
      colors.inlineCodeFg,
      colors.listBulletFg,
    ]
    expect(nativeSemanticColors.join(' ')).not.toMatch(
      /#(?:a78bfa|c084fc|7c3aed)/i,
    )

    const hash = (value: string) =>
      createHash('sha256').update(value, 'utf8').digest('hex')
    const normalizedPayload = JSON.stringify({
      schemaVersion: '1',
      id: 'savant-cyberpunk',
      displayName: 'Savant Cyberpunk',
      description: 'Savant native terminal-first design system.',
      tokens: resource.tokens,
      fonts: [],
      targets: ['terminal', 'react'],
      provenance: resource.provenance,
    })
    expect(resource.sourceContentHash).toBe(hash(DEFAULT_SOURCE))
    expect(resource.normalizedContentHash).toBe(hash(normalizedPayload))

    const requiredPairs = [
      ['#e4e4e8', '#050508'],
      ['#8f8f99', '#050508'],
      ['#18faf9', '#050508'],
      ['#39ff14', '#050508'],
      ['#ff9500', '#050508'],
      ['#ff2d55', '#050508'],
      ['#e4e4e8', '#0b0b11'],
      ['#ffb000', '#14141c'],
      ['#22d3ee', '#14141c'],
    ] as const
    for (const [foreground, background] of requiredPairs) {
      const ratio = contrastRatio(foreground, background)
      expect({ foreground, background, ratio }).toMatchObject({
        foreground,
        background,
      })
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    }
  })
})
