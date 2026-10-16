import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { expect, test } from 'bun:test'

import { runTerminalCommand } from '../tools/run-terminal-command'

test('immediate cancellation cannot leave a marker-writing descendant running', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'early-abort-'))
  const marker = path.join(root, 'pid.txt')
  const script = `require('fs').writeFileSync(${JSON.stringify(marker)},String(process.pid));setInterval(()=>{},1000)`
  const controller = new AbortController()
  let leakedPid: number | undefined
  try {
    const run = runTerminalCommand({
      command: `bun -e '${script.replaceAll("'", "'\\''")}'`,
      process_type: 'SYNC',
      cwd: process.cwd(),
      timeout_seconds: 10,
      signal: controller.signal,
    })
    controller.abort()
    await run
    await new Promise((resolve) => setTimeout(resolve, 2000))
    if (existsSync(marker)) {
      const pid = Number(readFileSync(marker, 'utf8'))
      try {
        process.kill(pid, 0)
        leakedPid = pid
      } catch {
        /* exited */
      }
    }
    expect(leakedPid).toBeUndefined()
  } finally {
    if (leakedPid !== undefined) process.kill(leakedPid)
    rmSync(root, { recursive: true, force: true })
  }
}, 15000)
