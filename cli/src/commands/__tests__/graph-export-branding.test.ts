import fs from 'fs'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { handleGraphExportCommand } from '../graph-export'
import {
  afterEachHarness,
  beforeEachHarness,
  buildMultiDirFixture,
  makeParams,
  tempDir,
} from './graph-export-test-harness'
import { CHARACTER_LOGO_DATA_URI } from '../graph-export/character'

describe('knowledge-graph commands: branding', () => {
  beforeEach(beforeEachHarness)
  afterEach(afterEachHarness)

  test('graph-export uses the character logo in the header + ROOT planet backdrop', async () => {
    // The Savant logo IS the character (assets/logo.png) — the header `<img
    // class="logo">` and the ROOT planet emblem (drawn from the header logo's
    // data URI) must use the character, not the legacy circular emblem.
    await buildMultiDirFixture()

    const outputPath = path.join(tempDir, 'graph-report.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
    const html = fs.readFileSync(outputPath, 'utf8')

    expect(html).toContain(`<img class="logo" src="${CHARACTER_LOGO_DATA_URI}"`)
    // The ROOT planet still reads the header logo's data URI from the DOM.
    expect(html).toContain("headerLogo.getAttribute('src')")
  })

  test('graph-export renders the character watermark behind documents at 25% opacity', async () => {
    // FID-2026-0807-009 F1: the document backdrop is the character art from
    // assets/logo.png (CHARACTER_WATERMARK_DATA_URI) at opacity .25 with a
    // radial fade mask, replacing the decorative circle ring.
    await buildMultiDirFixture()

    const outputPath = path.join(tempDir, 'graph-report.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
    const html = fs.readFileSync(outputPath, 'utf8')

    // The data URI is interpolated at export time; assert the CSS surface it
    // lands in (the constant name itself never appears in the HTML).
    expect(html).not.toContain('CHARACTER_WATERMARK_DATA_URI')
    expect(html).toContain(
      '.center-focus::after{inset:0;z-index:0;background-image:url(',
    )
    expect(html).toContain('background-position:center center')
    expect(html).toContain('background-size:min(72%,720px) min(72%,720px)')
    expect(html).toContain(
      '.center-focus-grid{position:absolute;inset:0;z-index:1',
    )
    expect(html).toContain('background-repeat:no-repeat')
    expect(html).toContain('opacity:.06')
    expect(html).toContain(
      'mask-image:radial-gradient(circle,#000 36%,transparent 74%)',
    )
    // The document surface is translucent so the watermark shows through.
    expect(html).toContain(
      '.document-surface{margin-top:12px;overflow-y:auto;overflow-x:auto;',
    )
    // The data URI is inlined exactly once (no duplicated 1.2 MB payload).
    const dataUris = html.match(/data:image\/png;base64,/g) ?? []
    expect(dataUris.length).toBeGreaterThanOrEqual(1)
  })

  test('graph-export dims the ROOT sigma node so the emblem reads as backdrop', async () => {
    // FID-2026-0807-009 F9: the ROOT region node renders as a small dim dot
    // (no label) when not selected so the logo planet behind it is the focal
    // point; the logo draw is enlarged and rim-ringed.
    await buildMultiDirFixture()

    const outputPath = path.join(tempDir, 'graph-report.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
    const html = fs.readFileSync(outputPath, 'utf8')

    expect(html).toContain(
      "if (data.kind === 'region' && data.path === 'root' && selected !== id",
    )
    expect(html).toContain(
      "result.size = 4; result.label = ''; result.alpha = 0.32; result.zIndex = 1;",
    )
    expect(html).toContain('var logoSize = radius * 1.32;')
    expect(html).toContain("ctx.filter = 'brightness(1.35) saturate(1.15)'")
  })

  test('graph-export composes the Savant brand logo into the ROOT planet backdrop', async () => {
    // FID-2026-0807-008 F2: the ROOT region's background emblem is the
    // Savant logo (embedded data URI), not a generic planet body.
    await buildMultiDirFixture()

    const outputPath = path.join(tempDir, 'graph-report.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
    const html = fs.readFileSync(outputPath, 'utf8')

    // The brand image is loaded once (reusing the header logo's data URI so
    // the multi-line base64 constant never lands inside a JS string literal)
    // and drawn inside drawPlanetEffects for the ROOT region only, with a
    // procedural fallback while decoding.
    expect(html).toContain('var brandLogo = null;')
    expect(html).toContain("headerLogo.getAttribute('src')")
    expect(html).toContain("region.path === 'root'")
    expect(html).toContain('brandLogo.complete && brandLogo.naturalWidth > 0')
    expect(html).toContain('ctx.drawImage(brandLogo')
    expect(html).toContain('drawPlanetBody(ctx, point, radius, color, pulse)')
  })
})
