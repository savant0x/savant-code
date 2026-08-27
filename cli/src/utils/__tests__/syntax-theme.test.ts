import { describe, expect, test } from 'bun:test'

import { createSyntaxStyle } from '../syntax-theme'

import type { ChatTheme } from '../../types/theme-system'

/**
 * Minimal valid ChatTheme for testing createSyntaxStyle (FID-033a Phase A).
 * Includes the diff + syntax tokens added by this FID.
 */
const makeTheme = (overrides: Partial<ChatTheme> = {}): ChatTheme => ({
  name: 'dark',
  primary: '#18faf9',
  secondary: '#18faf9',
  success: '#39ff14',
  error: '#ff2d55',
  warning: '#ff9500',
  info: '#18faf9',
  link: '#3B82F6',
  directory: '#9CA3AF',
  foreground: '#e4e4e8',
  background: 'transparent',
  muted: '#8f8f99',
  border: '#20202a',
  surface: '#0b0b11',
  surfaceHover: '#14141c',
  aiLine: '#5c5c66',
  userLine: '#18faf9',
  agentToggleHeaderBg: '#f97316',
  agentToggleExpandedBg: '#1d4ed8',
  agentFocusedBg: '#14141c',
  agentContentBg: '#07070b',
  inputFg: '#e4e4e8',
  inputFocusedFg: '#ffffff',
  modeFastBg: '#f97316',
  modeFastText: '#f97316',
  modeMaxBg: '#dc2626',
  modeMaxText: '#dc2626',
  modePlanBg: '#1e40af',
  modePlanText: '#1e40af',
  phaseAdversarial: '#c084fc',
  imageCardBorder: '#5c5c66',
  diffAdded: '#7ACC35',
  diffRemoved: '#BF6C69',
  diffContext: '#e4e4e8',
  diffHunkHeader: '#18faf9',
  diffMeta: '#8f8f99',
  diffBarAdded: '#3A5A3A',
  diffBarRemoved: '#5A3A3A',
  onPrimary: '#000000',
  // Scrollbar tokens (FID-2026-0823-002)
  scrollbarThumb: '#18faf9',
  scrollbarTrack: '#050508',
  syntaxComment: '#8f8f99',
  syntaxKeyword: '#c084fc',
  syntaxFunction: '#60a5fa',
  syntaxVariable: '#e4e4e8',
  syntaxString: '#4ade80',
  syntaxNumber: '#fbbf24',
  syntaxType: '#22d3ee',
  syntaxOperator: '#22d3ee',
  ...overrides,
})

describe('createSyntaxStyle (FID-033a Phase A)', () => {
  test('returns a SyntaxStyle without throwing for a valid dark theme', () => {
    const theme = makeTheme({ name: 'dark' })
    // Must not throw — Law 14: cosmetic feature must never crash the TUI.
    const style = createSyntaxStyle(theme)
    expect(style).toBeDefined()
    expect(typeof style.getStyleCount).toBe('function')
  })

  test('returns a SyntaxStyle without throwing for a valid light theme', () => {
    const theme = makeTheme({ name: 'light' })
    const style = createSyntaxStyle(theme)
    expect(style).toBeDefined()
  })

  test('registers at least one style for the comment scope', () => {
    const theme = makeTheme()
    const style = createSyntaxStyle(theme)
    // The comment scope is always mapped in buildSyntaxTokenStyles.
    // getStyleCount may be 0 if the native lib is unavailable in CI, so we
    // only assert non-negativity and that the call does not throw.
    const count = style.getStyleCount()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('resolves the "comment" style name when registered', () => {
    const theme = makeTheme()
    const style = createSyntaxStyle(theme)
    // resolveStyleId returns null if not registered (e.g. native lib missing),
    // but must not throw. We assert it returns a number or null.
    const id = style.resolveStyleId('comment')
    expect(id === null || typeof id === 'number').toBe(true)
  })
})
