/**
 * Shared fixtures for the knowledge-graph command test family
 * (graph-export*.test.ts — FID-2026-0819-005 Loop 313 split).
 *
 * Provides the temp-dir lifecycle (real temp projects, cleaned after each
 * test with a Windows EBUSY retry), chat-store wiring, the RouterParams
 * builder, the docs-payload decoder, and the graph index fixtures. Every
 * assertion in the family runs against a real project tree and a real
 * SQLite graph DB — see graph-export.test.ts for the family header.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  openGraphDatabase,
  updateKnowledgeGraph,
} from '@savant-code/knowledge-graph'
import { mock } from 'bun:test'

import { setProjectRoot } from '../../project-files'
import { useChatStore } from '../../state/chat-store'

import type { ChatMessage } from '../../types/chat'
import type { RouterParams } from '../command-registry'

export let tempDir: string
export let renderedMessages: ChatMessage[]
export let messageSnapshots: ChatMessage[][]

export function beforeEachHarness() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-graph-cmd-'))
  setProjectRoot(tempDir)
  renderedMessages = []
  messageSnapshots = []
  useChatStore.setState({
    messages: [],
    chatSessionId: 'test-session-1234',
  })
}

export function afterEachHarness() {
  useChatStore.setState({ messages: [], chatSessionId: '' })
  // Windows can briefly hold SQLite file locks after a handle closes (WAL
  // sidecars). Retry the recursive delete so a transient EBUSY doesn't
  // fail unrelated cleanup.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
      break
    } catch {
      Bun.sleepSync(50)
    }
  }
}

export function renderedText(): string {
  return renderedMessages.map((m) => m.content ?? '').join('\n')
}

/** Extract the gzip/plain docs payload from a generated artifact and decode it. */
export function decodeDocsPayload(html: string): Record<string, unknown> {
  const anchor = '<script type="text/plain" id="savant-docs-payload">'
  const start = html.indexOf(anchor)
  const open = html.indexOf('>', start)
  const end = html.indexOf('</script>', open)
  const meta = JSON.parse(html.slice(open + 1, end)) as {
    mode: 'gzip' | 'plain'
    payload: string
  }
  if (meta.mode === 'plain') return JSON.parse(meta.payload)
  return JSON.parse(
    Buffer.from(Bun.gunzipSync(Buffer.from(meta.payload, 'base64'))).toString(
      'utf8',
    ),
  ) as Record<string, unknown>
}

export function makeParams(inputValue = '/graph refresh'): RouterParams {
  return {
    inputRef: { current: null },
    setMessages: mock(
      (update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
        renderedMessages =
          typeof update === 'function' ? update(renderedMessages) : update
        messageSnapshots.push([...renderedMessages])
      },
    ),
    saveToHistory: mock(() => {}),
    setInputValue: mock(() => {}),
    setInputFocused: mock(() => {}),
    setIsAuthenticated: mock(() => {}),
    setUser: mock(() => {}),
    addToQueue: mock(() => {}),
    clearMessages: mock(() => {}),
    scrollToLatest: mock(() => {}),
    sendMessage: mock(async () => {}),
    setCanProcessQueue: mock(() => {}),
    setStreamStatus: mock(() => {}),
    inputValue,
    agentMode: 'HYBRID',
    isChainInProgressRef: { current: false },
    isStreaming: false,
    streamMessageIdRef: { current: null },
    abortControllerRef: { current: null },
    logoutMutation: {} as RouterParams['logoutMutation'],
  } as unknown as RouterParams
}

/** Build a tiny real graph index in tempDir (src/a.ts imports src/b.ts). */
export async function buildGraphFixture() {
  fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true })
  fs.writeFileSync(
    path.join(tempDir, 'src/a.ts'),
    "import { b } from './b'\nclass A { call() { return b() } }\n",
  )
  fs.writeFileSync(path.join(tempDir, 'src/b.ts'), 'export function b() {}\n')
  const db = openGraphDatabase(tempDir)
  try {
    return await updateKnowledgeGraph({
      projectRoot: tempDir,
      db,
      fullRebuild: true,
    })
  } finally {
    db.close()
  }
}

/**
 * Build a multi-directory fixture (src/ + lib/) so folder derivation emits
 * drill-down containers (a single src/ bucket degenerates and the cluster
 * fallback would otherwise be needed).
 */
export async function buildMultiDirFixture() {
  fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true })
  fs.mkdirSync(path.join(tempDir, 'lib'), { recursive: true })
  fs.writeFileSync(path.join(tempDir, 'src/a.ts'), 'export function a() {}\n')
  fs.writeFileSync(
    path.join(tempDir, 'src/b.ts'),
    "import { a } from './a'\nexport const b = a()\n",
  )
  fs.writeFileSync(path.join(tempDir, 'lib/c.ts'), 'export const c = 1\n')
  fs.writeFileSync(
    path.join(tempDir, 'lib/d.ts'),
    "import { c } from './c'\nexport const d = c\n",
  )
  const db = openGraphDatabase(tempDir)
  try {
    return await updateKnowledgeGraph({
      projectRoot: tempDir,
      db,
      fullRebuild: true,
    })
  } finally {
    db.close()
  }
}
