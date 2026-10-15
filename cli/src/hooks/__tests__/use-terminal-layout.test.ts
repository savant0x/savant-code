// Use-terminal-layout test family — width layout and breakpoint boundaries.
// Sibling of the Loop-343 decomposition (height helpers, atLeast/atMost
// helpers, and edge cases live in use-terminal-layout-*.test.ts siblings).
import { describe, test, expect } from 'bun:test'

import {
  computeTerminalLayout,
  WIDTH_XS_BREAKPOINT,
  WIDTH_MD_BREAKPOINT,
  WIDTH_LG_BREAKPOINT,
} from '../use-terminal-layout'

describe('computeTerminalLayout', () => {
  const DEFAULT_HEIGHT = 24

  describe('width breakpoint constants', () => {
    test('breakpoints are in ascending order', () => {
      expect(WIDTH_XS_BREAKPOINT).toBeLessThan(WIDTH_MD_BREAKPOINT)
      expect(WIDTH_MD_BREAKPOINT).toBeLessThan(WIDTH_LG_BREAKPOINT)
    })
  })

  describe('xs width layout', () => {
    test('width 1 is xs', () => {
      const { width } = computeTerminalLayout(1, DEFAULT_HEIGHT)
      expect(width.size).toBe('xs')
      expect(width.is('xs')).toBe(true)
      expect(width.is('sm')).toBe(false)
      expect(width.is('md')).toBe(false)
      expect(width.is('lg')).toBe(false)
    })

    test('width 0 is xs (edge case)', () => {
      const { width } = computeTerminalLayout(0, DEFAULT_HEIGHT)
      expect(width.size).toBe('xs')
      expect(width.is('xs')).toBe(true)
    })

    test('negative width is xs (edge case)', () => {
      const { width } = computeTerminalLayout(-10, DEFAULT_HEIGHT)
      expect(width.size).toBe('xs')
      expect(width.is('xs')).toBe(true)
    })

    test('width just below xs breakpoint is xs', () => {
      const { width } = computeTerminalLayout(
        WIDTH_XS_BREAKPOINT - 1,
        DEFAULT_HEIGHT,
      )
      expect(width.size).toBe('xs')
      expect(width.is('xs')).toBe(true)
      expect(width.is('sm')).toBe(false)
    })
  })

  describe('sm width layout', () => {
    test('width at xs breakpoint is sm', () => {
      const { width } = computeTerminalLayout(
        WIDTH_XS_BREAKPOINT,
        DEFAULT_HEIGHT,
      )
      expect(width.size).toBe('sm')
      expect(width.is('xs')).toBe(false)
      expect(width.is('sm')).toBe(true)
      expect(width.is('md')).toBe(false)
      expect(width.is('lg')).toBe(false)
    })

    test('width at md breakpoint is sm', () => {
      const { width } = computeTerminalLayout(
        WIDTH_MD_BREAKPOINT,
        DEFAULT_HEIGHT,
      )
      expect(width.size).toBe('sm')
      expect(width.is('sm')).toBe(true)
      expect(width.is('md')).toBe(false)
    })
  })

  describe('md width layout', () => {
    test('width just above md breakpoint is md', () => {
      const { width } = computeTerminalLayout(
        WIDTH_MD_BREAKPOINT + 1,
        DEFAULT_HEIGHT,
      )
      expect(width.size).toBe('md')
      expect(width.is('xs')).toBe(false)
      expect(width.is('sm')).toBe(false)
      expect(width.is('md')).toBe(true)
      expect(width.is('lg')).toBe(false)
    })

    test('width at lg breakpoint is md', () => {
      const { width } = computeTerminalLayout(
        WIDTH_LG_BREAKPOINT,
        DEFAULT_HEIGHT,
      )
      expect(width.size).toBe('md')
      expect(width.is('md')).toBe(true)
      expect(width.is('lg')).toBe(false)
    })
  })

  describe('lg width layout', () => {
    test('width just above lg breakpoint is lg', () => {
      const { width } = computeTerminalLayout(
        WIDTH_LG_BREAKPOINT + 1,
        DEFAULT_HEIGHT,
      )
      expect(width.size).toBe('lg')
      expect(width.is('xs')).toBe(false)
      expect(width.is('sm')).toBe(false)
      expect(width.is('md')).toBe(false)
      expect(width.is('lg')).toBe(true)
    })

    test('very large width is lg', () => {
      const { width } = computeTerminalLayout(1000, DEFAULT_HEIGHT)
      expect(width.size).toBe('lg')
      expect(width.is('lg')).toBe(true)
    })
  })

  describe('width breakpoint boundaries (critical edge cases)', () => {
    test('width transitions from xs to sm at breakpoint', () => {
      const before = computeTerminalLayout(
        WIDTH_XS_BREAKPOINT - 1,
        DEFAULT_HEIGHT,
      )
      const after = computeTerminalLayout(WIDTH_XS_BREAKPOINT, DEFAULT_HEIGHT)
      expect(before.width.size).toBe('xs')
      expect(after.width.size).toBe('sm')
    })

    test('width transitions from sm to md at breakpoint', () => {
      const before = computeTerminalLayout(WIDTH_MD_BREAKPOINT, DEFAULT_HEIGHT)
      const after = computeTerminalLayout(
        WIDTH_MD_BREAKPOINT + 1,
        DEFAULT_HEIGHT,
      )
      expect(before.width.size).toBe('sm')
      expect(after.width.size).toBe('md')
    })

    test('width transitions from md to lg at breakpoint', () => {
      const before = computeTerminalLayout(WIDTH_LG_BREAKPOINT, DEFAULT_HEIGHT)
      const after = computeTerminalLayout(
        WIDTH_LG_BREAKPOINT + 1,
        DEFAULT_HEIGHT,
      )
      expect(before.width.size).toBe('md')
      expect(after.width.size).toBe('lg')
    })
  })
})
