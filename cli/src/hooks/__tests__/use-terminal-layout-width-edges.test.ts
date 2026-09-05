// Use-terminal-layout test family — width edge cases, raw dimension
// passthrough, return structure, and call consistency. Sibling of the
// Loop-343 decomposition (parent: use-terminal-layout.test.ts).
import { describe, test, expect } from 'bun:test'

import {
  computeTerminalLayout,
  WIDTH_XS_BREAKPOINT,
  WIDTH_MD_BREAKPOINT,
  WIDTH_LG_BREAKPOINT,
} from '../use-terminal-layout'

describe('computeTerminalLayout', () => {
  const DEFAULT_HEIGHT = 24

  describe('raw dimensions passthrough', () => {
    test('terminalWidth is passed through unchanged', () => {
      const layout = computeTerminalLayout(100, 24)
      expect(layout.terminalWidth).toBe(100)
    })

    test('terminalHeight is passed through unchanged', () => {
      const layout = computeTerminalLayout(100, 50)
      expect(layout.terminalHeight).toBe(50)
    })

    test('height does not affect width size calculation', () => {
      const testWidth = WIDTH_XS_BREAKPOINT + 10
      const smallHeight = computeTerminalLayout(testWidth, 10)
      const largeHeight = computeTerminalLayout(testWidth, 100)

      expect(smallHeight.width.size).toBe(largeHeight.width.size)
    })

    test('various heights preserve correct width layout', () => {
      const heights = [1, 10, 24, 50, 100, 1000]
      const testWidth = WIDTH_XS_BREAKPOINT + 10

      for (const height of heights) {
        const layout = computeTerminalLayout(testWidth, height)
        expect(layout.width.size).toBe('sm')
        expect(layout.terminalHeight).toBe(height)
      }
    })
  })

  describe('floating point edge cases', () => {
    test('floating point width just below breakpoint is xs', () => {
      const { width } = computeTerminalLayout(
        WIDTH_XS_BREAKPOINT - 0.1,
        DEFAULT_HEIGHT,
      )
      expect(width.size).toBe('xs')
    })

    test('floating point width just above breakpoint is sm', () => {
      const { width } = computeTerminalLayout(
        WIDTH_XS_BREAKPOINT + 0.1,
        DEFAULT_HEIGHT,
      )
      expect(width.size).toBe('sm')
    })

    test('floating point exactly at breakpoint', () => {
      const { width } = computeTerminalLayout(
        WIDTH_XS_BREAKPOINT + 0.0,
        DEFAULT_HEIGHT,
      )
      expect(width.size).toBe('sm')
    })
  })

  describe('unusual input edge cases', () => {
    test('NaN width is treated as sm (NaN comparisons return false)', () => {
      const { width } = computeTerminalLayout(NaN, DEFAULT_HEIGHT)
      // NaN comparisons return false, so it falls through to 'sm'
      expect(width.is('sm')).toBe(true)
    })

    test('Infinity width is lg', () => {
      const { width } = computeTerminalLayout(Infinity, DEFAULT_HEIGHT)
      expect(width.size).toBe('lg')
      expect(width.is('lg')).toBe(true)
    })

    test('-Infinity width is xs', () => {
      const { width } = computeTerminalLayout(-Infinity, DEFAULT_HEIGHT)
      expect(width.size).toBe('xs')
      expect(width.is('xs')).toBe(true)
    })
  })

  describe('return value structure', () => {
    test('returns all expected properties', () => {
      const layout = computeTerminalLayout(100, 24)

      expect(layout).toHaveProperty('width')
      expect(layout).toHaveProperty('terminalWidth')
      expect(layout).toHaveProperty('terminalHeight')
      expect(layout.width).toHaveProperty('size')
      expect(layout.width).toHaveProperty('is')
      expect(layout.width).toHaveProperty('atLeast')
      expect(layout.width).toHaveProperty('atMost')
    })

    test('width.size is one of the valid TerminalWidthSize values', () => {
      const validSizes = ['xs', 'sm', 'md', 'lg']
      const widths = [
        1,
        WIDTH_XS_BREAKPOINT,
        WIDTH_MD_BREAKPOINT + 1,
        WIDTH_LG_BREAKPOINT + 1,
      ]

      for (const terminalWidth of widths) {
        const { width } = computeTerminalLayout(terminalWidth, DEFAULT_HEIGHT)
        expect(validSizes).toContain(width.size)
      }
    })

    test('helper methods return booleans', () => {
      const { width } = computeTerminalLayout(100, 24)

      expect(typeof width.is('xs')).toBe('boolean')
      expect(typeof width.atLeast('xs')).toBe('boolean')
      expect(typeof width.atMost('xs')).toBe('boolean')
    })

    test('dimension values are numbers', () => {
      const layout = computeTerminalLayout(100, 24)

      expect(typeof layout.terminalWidth).toBe('number')
      expect(typeof layout.terminalHeight).toBe('number')
    })
  })

  describe('consistency across multiple calls', () => {
    test('same input always produces same output', () => {
      const terminalWidth = 100
      const height = 24

      const layout1 = computeTerminalLayout(terminalWidth, height)
      const layout2 = computeTerminalLayout(terminalWidth, height)
      const layout3 = computeTerminalLayout(terminalWidth, height)

      expect(layout1.width.size).toBe(layout2.width.size)
      expect(layout2.width.size).toBe(layout3.width.size)
    })

    test('deterministic across all breakpoint boundaries', () => {
      const boundaries = [
        WIDTH_XS_BREAKPOINT - 1,
        WIDTH_XS_BREAKPOINT,
        WIDTH_MD_BREAKPOINT,
        WIDTH_MD_BREAKPOINT + 1,
        WIDTH_LG_BREAKPOINT,
        WIDTH_LG_BREAKPOINT + 1,
      ]

      for (const terminalWidth of boundaries) {
        const layout1 = computeTerminalLayout(terminalWidth, DEFAULT_HEIGHT)
        const layout2 = computeTerminalLayout(terminalWidth, DEFAULT_HEIGHT)
        expect(layout1.width.size).toBe(layout2.width.size)
      }
    })
  })
})
