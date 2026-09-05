// FID-2026-0819-005 Loop 279: split from terminal-color-detection.test.ts —
// this module keeps the parsing, brightness, and theme-derivation suites;
// the timeout and theme/OSC-format suites live in the sibling -timeouts and
// -themes files.
import { describe, test, expect } from 'bun:test'

import {
  parseOSCResponse,
  calculateBrightness,
  themeFromBgColor,
  themeFromFgColor,
} from '../terminal-color-detection'

// ============================================================================
// parseOSCResponse Tests
// ============================================================================

describe('parseOSCResponse', () => {
  test('parses 8-bit RGB response (2 hex digits)', () => {
    const response = '\x1b]11;rgb:ff/00/80\x07'
    const result = parseOSCResponse(response)
    expect(result).toEqual([255, 0, 128])
  })

  test('parses 16-bit RGB response (4 hex digits)', () => {
    const response = '\x1b]11;rgb:ffff/0000/8080\x07'
    const result = parseOSCResponse(response)
    // 16-bit values are normalized: ffff -> 255, 0000 -> 0, 8080 -> 128
    expect(result).toEqual([255, 0, 128])
  })

  test('parses response with ST terminator', () => {
    const response = '\x1b]11;rgb:00/ff/00\x1b\\'
    const result = parseOSCResponse(response)
    expect(result).toEqual([0, 255, 0])
  })

  test('parses black background', () => {
    const response = '\x1b]11;rgb:0000/0000/0000\x07'
    const result = parseOSCResponse(response)
    expect(result).toEqual([0, 0, 0])
  })

  test('parses white background', () => {
    const response = '\x1b]11;rgb:ffff/ffff/ffff\x07'
    const result = parseOSCResponse(response)
    expect(result).toEqual([255, 255, 255])
  })

  test('returns null for invalid response', () => {
    expect(parseOSCResponse('')).toBeNull()
    expect(parseOSCResponse('invalid')).toBeNull()
    expect(parseOSCResponse('rgb:')).toBeNull()
    expect(parseOSCResponse('rgb:ff/ff')).toBeNull() // Missing blue
  })

  test('parses response with extra content', () => {
    const response = 'prefix \x1b]11;rgb:12/34/56\x07 suffix'
    const result = parseOSCResponse(response)
    expect(result).toEqual([18, 52, 86])
  })

  test('handles case-insensitive hex values', () => {
    const response = '\x1b]11;rgb:Aa/Bb/Cc\x07'
    const result = parseOSCResponse(response)
    expect(result).toEqual([170, 187, 204])
  })
})

// ============================================================================
// calculateBrightness Tests
// ============================================================================

describe('calculateBrightness', () => {
  test('calculates brightness for black', () => {
    expect(calculateBrightness([0, 0, 0])).toBe(0)
  })

  test('calculates brightness for white', () => {
    // Due to floating point: 0.2126*255 + 0.7152*255 + 0.0722*255 = 254.9999... -> 254
    expect(calculateBrightness([255, 255, 255])).toBe(254)
  })

  test('calculates brightness for pure red', () => {
    // 0.2126 * 255 = 54.213
    expect(calculateBrightness([255, 0, 0])).toBe(54)
  })

  test('calculates brightness for pure green', () => {
    // 0.7152 * 255 = 182.376
    expect(calculateBrightness([0, 255, 0])).toBe(182)
  })

  test('calculates brightness for pure blue', () => {
    // 0.0722 * 255 = 18.411
    expect(calculateBrightness([0, 0, 255])).toBe(18)
  })

  test('calculates brightness for mid-gray', () => {
    const result = calculateBrightness([128, 128, 128])
    // Should be close to 128
    expect(result).toBeGreaterThan(125)
    expect(result).toBeLessThan(130)
  })

  test('green contributes most to brightness (ITU-R BT.709)', () => {
    const redBrightness = calculateBrightness([255, 0, 0])
    const greenBrightness = calculateBrightness([0, 255, 0])
    const blueBrightness = calculateBrightness([0, 0, 255])

    expect(greenBrightness).toBeGreaterThan(redBrightness)
    expect(greenBrightness).toBeGreaterThan(blueBrightness)
    expect(redBrightness).toBeGreaterThan(blueBrightness)
  })
})

// ============================================================================
// themeFromBgColor Tests
// ============================================================================

describe('themeFromBgColor', () => {
  test('returns dark for black background', () => {
    expect(themeFromBgColor([0, 0, 0])).toBe('dark')
  })

  test('returns light for white background', () => {
    expect(themeFromBgColor([255, 255, 255])).toBe('light')
  })

  test('returns dark for dark gray', () => {
    expect(themeFromBgColor([50, 50, 50])).toBe('dark')
  })

  test('returns light for light gray', () => {
    expect(themeFromBgColor([200, 200, 200])).toBe('light')
  })

  test('threshold is at 128', () => {
    // Just below threshold
    expect(themeFromBgColor([127, 127, 127])).toBe('dark')
    // Just above threshold
    expect(themeFromBgColor([130, 130, 130])).toBe('light')
  })

  test('handles common dark themes', () => {
    // VS Code Dark+
    expect(themeFromBgColor([30, 30, 30])).toBe('dark')
    // Dracula
    expect(themeFromBgColor([40, 42, 54])).toBe('dark')
    // One Dark
    expect(themeFromBgColor([40, 44, 52])).toBe('dark')
  })

  test('handles common light themes', () => {
    // VS Code Light+
    expect(themeFromBgColor([255, 255, 255])).toBe('light')
    // Solarized Light
    expect(themeFromBgColor([253, 246, 227])).toBe('light')
  })
})

// ============================================================================
// themeFromFgColor Tests
// ============================================================================

describe('themeFromFgColor', () => {
  test('returns dark for bright foreground (indicates dark background)', () => {
    expect(themeFromFgColor([255, 255, 255])).toBe('dark')
    expect(themeFromFgColor([200, 200, 200])).toBe('dark')
  })

  test('returns light for dark foreground (indicates light background)', () => {
    expect(themeFromFgColor([0, 0, 0])).toBe('light')
    expect(themeFromFgColor([50, 50, 50])).toBe('light')
  })

  test('inverts the logic from themeFromBgColor', () => {
    const colors: [number, number, number][] = [
      [0, 0, 0],
      [128, 128, 128],
      [255, 255, 255],
    ]

    for (const color of colors) {
      const bgResult = themeFromBgColor(color)
      const fgResult = themeFromFgColor(color)
      // Foreground and background should give opposite results
      // (bright fg = dark theme, dark fg = light theme)
      if (bgResult === 'dark') {
        expect(fgResult).toBe('light')
      } else {
        expect(fgResult).toBe('dark')
      }
    }
  })
})
