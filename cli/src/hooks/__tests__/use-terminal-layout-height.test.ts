// Use-terminal-layout test family — height layout helpers. Sibling of the
// Loop-343 decomposition (parent: use-terminal-layout.test.ts).
import { describe, test, expect } from 'bun:test'

import {
  computeTerminalLayout,
  HEIGHT_XS_BREAKPOINT,
  HEIGHT_MD_BREAKPOINT,
  WIDTH_XS_BREAKPOINT,
  WIDTH_LG_BREAKPOINT,
} from '../use-terminal-layout'

describe('height layout helpers', () => {
  const DEFAULT_WIDTH = 100

  describe('height breakpoint constants', () => {
    test('HEIGHT_XS_BREAKPOINT is 20', () => {
      expect(HEIGHT_XS_BREAKPOINT).toBe(20)
    })

    test('HEIGHT_MD_BREAKPOINT is 40', () => {
      expect(HEIGHT_MD_BREAKPOINT).toBe(40)
    })

    test('breakpoints are in ascending order', () => {
      expect(HEIGHT_XS_BREAKPOINT).toBeLessThan(HEIGHT_MD_BREAKPOINT)
    })
  })

  describe('xs height layout (< 20 rows)', () => {
    test('height 1 is xs', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, 1)
      expect(height.size).toBe('xs')
      expect(height.is('xs')).toBe(true)
      expect(height.is('sm')).toBe(false)
      expect(height.is('md')).toBe(false)
    })

    test('height 10 is xs', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, 10)
      expect(height.size).toBe('xs')
      expect(height.is('xs')).toBe(true)
    })

    test('height 19 is xs (just below breakpoint)', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, 19)
      expect(height.size).toBe('xs')
      expect(height.is('xs')).toBe(true)
      expect(height.is('sm')).toBe(false)
    })

    test('height 0 is xs (edge case)', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, 0)
      expect(height.size).toBe('xs')
      expect(height.is('xs')).toBe(true)
    })

    test('negative height is xs (edge case)', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, -10)
      expect(height.size).toBe('xs')
      expect(height.is('xs')).toBe(true)
    })
  })

  describe('sm height layout (20-40 rows)', () => {
    test('height 20 is sm (exactly at xs breakpoint)', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, 20)
      expect(height.size).toBe('sm')
      expect(height.is('xs')).toBe(false)
      expect(height.is('sm')).toBe(true)
      expect(height.is('md')).toBe(false)
    })

    test('height 30 is sm', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, 30)
      expect(height.size).toBe('sm')
      expect(height.is('sm')).toBe(true)
    })

    test('height 40 is sm (exactly at md breakpoint)', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, 40)
      expect(height.size).toBe('sm')
      expect(height.is('sm')).toBe(true)
      expect(height.is('md')).toBe(false)
    })
  })

  describe('md height layout (> 40 rows)', () => {
    test('height 41 is md (just above sm)', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, 41)
      expect(height.size).toBe('md')
      expect(height.is('xs')).toBe(false)
      expect(height.is('sm')).toBe(false)
      expect(height.is('md')).toBe(true)
    })

    test('height 60 is md', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, 60)
      expect(height.size).toBe('md')
      expect(height.is('md')).toBe(true)
    })

    test('very large height (100) is md', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, 100)
      expect(height.size).toBe('md')
      expect(height.is('md')).toBe(true)
    })
  })

  describe('height breakpoint boundaries', () => {
    test('height 19 -> 20 transitions from xs to sm', () => {
      const before = computeTerminalLayout(DEFAULT_WIDTH, 19)
      const after = computeTerminalLayout(DEFAULT_WIDTH, 20)
      expect(before.height.size).toBe('xs')
      expect(after.height.size).toBe('sm')
    })

    test('height 40 -> 41 transitions from sm to md', () => {
      const before = computeTerminalLayout(DEFAULT_WIDTH, 40)
      const after = computeTerminalLayout(DEFAULT_WIDTH, 41)
      expect(before.height.size).toBe('sm')
      expect(after.height.size).toBe('md')
    })
  })

  describe('height.is() returns exactly one true', () => {
    test('only one size matches at a time', () => {
      const testHeights = [1, 10, 19, 20, 30, 40, 41, 60, 100]
      const sizes = ['xs', 'sm', 'md'] as const

      for (const terminalHeight of testHeights) {
        const { height } = computeTerminalLayout(DEFAULT_WIDTH, terminalHeight)
        const trueCount = sizes.filter((size) => height.is(size)).length
        expect(trueCount).toBe(1)
      }
    })
  })

  describe('height.atLeast() helper', () => {
    test('xs is atLeast xs only', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, 10)
      expect(height.atLeast('xs')).toBe(true)
      expect(height.atLeast('sm')).toBe(false)
      expect(height.atLeast('md')).toBe(false)
    })

    test('sm is atLeast xs and sm', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, 30)
      expect(height.atLeast('xs')).toBe(true)
      expect(height.atLeast('sm')).toBe(true)
      expect(height.atLeast('md')).toBe(false)
    })

    test('md is atLeast everything', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, 60)
      expect(height.atLeast('xs')).toBe(true)
      expect(height.atLeast('sm')).toBe(true)
      expect(height.atLeast('md')).toBe(true)
    })
  })

  describe('height.atMost() helper', () => {
    test('xs is atMost everything', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, 10)
      expect(height.atMost('xs')).toBe(true)
      expect(height.atMost('sm')).toBe(true)
      expect(height.atMost('md')).toBe(true)
    })

    test('sm is atMost sm and md', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, 30)
      expect(height.atMost('xs')).toBe(false)
      expect(height.atMost('sm')).toBe(true)
      expect(height.atMost('md')).toBe(true)
    })

    test('md is atMost md only', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, 60)
      expect(height.atMost('xs')).toBe(false)
      expect(height.atMost('sm')).toBe(false)
      expect(height.atMost('md')).toBe(true)
    })
  })

  describe('width and height are independent', () => {
    test('xs width with md height', () => {
      const layout = computeTerminalLayout(1, HEIGHT_MD_BREAKPOINT + 1)
      expect(layout.width.size).toBe('xs')
      expect(layout.height.size).toBe('md')
    })

    test('lg width with xs height', () => {
      const layout = computeTerminalLayout(WIDTH_LG_BREAKPOINT + 1, 1)
      expect(layout.width.size).toBe('lg')
      expect(layout.height.size).toBe('xs')
    })

    test('sm width with sm height (common case)', () => {
      const layout = computeTerminalLayout(
        WIDTH_XS_BREAKPOINT,
        HEIGHT_XS_BREAKPOINT + 1,
      )
      expect(layout.width.size).toBe('sm')
      expect(layout.height.size).toBe('sm')
    })
  })

  describe('real-world terminal heights', () => {
    test('very short terminal (10 rows) is xs', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, 10)
      expect(height.size).toBe('xs')
    })

    test('standard 24-row terminal is sm', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, 24)
      expect(height.size).toBe('sm')
    })

    test('macOS default ~50 rows is md', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, 50)
      expect(height.size).toBe('md')
    })

    test('fullscreen 1080p ~45 rows is md', () => {
      const { height } = computeTerminalLayout(DEFAULT_WIDTH, 45)
      expect(height.size).toBe('md')
    })
  })
})
