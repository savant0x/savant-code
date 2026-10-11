import { describe, expect, test } from 'bun:test'

import {
  SAVANT_EXPORT_ICON_MAP,
  SAVANT_ICONSET,
  SAVANT_ICON_PNG_DATA_URI,
  SAVANT_ICON_SVG,
  savantExportIconSvg,
} from '../../constants/savant-icons'

/**
 * FID-2026-1009-004 Phase 1 drift guard: the export-report slot mapping must
 * stay 1:1 with the generated family. A codegen rename or a manifest change
 * fails here before any exported report can render broken markup.
 */
describe('savant-icons export mapping drift guard (FID-2026-1009-004 Phase 1)', () => {
  test('family identity holds (132 icons, manifest v3.0.0, 256px rasters)', () => {
    expect(SAVANT_ICONSET.set).toBe('savant-cyberdeck')
    expect(SAVANT_ICONSET.version).toBe('3.0.0')
    expect(SAVANT_ICONSET.count).toBe(132)
    expect(SAVANT_ICONSET.rasterSize).toBe(256)
    expect(Object.keys(SAVANT_ICON_SVG).length).toBe(132)
    expect(Object.keys(SAVANT_ICON_PNG_DATA_URI).length).toBe(132)
  })

  test('every export slot resolves to a real family icon', () => {
    const familyKeys = new Set(Object.keys(SAVANT_ICON_SVG))
    const slots = Object.entries(SAVANT_EXPORT_ICON_MAP)
    // The FID census: 18 semantic slots cover the 21 call sites (several
    // slots serve multiple sites — fa-terminal x2, fa-copy x2, fa-check /
    // fa-triangle-exclamation share slot families).
    expect(slots.length).toBe(18)
    for (const [slot, iconName] of slots) {
      expect(familyKeys.has(iconName)).toBe(true)
      // Mapped icon is a real inline SVG (not an empty/missing constant).
      expect(SAVANT_ICON_SVG[iconName].startsWith('<svg')).toBe(true)
      // Slot name sanity: camelCase, no FA class vocabulary left
      // ('copyFailure' contains 'fa' as a substring — the FA pattern is the
      // `fa-` class prefix, which is what must be gone).
      expect(slot).toMatch(/^[a-z][A-Za-z]+$/)
      expect(slot).not.toMatch(/(^|[^a-z])fa[-_]/)
    }
  })

  test('the swap helper renders valid inline SVG and never throws (Law 14)', () => {
    for (const slot of Object.keys(SAVANT_EXPORT_ICON_MAP) as Array<
      keyof typeof SAVANT_EXPORT_ICON_MAP
    >) {
      const svg = savantExportIconSvg(slot)
      expect(svg.startsWith('<svg')).toBe(true)
      expect(svg).toContain('viewBox="0 0 64 64"')
    }
  })

  test('copy-state slots carry the honest fallback mapping', () => {
    // fa-copy had no clipboard mark in the family — mapped to the document
    // mark (dev-object-mark), per the Q1 "honest mapping" rule.
    expect(SAVANT_EXPORT_ICON_MAP.copyButton).toBe('ICON_ObjFile')
    expect(SAVANT_EXPORT_ICON_MAP.copySuccess).toBe('ICON_AlertSuccess')
    expect(SAVANT_EXPORT_ICON_MAP.copyFailure).toBe('ICON_AlertError')
  })
})
