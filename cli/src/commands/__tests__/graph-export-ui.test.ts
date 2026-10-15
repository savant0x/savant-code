import fs from 'fs'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { handleGraphExportCommand } from '../graph-export'
import {
  afterEachHarness,
  beforeEachHarness,
  buildMultiDirFixture,
  decodeDocsPayload,
  makeParams,
  tempDir,
} from './graph-export-test-harness'

describe('knowledge-graph commands: UI contracts', () => {
  beforeEach(beforeEachHarness)
  afterEach(afterEachHarness)

  test('graph-export document toolbar has copy + back, and OS-style window controls', async () => {
    // FID-2026-0807-012: the document header keeps its COPY/back toolbar, and
    // both panels get a 3-button window-control cluster (min/max/close) flush
    // to the top-right corner, with taskbar-style minimize + near-fullscreen
    // maximize states.
    await buildMultiDirFixture()

    const outputPath = path.join(tempDir, 'graph-report.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
    const html = fs.readFileSync(outputPath, 'utf8')

    expect(html).toContain('function copyDocumentContent(file, doc)')
    expect(html).toContain("copy.textContent = '⧉ COPY CONTENT'")
    expect(html).toContain('document-toolbar')
    expect(html).toContain('browser-back')
    // Window-control cluster markup + handlers on both panels.
    expect(html).toContain('class="window-controls" role="group"')
    expect(html).toContain('class="window-btn window-btn-min"')
    expect(html).toContain('class="window-btn window-btn-max"')
    expect(html).toContain('class="window-btn window-btn-close"')
    expect(html).toContain('onclick="windowMinimize(this)"')
    expect(html).toContain('onclick="windowMaximize(this)"')
    expect(html).toContain('onclick="windowClose(this)"')
    expect(html).toContain('function windowMinimize(btn)')
    expect(html).toContain('function windowMaximize(btn)')
    expect(html).toContain('function windowClose(btn)')
    expect(html).toContain('function windowRestore(btn)')
    expect(html).toContain('function updateWindowTitle(panel)')
    // Flush corner chrome (not floating), taskbar minimize + maximize CSS.
    expect(html).toContain('.window-controls{position:absolute;top:0;right:0')
    expect(html).toContain('.window-btn-close:hover')
    expect(html).toContain('.center-focus.window-minimized')
    expect(html).toContain('.graph-sidebar.window-minimized')
    expect(html).toContain('.center-focus.window-maximized')
    expect(html).toContain('.window-title-bar')
    // Old single close chips are gone.
    expect(html).not.toContain('center-focus-close')
    expect(html).not.toContain('sidebar-close')
    // The old in-flow rule (which dropped the × into the top-left corner) is
    // gone; controls + title bar are excluded from the positioning rule.
    expect(html).not.toContain(
      '.center-focus>*:not(.center-focus-grid){position:relative}',
    )
    expect(html).toContain(
      '.center-focus>*:not(.center-focus-grid):not(.window-controls):not(.window-title-bar):not(.center-focus-actions){position:relative}',
    )
    expect(html).toContain(
      '.document-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding-right:96px}',
    )
    // Reachability: the handlers are exported on window for the inline onclick.
    expect(html).toContain('window.windowMinimize = windowMinimize')
    expect(html).toContain('window.windowRestore = windowRestore')
  })

  test('graph-export styles unavailable/oversized documents with a designed card', async () => {
    // FID-2026-0807-009 F6: oversized documents render a glyph + title + hint
    // card instead of a bare pink text line.
    await buildMultiDirFixture()

    const outputPath = path.join(tempDir, 'graph-report.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
    const html = fs.readFileSync(outputPath, 'utf8')

    expect(html).toContain(
      "strong.textContent = reason === 'binary' ? 'BINARY CONTENT NOT EXPORTED' : reason === 'disabled' ? 'DOCUMENT NOT EXPORTED' : 'DOCUMENT UNAVAILABLE'",
    )
    expect(html).toContain('document-unavailable-glyph')
    expect(html).toContain('.document-unavailable strong{font-size:12px')
    // Explicit caps are rendered as text documents; unavailable cards do not
    // advertise retired aggregate/head-preview rerun knobs.
    expect(html).not.toContain('HEAD PREVIEW')
    expect(html).not.toContain('FILE TOO LARGE FOR EXPORT')
    expect(html).not.toContain('SAVANT_GRAPH_EXPORT_HEAD_TOTAL_BYTES=8388608')
    expect(html).toContain('function formatBytes(n)')
    expect(html).toContain(
      "size.textContent = 'Source file: ' + formatBytes(doc.byteCount)",
    )
    expect(html).toContain('document-size-note')
  })

  test('graph-export honors SAVANT_GRAPH_EXPORT_DOCUMENT_LINES env cap', async () => {
    // FID-2026-0807-011 A3: the env knobs wire into the serializer — the
    // fixture's two-line files (src/b.ts, lib/d.ts) must truncate to one
    // embedded line when the cap is 1.
    await buildMultiDirFixture()

    process.env.SAVANT_GRAPH_EXPORT_DOCUMENT_LINES = '1'
    try {
      const cappedPath = path.join(tempDir, 'graph-report-capped.html')
      await handleGraphExportCommand(makeParams('/graph-export'), cappedPath)
      const capped = fs.readFileSync(cappedPath, 'utf8')
      const cappedDocs = decodeDocsPayload(capped)
      const cappedLineCounts = Object.values(cappedDocs)
        .filter(
          (doc): doc is { kind: string; lineCount: number } =>
            typeof doc === 'object' &&
            doc !== null &&
            (doc as { kind?: string }).kind === 'text',
        )
        .map((doc) => doc.lineCount)
      expect(cappedLineCounts).not.toContain(2)
      expect(cappedLineCounts).toContain(1)
    } finally {
      delete process.env.SAVANT_GRAPH_EXPORT_DOCUMENT_LINES
    }

    const defaultPath = path.join(tempDir, 'graph-report-default.html')
    await handleGraphExportCommand(makeParams('/graph-export'), defaultPath)
    const def = fs.readFileSync(defaultPath, 'utf8')
    // Baseline: without the cap the two-line files embed both lines.
    const defDocs = decodeDocsPayload(def)
    expect(
      Object.values(defDocs)
        .filter(
          (doc): doc is { kind: string; lineCount: number } =>
            typeof doc === 'object' &&
            doc !== null &&
            (doc as { kind?: string }).kind === 'text',
        )
        .map((doc) => doc.lineCount),
    ).toContain(2)
  })

  test('graph-export aligns search results under the input and styles shared scrollbars', async () => {
    // FID-2026-0807-009 F4/F7: the dropdown anchors to the form's left edge
    // (the search input) instead of the header's right edge, and the content
    // areas share the sidebar's themed scrollbar.
    await buildMultiDirFixture()

    const outputPath = path.join(tempDir, 'graph-report.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
    const html = fs.readFileSync(outputPath, 'utf8')

    expect(html).toContain(
      '.universe-search{display:flex;gap:4px;margin-left:auto;position:relative}',
    )
    expect(html).toContain(
      '.search-results{position:absolute;left:0;right:auto;top:calc(100% + 6px)',
    )
    expect(html).toContain('.center-browser::-webkit-scrollbar')
    expect(html).toContain('.document-surface::-webkit-scrollbar')
    expect(html).toContain('.browser-grid::-webkit-scrollbar')
  })

  test('graph-export ships explicit-cap messaging and draggable title bars', async () => {
    // FID-2026-0807-015 F1 (UI): preview docs render a banner + head lines;
    // F2 (UI): the title bar is always-visible chrome with pointer-drag
    // handlers and a grab cursor.
    await buildMultiDirFixture()

    const outputPath = path.join(tempDir, 'graph-report.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
    const html = fs.readFileSync(outputPath, 'utf8')

    // Explicit caps have a deliberate message; retired preview/head-pool copy is gone.
    expect(html).toContain('document-preview-banner')
    expect(html).toContain('TEXT CAPPED BY EXPLICIT EXPORT LIMIT')
    expect(html).not.toContain('HEAD PREVIEW')
    expect(html).not.toContain('FILE TOO LARGE FOR EXPORT')
    expect(html).not.toContain('SAVANT_GRAPH_EXPORT_HEAD_BYTES')
    expect(html).not.toContain('SAVANT_GRAPH_EXPORT_HEAD_TOTAL_BYTES')

    // F2 drag handlers + exports + title-bar chrome.
    expect(html).toContain('onpointerdown="windowDragStart(this, event)"')
    expect(html).toContain('function windowDragStart(bar, event)')
    expect(html).toContain('function windowDragMove(event)')
    expect(html).toContain('function windowDragEnd(event)')
    expect(html).toContain('function windowTitleBarClick(bar)')
    expect(html).toContain('window.windowDragStart = windowDragStart')
    expect(html).toContain(
      '.window-title-bar{position:absolute;left:0;right:96px;top:0;bottom:auto;height:24px',
    )
    expect(html).toContain('.window-dragging{')
  })
})
