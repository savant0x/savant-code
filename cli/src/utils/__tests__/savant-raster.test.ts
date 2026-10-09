import { describe, expect, test } from 'bun:test'

import {
  SAVANT_ICONSET,
  SAVANT_ICON_PNG_DATA_URI,
  SAVANT_ICON_SVG,
} from '../../constants/savant-icons'
import {
  savantRasterDataUri,
  validateSavantIconName,
} from '../../hooks/use-savant-raster'
import { resetCachedProtocol } from '../../utils/terminal-images'

describe('savant iconset drift guard (FID-2026-1009-004)', () => {
  test('the generated set matches the manifest identity (132 icons, v3.0.0, 256px)', () => {
    expect(SAVANT_ICONSET.set).toBe('savant-cyberdeck')
    expect(SAVANT_ICONSET.version).toBe('3.0.0')
    expect(SAVANT_ICONSET.count).toBe(132)
    expect(SAVANT_ICONSET.rasterSize).toBe(256)
  })

  test('every SVG entry is a real inline SVG and every PNG entry a data URI', () => {
    const svgValues = Object.values(SAVANT_ICON_SVG)
    expect(svgValues.length).toBe(132)
    for (const svg of svgValues) {
      expect(svg.startsWith('<svg')).toBe(true)
    }
    const pngValues = Object.values(SAVANT_ICON_PNG_DATA_URI)
    expect(pngValues.length).toBe(132)
    for (const uri of pngValues) {
      expect(uri.startsWith('data:image/png;base64,')).toBe(true)
      expect(uri.length).toBeGreaterThan(100)
    }
  })
})

describe('validateSavantIconName (Law 14: never throws)', () => {
  test('accepts family constant keys and rejects PNG-member and unknown shapes', () => {
    expect(validateSavantIconName('ICON_Logo')).toBe('ICON_Logo')
    expect(validateSavantIconName('ICON_Logo_PNG')).toBeNull()
    expect(validateSavantIconName('logo')).toBeNull()
    expect(validateSavantIconName('')).toBeNull()
  })
})

describe('savantRasterDataUri protocol gating', () => {
  test('returns null when the terminal has no inline-image protocol (assertFalse gate)', () => {
    resetCachedProtocol()
    process.env.TERM_PROGRAM = 'unsupported-terminal'
    delete process.env.KITTY_WINDOW_ID
    delete process.env.SIXEL_SUPPORT
    process.env.TERM = 'xterm-256color'
    expect(savantRasterDataUri('ICON_Logo')).toBeNull()
  })

  test('returns a PNG data URI when iTerm2 protocol is present', () => {
    resetCachedProtocol()
    process.env.TERM_PROGRAM = 'iTerm.app'
    const uri = savantRasterDataUri('ICON_Logo')
    expect(uri).not.toBeNull()
    expect((uri ?? '').startsWith('data:image/png;base64,')).toBe(true)
  })
})
