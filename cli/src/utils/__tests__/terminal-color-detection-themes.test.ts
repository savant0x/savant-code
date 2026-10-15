// FID-2026-0819-005 Loop 279: the theme edge-case and OSC response-format
// suites moved verbatim from terminal-color-detection.test.ts (renamed
// -parsing in this split).
import { describe, test, expect } from 'bun:test'

import { parseOSCResponse, themeFromBgColor } from '../terminal-color-detection'

describe('theme detection edge cases', () => {
  test('correctly identifies solarized dark', () => {
    // Solarized Dark background: #002b36
    const rgb: [number, number, number] = [0, 43, 54]
    expect(themeFromBgColor(rgb)).toBe('dark')
  })

  test('correctly identifies solarized light', () => {
    // Solarized Light background: #fdf6e3
    const rgb: [number, number, number] = [253, 246, 227]
    expect(themeFromBgColor(rgb)).toBe('light')
  })

  test('correctly identifies monokai background', () => {
    // Monokai background: #272822
    const rgb: [number, number, number] = [39, 40, 34]
    expect(themeFromBgColor(rgb)).toBe('dark')
  })

  test('correctly identifies nord background', () => {
    // Nord background: #2e3440
    const rgb: [number, number, number] = [46, 52, 64]
    expect(themeFromBgColor(rgb)).toBe('dark')
  })

  test('correctly identifies github light background', () => {
    // GitHub Light background: #ffffff
    const rgb: [number, number, number] = [255, 255, 255]
    expect(themeFromBgColor(rgb)).toBe('light')
  })

  test('correctly identifies gruvbox dark', () => {
    // Gruvbox Dark background: #282828
    const rgb: [number, number, number] = [40, 40, 40]
    expect(themeFromBgColor(rgb)).toBe('dark')
  })

  test('correctly identifies gruvbox light', () => {
    // Gruvbox Light background: #fbf1c7
    const rgb: [number, number, number] = [251, 241, 199]
    expect(themeFromBgColor(rgb)).toBe('light')
  })
})

// ============================================================================
// OSC Response Format Tests
// ============================================================================

describe('OSC response format variations', () => {
  test('handles response from iTerm2', () => {
    // iTerm2 typically sends 4-digit hex
    const response = '\x1b]11;rgb:1c1c/1c1c/1e1e\x07'
    const result = parseOSCResponse(response)
    expect(result).not.toBeNull()
    expect(themeFromBgColor(result!)).toBe('dark')
  })

  test('handles response from Terminal.app', () => {
    // Apple Terminal sends 4-digit hex
    const response = '\x1b]11;rgb:ffff/ffff/ffff\x1b\\'
    const result = parseOSCResponse(response)
    expect(result).toEqual([255, 255, 255])
  })

  test('handles response from kitty', () => {
    // kitty sends 2-digit hex
    const response = '\x1b]11;rgb:00/00/00\x07'
    const result = parseOSCResponse(response)
    expect(result).toEqual([0, 0, 0])
  })

  test('handles response with extra escape sequences', () => {
    // Some terminals add extra escape sequences
    const response = '\x1b[?1;2c\x1b]11;rgb:28/2c/34\x07'
    const result = parseOSCResponse(response)
    expect(result).toEqual([40, 44, 52])
    expect(themeFromBgColor(result!)).toBe('dark')
  })

  test('handles tmux passthrough response', () => {
    // tmux wraps the response
    const response = '\x1bPtmux;\x1b\x1b]11;rgb:1e/1e/2e\x1b\x1b\\\x1b\\'
    // The RGB pattern should still be found
    const result = parseOSCResponse(response)
    expect(result).toEqual([30, 30, 46])
  })
})
