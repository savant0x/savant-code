// P19 — shared model display-label formatter (provider trim + tier strip).
// Mirrors the CLI presence sanitizeModel rules minus Discord-separator
// neutralization; the desktop header badge and the deck ModelTag both render
// through this helper (Law 13: one formatter, one truth).
import { describe, expect, test } from 'bun:test'

import { formatModelLabel } from '../model-label'

describe('formatModelLabel (P19)', () => {
  test('trims the provider prefix, keeping only the model', () => {
    expect(formatModelLabel('nous/meituan/longcat-2.0')).toBe('longcat-2.0')
    expect(formatModelLabel('openrouter/deepseek-v4-pro')).toBe(
      'deepseek-v4-pro',
    )
    expect(formatModelLabel('minimax/minimax-m3')).toBe('minimax-m3')
  })

  test('strips tier suffixes wherever they appear', () => {
    expect(formatModelLabel('nous/meituan/longcat-2.0:free')).toBe(
      'longcat-2.0',
    )
    expect(formatModelLabel('openrouter/deepseek-v4-pro:free')).toBe(
      'deepseek-v4-pro',
    )
    expect(formatModelLabel('foo/bar:free:online')).toBe('bar')
    expect(formatModelLabel('foo:freeze')).toBe('foo:freeze')
  })

  test('names the odd-ball router instead of showing the raw id', () => {
    expect(formatModelLabel('openrouter/free')).toBe('OpenRouter Free')
  })

  test('passes through plain model ids unchanged', () => {
    expect(formatModelLabel('claude-3-5-sonnet')).toBe('claude-3-5-sonnet')
    expect(formatModelLabel('longcat-2.0')).toBe('longcat-2.0')
  })
})
