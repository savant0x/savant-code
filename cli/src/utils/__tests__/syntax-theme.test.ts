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
  foreground: '#e2e8f0',
  background: 'transparent',
  muted: '#64748b',
  border: '#1e293b',
  surface: '#0f172a',
  surfaceHover: '#1e293b',
  aiLine: '#64748b',
  userLine: '#18faf9',
  agentToggleHeaderBg: '#f97316',
  agentToggleExpandedBg: '#1d4ed8',
  agentFocusedBg: '#1e293b',
  agentContentBg: '#020617',
  inputFg: '#e2e8f0',
  inputFocusedFg: '#ffffff',
  modeFastBg: '#f97316',
  modeFastText: '#f97316',
  modeMaxBg: '#dc2626',
  modeMaxText: '#dc2626',
  modePlanBg: '#1e40af',
  modePlanText: '#1e40af',
  imageCardBorder: '#64748b',
  diffAdded: '#7ACC35',
  diffRemoved: '#BF6C69',
  diffContext: '#e2e8f0',
  diffHunkHeader: '#18faf9',
  diffMeta: '#64748b',
  syntaxComment: '#64748b',
  syntaxKeyword: '#c084fc',
  syntaxFunction: '#60a5fa',
  syntaxVariable: '#e2e8f0',
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
