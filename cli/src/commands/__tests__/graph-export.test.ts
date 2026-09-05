/**
 * Knowledge-graph command tests — core export behavior.
 *
 * FID-2026-0819-005 Loop 313: split of the 1710-line graph-export.test.ts
 * monolith. This module keeps the branded-report and progress-lifecycle
 * tests; audio, refresh, payload/structure, branding, UI-contract,
 * security, and document-serializer suites live in focused sibling modules
 * sharing the ./graph-export-test-harness fixtures.
 */
import fs from 'fs'
import vm from 'node:vm'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { handleGraphExportCommand } from '../graph-export'
import {
  afterEachHarness,
  beforeEachHarness,
  buildGraphFixture,
  buildMultiDirFixture,
  decodeDocsPayload,
  makeParams,
  messageSnapshots,
  renderedMessages,
  renderedText,
  tempDir,
} from './graph-export-test-harness'

import type { RouterParams } from '../command-registry'

describe('knowledge-graph commands', () => {
  beforeEach(beforeEachHarness)
  afterEach(afterEachHarness)

  test('graph-export writes a branded offline HTML report', async () => {
    // Multi-directory fixture so folder derivation emits real drill-down
    // containers (a single src/ bucket degenerates to no containers).
    await buildMultiDirFixture()

    const outputPath = path.join(tempDir, 'graph-report.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
    const html = fs.readFileSync(outputPath, 'utf8')

    // Same /export design system: real logo, offline, tokens
    expect(html).toContain('data:image/png;base64,')
    expect(html).toContain('<img class="logo"')
    expect(html).not.toContain('cdn.jsdelivr.net')
    // FID-2026-0806-017: no 1.2 MB Font Awesome block — inline SVG sprite
    // with the exact glyphs instead; /export (chat) keeps the fonts.
    expect(html).not.toContain('url(data:font/woff2;base64,')
    expect(html).not.toContain('Font Awesome 6 Free')
    expect(html).toContain('<symbol id="icon-search"')
    expect(html).toContain('<symbol id="icon-expand"')
    expect(html).toContain('<symbol id="icon-palette"')
    expect(html).toContain('<symbol id="icon-route"')
    expect(html).toContain('--cyan:#18faf9')
    expect(html).toContain('--blue:#4fa8ff')
    expect(html).toContain('class="universe-shell"')
    expect(html).toContain('class="space-stars"')
    expect(html).toContain('class="shooting-star')
    expect(html).toContain('class="planet-effects"')
    expect(html).toContain('star-drift')
    expect(html).toContain('shooting-star')
    expect(html).toContain(
      'scrollbar-color:var(--scroll-thumb) var(--scroll-track-alt)',
    )
    expect(html).toContain('class="brand-lockup"')
    expect(html).toContain('id="savant-audio-data"')
    expect(html).toContain('id="sound-control"')
    expect(html).toContain('id="sound-toggle"')
    expect(html).toContain('id="sound-volume"')
    expect(html).toContain('function unlockAudio()')
    expect(html).toContain('function playSound(cue)')
    expect(html).toContain('function playProcedural(cue)')
    expect(html).not.toContain('fetch(asset.dataUri)')
    expect(html).toContain('decodeAudioData(bytes.buffer)')

    // Sigma.js + Graphology are inlined for the offline WebGL renderer. Graph
    // data is inert application/json and parsed only at runtime.
    expect(html).toContain('Sigma')
    expect(html).toContain('Graphology')
    expect(html).toContain('type="application/json" id="savant-graph-data"')
    expect(html).toContain(
      "JSON.parse(document.getElementById('savant-graph-data')",
    )
    expect(html).not.toContain('var GRAPH_DATA = {')
    // Coordinates are export-time data; the browser receives no layout engine.
    expect(html).toContain('"position":')
    expect(html).toContain("new Graphology({ multi: true, type: 'mixed' })")
    expect(html).toContain(
      "new Sigma(graph, document.getElementById('sigma-container')",
    )
    expect(html).toContain('function fitUniverse()')
    expect(html).toContain('function fitUniverseSilently()')
    expect(html).toContain('function updateZoomState()')
    expect(html).toContain('function toggleMotion()')
    expect(html).toContain('doc.text.split(String.fromCharCode(10))')
    const appScripts: string[] = []
    let scriptCursor = 0
    while (true) {
      const scriptStart = html.indexOf('<script', scriptCursor)
      if (scriptStart < 0) break
      const scriptOpenEnd = html.indexOf('>', scriptStart)
      const scriptClose = html.indexOf('</script>', scriptOpenEnd)
      if (scriptOpenEnd < 0 || scriptClose < 0) break
      appScripts.push(html.slice(scriptOpenEnd + 1, scriptClose))
      scriptCursor = scriptClose + '</script>'.length
    }
    expect(appScripts.length).toBeGreaterThanOrEqual(3)
    const matchingAppScripts = appScripts.filter((script) =>
      script.includes('function buildGraph()'),
    )
    expect(matchingAppScripts).toHaveLength(1)
    const appScript = matchingAppScripts[0]
    expect(
      () => new vm.Script(appScript ?? '', { filename: 'graph-app.js' }),
    ).not.toThrow()
    expect(html).toContain('function hideGraphLoading()')
    expect(html).toContain('id="universe-tooltip" class="universe-tooltip"')
    expect(html).toContain('role="tooltip" aria-hidden="true"')
    expect(html).toContain('.universe-tooltip{position:absolute;z-index:7')
    expect(html).toContain(
      'background:linear-gradient(145deg,#0a2340f5,#061226f5)',
    )
    expect(html).toContain('border:1px solid var(--cyan)')
    expect(html).toContain('box-shadow:0 0 9px #18faf988')
    expect(html).toContain('pointer-events:none')
    expect(html).toContain('function showUniverseTooltip(node, nodeId)')
    expect(html).toContain('function positionUniverseTooltip()')
    expect(html).toContain('function hideUniverseTooltip()')
    expect(html).toContain('labelRenderedSizeThreshold: 18')
    expect(html).toContain('defaultDrawNodeHover: function () {}')
    expect(html).toContain('positionUniverseTooltip();')
    expect(html).toContain('showUniverseTooltip(n, event.node)')
    expect(html).toContain('hideUniverseTooltip(); setStatus')
    expect(html).toContain("tooltip.style.left = left + 'px'")
    expect(html).toContain("tooltip.style.top = top + 'px'")
    expect(html).toContain('overflow-wrap:anywhere')
    expect(html).toContain('function showGraphFailure(message)')
    expect(html).toContain(
      '@keyframes orbit{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
    )
    expect(html).toContain('function isContextNode(id)')
    expect(html).toContain('function isContextEdge(ext)')
    expect(html).toContain('id="center-focus"')
    expect(html).toContain('function renderFocusView(n, kind)')
    expect(html).toContain('function clearFocusView()')
    expect(html).toContain('function selectionNodes(id)')
    expect(html).toContain('function fitSelection(id)')
    expect(html).toContain('center-browser')
    expect(html).toContain('browser-grid')
    expect(html).toContain('function renderCenterBrowser()')
    expect(html).toContain('function renderDocument(file)')
    expect(html).toContain('document-surface')
    expect(html).toContain('document-line-number')
    expect(html).toContain("doc.kind === 'image'")
    expect(html).toContain('image.src = doc.dataUri')
    expect(html).toContain('image.onerror = function ()')
    expect(html).toContain("strong.textContent = 'DOCUMENT UNAVAILABLE'")
    expect(html).toContain('browser-up')
    expect(html).toContain('browserPage')
    expect(html).toContain('result.hidden = false')
    expect(html).toContain('Selection preserved')
    expect(html).toContain('z-index:6;pointer-events:auto')
    expect(html).toContain('--travel-x:')
    expect(html).toContain('--travel-y:')
    expect(html).toContain('--angle:')
    expect(html).toContain('--tail:')
    expect(html).not.toContain('rotate(-28deg)')
    expect(html).toContain(
      '.shooting-star{animation:none!important;opacity:1!important;transform:rotate(var(--angle))!important}',
    )
    expect(html).toContain('updateZoomState(); drawPlanetEffects();')
    expect(html).toContain('visibilitychange')
    expect(html).toContain('cancelAnimationFrame(motionFrame)')
    expect(html).toContain('Code Universe')
    // Both fixture files appear as nodes
    expect(html).toContain('src/a.ts')
    expect(html).toContain('src/b.ts')
    // Edge layer: the a→b import edge
    expect(html).toContain('IMPORTS')

    // Sidebar (FID-2026-0806-006): drawer markup; previews are OFF by default
    // (FID-2026-0806-017 opt-in), so the preview slot carries the fallback.
    expect(html).toContain('graph-sidebar')
    expect(html).toContain('sidebar-preview')
    expect(html).toContain('previews are opt-in at export time')

    // Meta grid shows real counts (4 files across src/ + lib/)
    expect(html).toContain('<b>4</b><span>FILES</span>')

    // Drill-down: containers derived from folder structure; the fixture's
    // files live under src/ and lib/, so folder containers are emitted with
    // children hidden by default.
    expect(html).toContain('SYSTEMS / REGIONS')
    expect(html).toContain('region-list')
    expect(html).toContain('regionId')

    // Success message names the output path
    expect(renderedText()).toContain('Exported the knowledge graph')
    expect(renderedText()).toContain(outputPath)
  })

  test('graph-export shows ordered staged progress and replaces it with one final message', async () => {
    await buildGraphFixture()

    const outputPath = path.join(tempDir, 'graph-progress.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)

    const stages = messageSnapshots
      .map((snapshot) => snapshot.at(-1)?.content ?? '')
      .filter((content) => content.includes('Exporting knowledge graph'))
      .map((content) => content.split('\n\n')[1])
    expect(stages).toEqual([
      'Preparing the graph export…',
      'Refreshing the project index…',
      'Serializing the graph…',
      'Laying out the universe…',
      'Embedding document contents…',
      'Compressing the offline payload…',
      'Assembling the HTML report…',
      'Writing the HTML file…',
    ])
    expect(renderedMessages).toHaveLength(1)
    expect(renderedMessages[0]?.content).toContain(
      'Exported the knowledge graph',
    )
    expect(renderedMessages[0]?.content).not.toContain(
      'Exporting knowledge graph',
    )
    expect(fs.existsSync(outputPath)).toBe(true)
  })

  test('graph-export refreshes stale rows before embedding current FID documents', async () => {
    await buildGraphFixture()
    fs.rmSync(path.join(tempDir, 'src/b.ts'))
    fs.mkdirSync(path.join(tempDir, 'dev', 'fids'), { recursive: true })
    fs.writeFileSync(
      path.join(tempDir, 'dev', 'fids', 'FID-current.md'),
      '# Current FID\\n\\nDocument freshness regression.\\n',
    )

    const outputPath = path.join(tempDir, 'graph-fresh.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
    const html = fs.readFileSync(outputPath, 'utf8')
    const docs = decodeDocsPayload(html)
    const current = Object.values(docs).find(
      (doc) =>
        typeof doc === 'object' &&
        doc !== null &&
        (doc as { text?: string }).text?.includes(
          'Document freshness regression.',
        ),
    )

    expect(html).not.toContain('src/b.ts')
    expect(current).toBeDefined()
    expect(renderedText()).toContain('Exported the knowledge graph')
  })

  test('graph-export keeps exporting when a progress update throws', async () => {
    await buildGraphFixture()
    const outputPath = path.join(tempDir, 'graph-progress-ui-error.html')
    const params = makeParams('/graph-export')
    const originalSetMessages = params.setMessages
    let updateCount = 0
    params.setMessages = ((update) => {
      updateCount += 1
      if (updateCount === 2) throw new Error('UI unavailable')
      originalSetMessages(update)
    }) as RouterParams['setMessages']

    await handleGraphExportCommand(params, outputPath)

    expect(fs.existsSync(outputPath)).toBe(true)
    expect(renderedMessages.at(-1)?.content).toContain(
      'Exported the knowledge graph',
    )
  })

  test('graph-export replaces progress with a failure without leaving a spinner', async () => {
    await buildGraphFixture()
    const blocker = path.join(tempDir, 'blocked-output')
    fs.writeFileSync(blocker, 'not a directory')

    await handleGraphExportCommand(
      makeParams('/graph-export'),
      path.join(blocker, 'graph.html'),
    )

    expect(renderedMessages).toHaveLength(1)
    expect(renderedMessages[0]?.content).toContain('Failed to export graph')
    expect(renderedMessages[0]?.content).not.toContain(
      'Exporting knowledge graph',
    )
  })
})
