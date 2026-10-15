import fs from 'fs'
import path from 'path'

import {
  openGraphDatabase,
  serializeGraphForExport,
  updateKnowledgeGraph,
} from '@savant-code/knowledge-graph'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { handleGraphExportCommand } from '../graph-export'
import {
  afterEachHarness,
  beforeEachHarness,
  buildMultiDirFixture,
  makeParams,
  tempDir,
} from './graph-export-test-harness'
import { computeGraphLayout } from '../graph-export/layout'

describe('knowledge-graph commands: graph structure + navigation', () => {
  beforeEach(beforeEachHarness)
  afterEach(afterEachHarness)

  test('graph-export emits the FID-018 compact overview coordinate contract', async () => {
    await buildMultiDirFixture()

    const outputPath = path.join(tempDir, 'graph-report.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
    const html = fs.readFileSync(outputPath, 'utf8')

    // The emitted app script uses Sigma camera states and the renderer-neutral payload.
    // the serialized stable anchor when expanding (never a live parent pos).
    expect(html).toContain('function navigateToObject(id)')
    expect(html).toContain('navigateToObject(event.node)')
    expect(html).toContain('navigateToObject(r.id)')
    expect(html).toContain('function updateZoomState()')
    expect(html).toContain('function reduceEdge(id, attrs)')
    expect(html).toContain('function fitUniverse()')
    expect(html).toContain('function fitUniverseSilently()')
    expect(html).toContain('function toggleMotion()')
    expect(html).toContain('fitSelection(id)')
    expect(html).toContain('clearFocusView()')

    // Overview elements (containers + ungrouped roots) carry compact center
    // positions; children carry parent linkage + childOffset and no position.
    // The inert block is JSON with every < escaped to \\u003c; decode before
    // parsing so the escaped payload round-trips.
    const dataAnchor = 'type="application/json" id="savant-graph-data"'
    const dataStart = html.indexOf(dataAnchor)
    const dataOpen = html.indexOf('>', dataStart)
    const dataEnd = html.indexOf('</script>', dataOpen)
    const payload: {
      universe: {
        regions: Array<{ id: string; position: { x: number; y: number } }>
        files: Array<{
          id: string
          regionId: string
          position: { x: number; y: number }
        }>
        edges: Array<{ source: string; target: string }>
        corridors: Array<{ source: string; target: string }>
      }
    } = JSON.parse(html.slice(dataOpen + 1, dataEnd).replace(/\\u003c/g, '<'))
    expect(payload.universe.regions.length).toBeGreaterThan(0)
    expect(payload.universe.files.length).toBe(4)
    expect(payload.universe.edges.length).toBeGreaterThan(0)
    expect(
      payload.universe.regions.every(
        (r) => Number.isFinite(r.position.x) && Number.isFinite(r.position.y),
      ),
    ).toBe(true)
    expect(
      payload.universe.files.every((f) =>
        payload.universe.regions.some((r) => r.id === f.regionId),
      ),
    ).toBe(true)
    expect(payload.universe.corridors.every((c) => c.source !== c.target)).toBe(
      true,
    )

    // Repeated export-time layout remains deterministic and finite.
    const db = openGraphDatabase(tempDir)
    try {
      const graph = serializeGraphForExport(db, { projectRoot: tempDir })
      const a = await computeGraphLayout(graph.elements)
      const b = await computeGraphLayout(graph.elements)
      expect(a.positions).toEqual(b.positions)
      expect(a.overviewPositions).toEqual(b.overviewPositions)
      expect(a.childOffsets).toEqual(b.childOffsets)
      expect(
        Object.values(a.positions).every(
          (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
        ),
      ).toBe(true)
    } finally {
      db.close()
    }
  })

  test('graph-export groups root-level files into the ROOT system (no fake file regions)', async () => {
    // Root file + a nested file + a packages/<file>: the root and
    // packages-level files must land in their parent system regions and must
    // never be emitted as their own 1-file "systems" (the left-nav quirk
    // where clicking a root file opened the ROOT directory instead of the
    // file's document).
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# readme\n')
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true })
    fs.writeFileSync(path.join(tempDir, 'src/a.ts'), 'export const a = 1\n')
    fs.mkdirSync(path.join(tempDir, 'packages'), { recursive: true })
    fs.writeFileSync(
      path.join(tempDir, 'packages/package.json'),
      '{"name":"pkg"}\n',
    )
    const db = openGraphDatabase(tempDir)
    try {
      await updateKnowledgeGraph({
        projectRoot: tempDir,
        db,
        fullRebuild: true,
      })
    } finally {
      db.close()
    }

    const outputPath = path.join(tempDir, 'graph-report.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
    const html = fs.readFileSync(outputPath, 'utf8')

    const dataAnchor = 'type="application/json" id="savant-graph-data"'
    const dataStart = html.indexOf(dataAnchor)
    const dataOpen = html.indexOf('>', dataStart)
    const dataEnd = html.indexOf('</script>', dataOpen)
    const payload: {
      universe: {
        regions: Array<{
          id: string
          path: string
          fileCount: number
          disconnected: boolean
        }>
        files: Array<{ id: string; path: string; regionId: string }>
      }
    } = JSON.parse(html.slice(dataOpen + 1, dataEnd).replace(/\\u003c/g, '<'))

    // ROOT is the first system in the list.
    expect(payload.universe.regions[0]?.path).toBe('root')
    const rootRegion = payload.universe.regions.find((r) => r.path === 'root')
    expect(rootRegion).toBeDefined()
    // The root file belongs to the ROOT region, not a region named after it.
    const readme = payload.universe.files.find((f) => f.path === 'README.md')
    expect(readme?.regionId).toBe(rootRegion?.id)
    expect(payload.universe.regions.some((r) => r.path === 'README.md')).toBe(
      false,
    )
    expect(rootRegion?.fileCount).toBe(1)
    // The ROOT system is never flagged isolated.
    expect(rootRegion?.disconnected).toBe(false)
    // packages/<file> belongs to the packages system, not a file-named one.
    const packagesRegion = payload.universe.regions.find(
      (r) => r.path === 'packages',
    )
    expect(packagesRegion).toBeDefined()
    expect(
      payload.universe.files.find((f) => f.path === 'packages/package.json')
        ?.regionId,
    ).toBe(packagesRegion?.id)
    expect(
      payload.universe.regions.some((r) => r.path === 'packages/package.json'),
    ).toBe(false)
    // The nested file keeps its own real system.
    const srcRegion = payload.universe.regions.find((r) => r.path === 'src')
    expect(srcRegion).toBeDefined()
    expect(
      payload.universe.files.find((f) => f.path === 'src/a.ts')?.regionId,
    ).toBe(srcRegion?.id)
  })

  test('graph-export left nav drills down into nested folder trees', async () => {
    // FID-2026-0807-010 F1/F2/F3: the systems list is a nested tree — region
    // rows expand into folder rows that expand into file rows; file rows
    // navigate directly and the selected row is highlighted + revealed.
    await buildMultiDirFixture()

    const outputPath = path.join(tempDir, 'graph-report.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
    const html = fs.readFileSync(outputPath, 'utf8')

    expect(html).toContain('function buildRegionNav()')
    expect(html).toContain('function regionRootTree(region)')
    expect(html).toContain('function buildRegionTree(files, skipSegments)')
    expect(html).toContain("row.className = 'region-row'")
    expect(html).toContain('function toggleRegionFiles(item, region)')
    expect(html).toContain("list.className = 'region-files hidden'")
    expect(html).toContain("row.setAttribute('aria-expanded', 'false')")
    expect(html).toContain("row.setAttribute('aria-controls', list.id)")
    expect(html).toContain(
      "row.setAttribute('aria-expanded', open ? 'false' : 'true')",
    )
    expect(html).toContain('function renderTreeLevel(container, node)')
    expect(html).toContain("row.className = 'region-tree-folder'")
    expect(html).toContain('function toggleFolderRow(row, node)')
    expect(html).toContain("button.className = 'region-file'")
    expect(html).toContain(
      "button.onclick = function () { navigateToObjectWithCue(file.id, 'open'); navKeyFocusRow(button) }",
    )
    expect(html).toContain("chevron.textContent = hasChildren ? '▸' : ''")
    expect(html).toContain("chevron.textContent = open ? '▸' : '▾'")
    expect(html).toContain('.region-files.hidden{display:none}')
    expect(html).toContain('.region-tree-folder.nav-active')
    expect(html).toContain('function revealInNav(id)')
    expect(html).toContain("target.scrollIntoView({ block: 'nearest' })")
    expect(html).toContain('function navigateToFolder(folder)')
    expect(html).toContain(
      "setStatus('Exploring ' + (folder.path || folder.label))",
    )
  })

  test('graph-export document toolbar pages through sibling files', async () => {
    // FID-2026-0807-010 F4: renderDocument gains prev/next sibling paging so
    // files can be browsed without returning to the folder grid.
    await buildMultiDirFixture()

    const outputPath = path.join(tempDir, 'graph-report.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
    const html = fs.readFileSync(outputPath, 'utf8')

    expect(html).toContain('function siblingFiles()')
    expect(html).toContain(
      "var prev = browserButton('← PREV FILE', 'browser-back', 'doc-prev', '')",
    )
    expect(html).toContain('prev.disabled = sibIndex <= 0')
    expect(html).toContain(
      "var next = browserButton('NEXT FILE →', 'browser-back', 'doc-next', '')",
    )
    expect(html).toContain(
      'next.disabled = sibIndex < 0 || sibIndex >= sibs.length - 1',
    )
    expect(html).toContain(
      '.browser-back:disabled,.document-copy:disabled{opacity:.35;cursor:default;transform:none;box-shadow:none}',
    )
  })

  test('graph-export builds a ranked kind-aware search with keyboard navigation', async () => {
    // FID-2026-0807-008 F3: search covers files, folders, and systems with
    // scored ranking, a live results panel, and arrow/Enter/Escape wiring.
    await buildMultiDirFixture()

    const outputPath = path.join(tempDir, 'graph-report.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
    const html = fs.readFileSync(outputPath, 'utf8')

    // Panel + combobox ARIA surface.
    expect(html).toContain('id="search-results"')
    expect(html).toContain('class="search-results hidden"')
    expect(html).toContain('role="combobox"')
    expect(html).toContain('role="listbox"')
    // Index is precomputed at export time and shipped in the payload; the
    // browser consumes it without building anything at load.
    expect(html).toContain('searchIndex')
    expect(html).toContain(
      'var searchIndex = (DATA.universe.searchIndex || []).slice();',
    )
    expect(html).not.toContain('function buildSearchIndex()')
    expect(html).toContain('function renderSearchResults(query)')
    expect(html).toContain('function searchScore(entry, query)')
    // Ranking rules + highlighting + navigation.
    expect(html).toContain('function highlightMatch(text, query)')
    expect(html).toContain("createElement('mark')")
    expect(html).toContain('function selectSearchRow(index)')
    expect(html).toContain('function closeSearchPanel()')
    expect(html).toContain("row.setAttribute('role', 'option')")
    expect(html).toContain('search-row')
    expect(html).toContain('ArrowDown')
    expect(html).toContain('ArrowUp')
    expect(html).toContain("event.key === 'Enter'")
    expect(html).toContain('NO MATCHES FOR')
    // Combobox aria-expanded is toggled with panel visibility.
    expect(html).toContain("inputEl.setAttribute('aria-expanded', 'true')")
    expect(html).toContain("input.setAttribute('aria-expanded', 'false')")
    // Folder results route through the center browser, not the node navigator.
    expect(html).toContain('browserFolderId = folder.id')
    expect(html).toContain('renderCenterBrowser()')
  })
})
