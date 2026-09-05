// Use-terminal-layout test family — width.is(), atLeast(), atMost(), and
// range combinations. Sibling of the Loop-343 decomposition (parent:
// use-terminal-layout.test.ts).
import { describe, test, expect } from 'bun:test'

import {
  computeTerminalLayout,
  WIDTH_XS_BREAKPOINT,
  WIDTH_MD_BREAKPOINT,
  WIDTH_LG_BREAKPOINT,
} from '../use-terminal-layout'

describe('computeTerminalLayout', () => {
  const DEFAULT_HEIGHT = 24

  describe('width.is() returns exactly one true', () => {
    test('only one size matches at a time', () => {
      const testWidths = [
        1,
        WIDTH_XS_BREAKPOINT - 1,
        WIDTH_XS_BREAKPOINT,
        WIDTH_MD_BREAKPOINT,
        WIDTH_MD_BREAKPOINT + 1,
        WIDTH_LG_BREAKPOINT,
        WIDTH_LG_BREAKPOINT + 1,
        1000,
      ]
      const sizes = ['xs', 'sm', 'md', 'lg'] as const

      for (const terminalWidth of testWidths) {
        const { width } = computeTerminalLayout(terminalWidth, DEFAULT_HEIGHT)
        const trueCount = sizes.filter((size) => width.is(size)).length
        expect(trueCount).toBe(1)
      }
    })

    test('size property matches the is() result', () => {
      const testCases = [
        { terminalWidth: 1, expectedSize: 'xs' },
        { terminalWidth: WIDTH_XS_BREAKPOINT, expectedSize: 'sm' },
        { terminalWidth: WIDTH_MD_BREAKPOINT + 1, expectedSize: 'md' },
        { terminalWidth: WIDTH_LG_BREAKPOINT + 1, expectedSize: 'lg' },
      ] as const

      for (const { terminalWidth, expectedSize } of testCases) {
        const { width } = computeTerminalLayout(terminalWidth, DEFAULT_HEIGHT)
        expect(width.size).toBe(expectedSize)
        expect(width.is(expectedSize)).toBe(true)
      }
    })
  })

  describe('width.atLeast() helper', () => {
    test('xs is atLeast xs only', () => {
      const { width } = computeTerminalLayout(1, DEFAULT_HEIGHT)
      expect(width.atLeast('xs')).toBe(true)
      expect(width.atLeast('sm')).toBe(false)
      expect(width.atLeast('md')).toBe(false)
      expect(width.atLeast('lg')).toBe(false)
    })

    test('sm is atLeast xs and sm', () => {
      const { width } = computeTerminalLayout(
        WIDTH_XS_BREAKPOINT,
        DEFAULT_HEIGHT,
      )
      expect(width.atLeast('xs')).toBe(true)
      expect(width.atLeast('sm')).toBe(true)
      expect(width.atLeast('md')).toBe(false)
      expect(width.atLeast('lg')).toBe(false)
    })

    test('md is atLeast xs, sm, and md', () => {
      const { width } = computeTerminalLayout(
        WIDTH_MD_BREAKPOINT + 1,
        DEFAULT_HEIGHT,
      )
      expect(width.atLeast('xs')).toBe(true)
      expect(width.atLeast('sm')).toBe(true)
      expect(width.atLeast('md')).toBe(true)
      expect(width.atLeast('lg')).toBe(false)
    })

    test('lg is atLeast everything', () => {
      const { width } = computeTerminalLayout(
        WIDTH_LG_BREAKPOINT + 1,
        DEFAULT_HEIGHT,
      )
      expect(width.atLeast('xs')).toBe(true)
      expect(width.atLeast('sm')).toBe(true)
      expect(width.atLeast('md')).toBe(true)
      expect(width.atLeast('lg')).toBe(true)
    })
  })

  describe('width.atMost() helper', () => {
    test('xs is atMost everything', () => {
      const { width } = computeTerminalLayout(1, DEFAULT_HEIGHT)
      expect(width.atMost('xs')).toBe(true)
      expect(width.atMost('sm')).toBe(true)
      expect(width.atMost('md')).toBe(true)
      expect(width.atMost('lg')).toBe(true)
    })

    test('sm is atMost sm, md, and lg', () => {
      const { width } = computeTerminalLayout(
        WIDTH_XS_BREAKPOINT,
        DEFAULT_HEIGHT,
      )
      expect(width.atMost('xs')).toBe(false)
      expect(width.atMost('sm')).toBe(true)
      expect(width.atMost('md')).toBe(true)
      expect(width.atMost('lg')).toBe(true)
    })

    test('md is atMost md and lg', () => {
      const { width } = computeTerminalLayout(
        WIDTH_MD_BREAKPOINT + 1,
        DEFAULT_HEIGHT,
      )
      expect(width.atMost('xs')).toBe(false)
      expect(width.atMost('sm')).toBe(false)
      expect(width.atMost('md')).toBe(true)
      expect(width.atMost('lg')).toBe(true)
    })

    test('lg is atMost lg only', () => {
      const { width } = computeTerminalLayout(
        WIDTH_LG_BREAKPOINT + 1,
        DEFAULT_HEIGHT,
      )
      expect(width.atMost('xs')).toBe(false)
      expect(width.atMost('sm')).toBe(false)
      expect(width.atMost('md')).toBe(false)
      expect(width.atMost('lg')).toBe(true)
    })
  })

  describe('combining atLeast and atMost for ranges', () => {
    test('xs is only xs', () => {
      const { width } = computeTerminalLayout(1, DEFAULT_HEIGHT)
      // In range [xs, sm]
      expect(width.atLeast('xs') && width.atMost('sm')).toBe(true)
      // In range [sm, md]
      expect(width.atLeast('sm') && width.atMost('md')).toBe(false)
    })

    test('sm is in [sm, md] but not [md, lg]', () => {
      const { width } = computeTerminalLayout(
        WIDTH_XS_BREAKPOINT,
        DEFAULT_HEIGHT,
      )
      expect(width.atLeast('sm') && width.atMost('md')).toBe(true)
      expect(width.atLeast('md') && width.atMost('lg')).toBe(false)
    })

    test('md is in [sm, lg]', () => {
      const { width } = computeTerminalLayout(
        WIDTH_MD_BREAKPOINT + 1,
        DEFAULT_HEIGHT,
      )
      expect(width.atLeast('sm') && width.atMost('lg')).toBe(true)
      expect(width.atLeast('xs') && width.atMost('sm')).toBe(false)
    })
  })
})
