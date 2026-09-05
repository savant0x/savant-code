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

describe('knowledge-graph commands: QC polish contracts', () => {
  beforeEach(beforeEachHarness)
  afterEach(afterEachHarness)

  test('graph-export ships the FID-2026-0807-014 QC polish contracts', async () => {
    // FID-2026-0807-014: staged Escape (first press only dismisses the top
    // panel, keeping the document), per-window close (sidebar × keeps the
    // center doc), docked taskbar stacking, fitUniverse sound, tree keyboard
    // nav, collapse/expand all, font-size + wrap toggles, breadcrumbs, and
    // the '/' + Ctrl/Cmd+K search shortcut.
    await buildMultiDirFixture()

    const outputPath = path.join(tempDir, 'graph-report.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
    const html = fs.readFileSync(outputPath, 'utf8')

    // F1 staged Escape — escDismiss restores taskbars, then closes panels
    // one at a time, and only falls through to resetUniverse when nothing is
    // open.
    expect(html).toContain('function escDismiss()')
    expect(html).toContain("sidebar.classList.add('hidden')")
    expect(html).toContain('function syncDockedTaskbars()')

    // F2 per-window close — the × resolves its own panel and closes only it.
    expect(html).toContain("panel.classList.contains('graph-sidebar')")
    expect(html).toContain("panel.classList.add('hidden')")
    expect(html).toContain('clearFocusView()')

    // F3 docked taskbar stacking — the sidebar (DOM order index 1, the only
    // panel that can hold docked-sibling) rises above the center bar so the
    // two taskbars never overlap.
    expect(html).toContain('.graph-sidebar.window-minimized.docked-sibling')
    expect(html).toContain(
      "panel.classList.toggle('docked-sibling', index > 0)",
    )

    // F4 fitUniverse sound — the button path plays (silent=false); only init
    // uses silent.
    expect(html).toContain('function fitUniverse() {')
    expect(html).toContain('fitUniverseInternal(false)')
    expect(html).toContain('fitUniverseInternal(true)')

    // F5 tree keyboard navigation — region-list is focusable and rows track
    // a visible focus class + aria-activedescendant.
    expect(html).toContain('id="region-list" tabindex="0"')
    expect(html).toContain('function regionNavRows()')
    expect(html).toContain('function navKeyFocusRow(row)')
    expect(html).toContain("list.setAttribute('aria-activedescendant'")
    expect(html).toContain('region-row.nav-key-focus')
    expect(html).toContain('region-tree-folder.nav-key-focus')

    // F6 collapse-all / expand-all buttons + handlers.
    expect(html).toContain('onclick="collapseAllRegions()"')
    expect(html).toContain('onclick="expandAllRegions()"')
    expect(html).toContain('function expandAllRegions()')
    expect(html).toContain('function collapseAllRegions()')
    expect(html).toContain('window.collapseAllRegions = collapseAllRegions')
    expect(html).toContain('window.expandAllRegions = expandAllRegions')

    // F7 word-wrap toggle retained; F8 font-size buttons removed
    // (FID-2026-0807-021) — no A−/A+ chrome, no font-scale classes.
    expect(html).toContain('function toggleDocWrap(btn)')
    expect(html).toContain("wrap.className = 'document-wrap-btn'")
    expect(html).not.toContain("wrap.className = 'document-font-btn'")
    expect(html).toContain(
      "wrap.textContent = docWrapOff ? '⤼ NO WRAP' : '⤺ WRAP'",
    )
    expect(html).toContain(
      '.document-surface.wrap-off .document-line code{white-space:pre',
    )
    expect(html).not.toContain('cycleDocFontScale')
    expect(html).not.toContain("fontSmall.textContent = 'A−'")
    expect(html).not.toContain("fontLarge.textContent = 'A+'")
    expect(html).not.toContain('font-scale-s')

    // FID-2026-0807-021: word wrap survives long unbreakable lines (grid
    // min-content blowout fix), copy button pinned in the corner action slot
    // under the window controls, and the line/byte meta sits in the header
    // next to the file name as a bracketed badge.
    expect(html).toContain(
      '.document-line{display:grid;grid-template-columns:54px minmax(0,1fr)',
    )
    expect(html).toContain(
      'white-space:pre-wrap;overflow-wrap:anywhere;min-width:0',
    )
    expect(html).toContain(
      'id="center-focus-actions" class="center-focus-actions"',
    )
    expect(html).toContain(
      '.center-focus-actions{position:absolute;top:30px;right:0',
    )
    expect(html).toContain(
      "var actionsSlot = document.getElementById('center-focus-actions')",
    )
    expect(html).toContain(
      'copy.onclick = function () { copyDocumentContent(file, doc) }',
    )
    expect(html).toContain("metaBadge.className = 'document-file-meta'")
    expect(html).toContain(
      "metaBadge.textContent = '[' + doc.lineCount + ' lines'",
    )
    expect(html).toContain('function updateWindowTitle(panel)')
    expect(html).toContain("heading.querySelector('.document-file-meta')")
    expect(html).toContain('width:min(1120px,calc(100% - 320px))')
    expect(html).toContain(
      'body{overflow:hidden}.universe-shell{display:flex;flex-direction:column;height:100vh;min-height:100vh',
    )
    expect(html).toContain(
      '.universe-main{position:relative;flex:1 1 auto;min-height:0;height:auto',
    )
    expect(html).toContain(
      '.center-focus{left:50%;width:calc(100% - 20px);min-width:0;height:calc(100% - 20px)',
    )
    expect(html).toContain('.center-focus-actions{right:6px;min-width:104px}')
    expect(html).toContain(
      '@media(max-width:1100px){.universe-header{flex-wrap:wrap',
    )
    expect(html).toContain(
      '.universe-actions{flex:1 1 100%;flex-wrap:wrap;justify-content:flex-end}',
    )

    // F9 document breadcrumbs under the header.
    expect(html).toContain("crumbs.className = 'document-breadcrumb'")
    expect(html).toContain('document-breadcrumb-folder')
    expect(html).toContain('document-breadcrumb-leaf')

    // F10 search shortcut — '/' or Ctrl/Cmd+K focuses the search input.
    expect(html).toContain("event.key === '/'")
    expect(html).toContain('event.ctrlKey || event.metaKey')
    expect(html).toContain('searchInputEl.focus(); searchInputEl.select()')
  })
})
