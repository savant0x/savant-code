/**
 * Live end-to-end harness — FID-2026-0806-002 (knowledge graph) +
 * FID-2026-0806-004-era export system full test.
 *
 * Exercises the REAL command handlers on a fixture project:
 *   1. /graph refresh        → indexes the fixture (real tree-sitter parse)
 *   2. /graph-export         → writes a self-contained branded HTML graph report
 *   3. /export               → writes a self-contained branded HTML chat report
 *
 * Prints PASS/FAIL per check. Exit code 0 = all pass.
 * Run: cd cli && bun ../dev/scratchpad/graph-export-e2e.ts
 */

/* eslint-disable no-console */

import fs from 'fs'
import os from 'os'
import path from 'path'

import { handleExportConversationCommand } from '../../../cli/src/commands/export-conversation'
import { handleGraphExportCommand } from '../../../cli/src/commands/graph-export'
import { handleGraphRefreshCommand } from '../../../cli/src/commands/graph-refresh'
import { setProjectRoot } from '../../../cli/src/project-files'
import { useChatStore } from '../../../cli/src/state/chat-store'

import type { RouterParams } from '../../../cli/src/commands/command-registry'
import type { ChatMessage } from '../../../cli/src/types/chat'

let failures = 0
let passes = 0

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passes++
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`)
  } else {
    failures++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function makeParams(inputValue: string): {
  params: RouterParams
  rendered: ChatMessage[]
} {
  const rendered: ChatMessage[] = []
  const params = {
    inputRef: { current: null },
    setMessages: (
      update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
    ) => {
      rendered.splice(
        0,
        rendered.length,
        ...(typeof update === 'function' ? update(rendered) : update),
      )
    },
    saveToHistory: () => {},
    setInputValue: () => {},
    setInputFocused: () => {},
    setIsAuthenticated: () => {},
    setUser: () => {},
    addToQueue: () => {},
    clearMessages: () => {},
    scrollToLatest: () => {},
    sendMessage: async () => {},
    setCanProcessQueue: () => {},
    inputValue,
    agentMode: 'HYBRID',
    isChainInProgressRef: { current: false },
    isStreaming: false,
    streamMessageIdRef: { current: null },
    abortControllerRef: { current: null },
    logoutMutation: {},
  } as unknown as RouterParams
  return { params, rendered }
}

async function main(): Promise<void> {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-e2e-'))
  setProjectRoot(fixture)
  useChatStore.setState({ messages: [], chatSessionId: 'e2e-session' })

  console.log('=== fixture project ===')
  fs.mkdirSync(path.join(fixture, 'src'), { recursive: true })
  fs.writeFileSync(
    path.join(fixture, 'src/a.ts'),
    "import { greet } from './b'\nimport { helper } from './c'\nexport class A { run() { return greet() + helper() } }\n",
  )
  fs.writeFileSync(
    path.join(fixture, 'src/b.ts'),
    'export function greet() { return "hi" }\n',
  )
  fs.writeFileSync(
    path.join(fixture, 'src/c.ts'),
    'export function helper() { return 1 }\n',
  )

  try {
    // 1) /graph refresh — real incremental indexer over the fixture
    console.log('=== 1) /graph refresh ===')
    const r1 = makeParams('/graph refresh')
    await handleGraphRefreshCommand(r1.params, '')
    const refreshText = r1.rendered.map((m) => m.content ?? '').join('\n')
    check(
      'graph DB exists on disk',
      fs.existsSync(path.join(fixture, '.savant', 'graph.db')),
    )
    check(
      'refresh reports files',
      /Files:\*\* 3 on disk/.test(refreshText),
      refreshText.match(/\*\*Files:\*\* [^\\n]+/)?.[0] ?? '',
    )
    check(
      'refresh reports nodes/edges/clusters',
      /Graph:\*\* \d+ nodes/.test(refreshText),
      refreshText.match(/\*\*Graph:\*\* [^\\n]+/)?.[0] ?? '',
    )

    // Incremental refresh: add a file, re-run, confirm unchanged count > 0
    fs.writeFileSync(path.join(fixture, 'src/d.ts'), 'export const d = 1\n')
    const r1b = makeParams('/graph refresh')
    await handleGraphRefreshCommand(r1b.params, '')
    const refresh2 = r1b.rendered.map((m) => m.content ?? '').join('\n')
    check(
      'incremental refresh skips unchanged files',
      /unchanged/.test(refresh2) && /3 unchanged/.test(refresh2),
      refresh2.match(/Files:\*\* [^\\n]+/)?.[0] ?? '',
    )

    // 2) /graph-export — real HTML report on disk
    console.log('=== 2) /graph-export ===')
    const graphOut = path.join(fixture, 'savant-graph-e2e.html')
    const r2 = makeParams('/graph-export')
    await handleGraphExportCommand(r2.params, graphOut)
    const graphHtml = fs.readFileSync(graphOut, 'utf8')
    check(
      'graph HTML written',
      fs.existsSync(graphOut),
      `${(fs.statSync(graphOut).size / 1024).toFixed(0)} KB`,
    )
    check(
      'graph HTML has inlined logo',
      graphHtml.includes('data:image/png;base64,'),
    )
    check(
      'graph HTML is offline + sprite-based (no CDN, no FA fonts)',
      !graphHtml.includes('cdn.jsdelivr.net') &&
        !graphHtml.includes('url(data:font/woff2;base64,') &&
        graphHtml.includes('<symbol id="icon-search"'),
    )
    check(
      'graph HTML has Sigma Code Universe + inert JSON data',
      graphHtml.includes('Sigma') &&
        graphHtml.includes('Graphology') &&
        graphHtml.includes('type="application/json" id="savant-graph-data"') &&
        graphHtml.includes('"position":') &&
        graphHtml.includes('Code Universe'),
    )
    const audioDataStart = graphHtml.indexOf(
      'type="application/json" id="savant-audio-data"',
    )
    const audioDataOpen = graphHtml.indexOf('>', audioDataStart)
    const audioDataEnd = graphHtml.indexOf('</script>', audioDataOpen)
    const audioPayload = JSON.parse(
      graphHtml.slice(audioDataOpen + 1, audioDataEnd),
    ) as { cues: Array<Record<string, unknown>> }
    const audioPayloadText = graphHtml.slice(audioDataOpen + 1, audioDataEnd)
    const appScriptStart = graphHtml.indexOf('<script>\n(function ()')
    const appScriptOpenEnd = graphHtml.indexOf('>', appScriptStart)
    const appScriptEnd = graphHtml.indexOf('</script>', appScriptOpenEnd)
    const appScript = graphHtml.slice(appScriptOpenEnd + 1, appScriptEnd)
    const hasAudioFetch =
      /fetch\s*\([^)]*(?:audio|dataUri)|(?:audio|dataUri)[^\n]*fetch/i.test(
        appScript,
      )
    const hasRelativeAudio =
      /(?:src|href)=["'][^"']+\.(?:ogg|mp3|wav)(?:["']|[?#])/i.test(appScript)
    check(
      'graph HTML embeds verified offline SFX registry',
      audioPayload.cues.length === 6 &&
        audioPayload.cues.every(
          (cue) =>
            typeof cue.dataUri === 'string' &&
            cue.dataUri.startsWith('data:audio/ogg;base64,'),
        ) &&
        audioPayload.cues.every(
          (cue) => !('sourceUrl' in cue) && !('license' in cue),
        ) &&
        !hasAudioFetch &&
        !hasRelativeAudio &&
        !audioPayloadText.includes('http://') &&
        !audioPayloadText.includes('https://') &&
        graphHtml.includes('id="sound-control"') &&
        graphHtml.includes('id="sound-toggle"') &&
        graphHtml.includes('id="sound-volume"') &&
        graphHtml.includes('function unlockAudio()') &&
        graphHtml.includes('function playSound(cue)'),
      `6 cues / ${Buffer.byteLength(audioPayloadText, 'utf8')} registry bytes`,
    )
    check(
      'graph HTML has spatial navigation states',
      graphHtml.includes('function updateZoomState()') &&
        graphHtml.includes('function hideGraphLoading()') &&
        graphHtml.includes('function showGraphFailure(message)') &&
        graphHtml.includes('doc.text.split(String.fromCharCode(10))') &&
        graphHtml.includes('function navigateToObject(id)') &&
        graphHtml.includes('navigateToObject(r.id)') &&
        graphHtml.includes('function fitUniverse()') &&
        graphHtml.includes('function fitUniverseSilently()') &&
        graphHtml.includes('audioBootstrapping = true') &&
        graphHtml.includes('audioBootstrapping = false') &&
        graphHtml.includes('SYSTEMS / REGIONS'),
    )
    check(
      'graph HTML has center focus + dynamic selection framing',
      graphHtml.includes('id="center-focus"') &&
        graphHtml.includes('function renderFocusView(n, kind)') &&
        graphHtml.includes('function clearFocusView()') &&
        graphHtml.includes('function selectionNodes(id)') &&
        graphHtml.includes('function fitSelection(id)') &&
        graphHtml.includes('center-browser') &&
        graphHtml.includes('browser-grid') &&
        graphHtml.includes('function renderCenterBrowser()') &&
        graphHtml.includes('function renderDocument(file)') &&
        graphHtml.includes('document-surface') &&
        graphHtml.includes('browser-up'),
    )
    check(
      'graph HTML has ambient cyberpunk space effects',
      graphHtml.includes('class="space-stars"') &&
        graphHtml.includes('class="shooting-star') &&
        graphHtml.includes('class="planet-effects"') &&
        graphHtml.includes('--travel-x:') &&
        graphHtml.includes('--angle:') &&
        graphHtml.includes('function isContextNode(id)'),
    )
    check(
      'graph HTML shows fixture nodes',
      graphHtml.includes('src/a.ts') &&
        graphHtml.includes('src/b.ts') &&
        graphHtml.includes('src/c.ts'),
    )
    check(
      'graph HTML has edge layer',
      graphHtml.includes('corridors') && graphHtml.includes('universe.edges'),
    )

    // The product export explicitly embeds bounded documents; direct serializer
    // callers remain metadata-only. Parse the inert payload to verify the
    // product contract instead of matching the fallback string in the app code.
    const graphDataStart = graphHtml.indexOf(
      'type="application/json" id="savant-graph-data"',
    )
    const graphDataOpen = graphHtml.indexOf('>', graphDataStart)
    const graphDataEnd = graphHtml.indexOf('</script>', graphDataOpen)
    const graphPayload = JSON.parse(
      graphHtml.slice(graphDataOpen + 1, graphDataEnd).replace(/\\u003c/g, '<'),
    ) as {
      universe: {
        documentPolicy: { enabled: boolean; maxTextLines: number }
        documents: Record<string, { kind?: string }>
      }
    }
    check(
      'graph HTML embeds bounded product documents',
      graphPayload.universe.documentPolicy.enabled &&
        graphPayload.universe.documentPolicy.maxTextLines === 500 &&
        Object.values(graphPayload.universe.documents).some(
          (document) => document.kind === 'text',
        ),
    )

    // 3) /export — real HTML chat report on disk
    console.log('=== 3) /export ===')
    useChatStore.setState({
      messages: [
        {
          id: 'm1',
          variant: 'user',
          content: 'Build a hello world',
          timestamp: '2026-08-06T00:00:00.000Z',
        },
        {
          id: 'm2',
          variant: 'ai',
          content: '**Done.** Here is the code.\n\n```ts\nconst x = 1\n```',
          timestamp: '2026-08-06T00:00:01.000Z',
        },
      ],
      chatSessionId: 'e2e-session',
    })
    const exportOut = path.join(fixture, 'savant-export-e2e.html')
    const r3 = makeParams('/export')
    await handleExportConversationCommand(r3.params, exportOut)
    const exportHtml = fs.readFileSync(exportOut, 'utf8')
    check(
      'export HTML written',
      fs.existsSync(exportOut),
      `${(fs.statSync(exportOut).size / 1024).toFixed(0)} KB`,
    )
    check(
      'export HTML self-contained offline',
      !exportHtml.includes('cdn.jsdelivr.net') &&
        exportHtml.includes('url(data:font/woff2;base64,'),
    )
    check(
      'export HTML renders content + copy buttons',
      exportHtml.includes('<strong>Done.</strong>') &&
        exportHtml.includes('copyAll') &&
        exportHtml.includes('Copy all'),
    )
    check(
      'export success message names path',
      r3.rendered
        .map((m) => m.content ?? '')
        .join('')
        .includes('Exported 2 messages'),
    )

    console.log(`\\n=== RESULT: ${passes} PASS / ${failures} FAIL ===`)
  } finally {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        fs.rmSync(fixture, { recursive: true, force: true })
        break
      } catch {
        Bun.sleepSync(50)
      }
    }
  }
  process.exit(failures > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('E2E harness crashed:', err)
  process.exit(1)
})
