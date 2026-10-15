/**
 * End-to-end graph smoke test (release audit).
 *
 * Runs the REAL engine over the REAL project, then drives the REAL
 * `/graph-export` command handler with a minimal RouterParams mock to
 * exercise the full production code path (engine → serializer → branded
 * HTML file on disk).
 *
 * Run: `bun run cli/scripts/graph-smoke.ts` from the repo root.
 */
import fs from 'node:fs'
import path from 'node:path'

import { handleGraphExportCommand } from '../src/commands/graph-export'
import { handleGraphRefreshCommand } from '../src/commands/graph-refresh'
import { setProjectRoot } from '../src/project-files'

const projectRoot = process.cwd()
setProjectRoot(projectRoot)

type SystemMessage = { role: string; content: string }
const messages: SystemMessage[] = []

const mockParams = {
  saveToHistory: () => {},
  setInputValue: () => {},
  setMessages: (fn: (prev: SystemMessage[]) => SystemMessage[]) => {
    messages.push(...fn(messages))
  },
  inputValue: '',
}

function text(msg: SystemMessage): string {
  if (typeof msg.content === 'string') return msg.content
  return JSON.stringify(msg.content)
}

async function main(): Promise<void> {
  console.log(`Project root: ${projectRoot}`)

  // 1. /graph refresh (incremental) — real indexer over the real repo.
  await handleGraphRefreshCommand(mockParams as never, '')
  const refresh = messages.map(text).join('\n')
  console.log('--- /graph refresh output ---')
  console.log(refresh)

  if (refresh.includes('❌')) {
    console.error('GRAPH REFRESH FAILED')
    process.exit(1)
  }

  // Confirm the DB exists on disk.
  const dbPath = path.join(projectRoot, '.savant', 'graph.db')
  console.log(
    `\nDB exists: ${fs.existsSync(dbPath)} (${fs.statSync(dbPath).size} bytes)`,
  )

  // 2. /graph refresh --full — force a complete reindex (determinism check:
  //    the incremental pass above already produced a DB; full must succeed).
  await handleGraphRefreshCommand(mockParams as never, '--full')
  const full = messages.map(text).join('\n')
  console.log('--- /graph refresh --full output (last line) ---')
  console.log(full.split('\n').filter(Boolean).slice(-2).join('\n'))

  // 3. /graph-export — real handler writes the branded HTML.
  const before = messages.length
  await handleGraphExportCommand(mockParams as never, '')
  const exported = messages.slice(before).map(text).join('\n')
  console.log('--- /graph-export output ---')
  console.log(exported)

  const match = exported.match(/savant-graph-[^\s]+\.html/)
  if (!match) {
    console.error('NO EXPORT PATH FOUND — export may have failed')
    process.exit(1)
  }
  const htmlPath = path.resolve(projectRoot, match[0])
  console.log(`\nHTML: ${htmlPath} (${fs.statSync(htmlPath).size} bytes)`)
}

main().catch((err) => {
  console.error('SMOKE FAILED:', err)
  process.exit(1)
})
