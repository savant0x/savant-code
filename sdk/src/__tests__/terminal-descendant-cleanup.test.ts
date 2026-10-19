import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { expect, test } from 'bun:test'

import { runTerminalCommand } from '../tools/run-terminal-command'

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

for (const mode of ['abort', 'timeout'] as const) {
  test(`${mode} terminates a started descendant whose pipeline holds output open`, async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'started-descendant-'))
    const marker = path.join(root, 'pid.txt')
    const script = `let n=0;const beat=()=>require('fs').writeFileSync(${JSON.stringify(marker.replaceAll('\\', '/'))},process.pid+':'+n++);beat();setInterval(beat,50)`
    const executable = `'${process.execPath.replaceAll('\\', '/').replaceAll("'", "'\\''")}'`
    const controller = new AbortController()
    let descendant: number | undefined
    try {
      const settled = runTerminalCommand({
        command: `${executable} -e '${script.replaceAll("'", "'\\''")}' | ${executable} -e 'process.stdin.resume()'`,
        process_type: 'SYNC',
        cwd: process.cwd(),
        signal: controller.signal,
        timeout_seconds: mode === 'timeout' ? 5 : 10,
      }).then(
        (value) => ({ value, error: undefined }),
        (error: unknown) => ({ value: undefined, error }),
      )
      const startDeadline = Date.now() + 4000
      while (!existsSync(marker) && Date.now() < startDeadline) {
        await Bun.sleep(25)
      }
      if (!existsSync(marker)) {
        controller.abort()
        throw new Error(
          `Fixture did not start: ${JSON.stringify(await settled)}`,
        )
      }
      descendant = Number(readFileSync(marker, 'utf8').split(':')[0])
      expect(alive(descendant)).toBe(true)
      const startedBeat = readFileSync(marker, 'utf8')
      await Bun.sleep(150)
      expect(readFileSync(marker, 'utf8')).not.toBe(startedBeat)
      if (mode === 'abort') controller.abort()
      const result = await settled
      if (mode === 'timeout') expect(result.error).toBeInstanceOf(Error)
      else expect(JSON.stringify(result.value)).toContain('cancelled')
      const stopDeadline = Date.now() + 3000
      let lastBeat = readFileSync(marker, 'utf8')
      let unchangedSince = Date.now()
      while (Date.now() < stopDeadline && Date.now() - unchangedSince < 500) {
        await Bun.sleep(50)
        const beat = readFileSync(marker, 'utf8')
        if (beat !== lastBeat) {
          lastBeat = beat
          unchangedSince = Date.now()
        }
      }
      expect(Date.now() - unchangedSince).toBeGreaterThanOrEqual(500)
    } finally {
      controller.abort()
      if (descendant !== undefined && existsSync(marker)) {
        const before = readFileSync(marker, 'utf8')
        await Bun.sleep(150)
        if (readFileSync(marker, 'utf8') !== before) process.kill(descendant)
      }
      rmSync(root, { recursive: true, force: true })
    }
  }, 15000)
}
