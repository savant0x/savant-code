// Windows-only integration test for owned process-tree cleanup.
// Excluded from the default `bun test` run by `**/*.integration.test.*` in
// bunfig.toml. Run explicitly with:
//   NODE_ENV=test bun test scripts/process-tree.integration.test.ts

import { spawn } from 'child_process'

import { describe, expect, test } from 'bun:test'

import {
  enumerateProcessTree,
  terminateOwnedProcessTree,
} from './public-release'

function isGone(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return false
  } catch {
    return true
  }
}

describe('process-tree cleanup integration', () => {
  test('terminates the full owned descendant tree and verifies every PID exits', () => {
    if (process.platform !== 'win32') {
      // Documented narrower contract: full-tree verification is Windows-only.
      return
    }
    const fixture = spawn(
      process.execPath,
      [
        '-e',
        `
        import { spawn } from 'child_process'
        const kids = [0, 1, 2].map(() =>
          spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], {
            stdio: 'ignore',
          }),
        )
        console.log(JSON.stringify({ me: process.pid, kids: kids.map((k) => k.pid) }))
        setTimeout(() => {}, 60000)
      `,
      ],
      { stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true },
    )
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('fixture did not report its PIDs in time')),
        15_000,
      )
      let buffer = ''
      const finish = (error?: Error): void => {
        clearTimeout(timer)
        try {
          if (fixture.pid) terminateOwnedProcessTree(fixture.pid)
        } catch {
          // best-effort cleanup only
        }
        if (error) reject(error)
        else resolve()
      }
      fixture.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const lineEnd = buffer.indexOf('\n')
        if (lineEnd === -1) return
        const line = buffer.slice(0, lineEnd)
        let reported: { me: number; kids: number[] }
        try {
          reported = JSON.parse(line) as { me: number; kids: number[] }
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)))
          return
        }
        try {
          expect(reported.me).toBeGreaterThan(0)
          expect(reported.kids).toHaveLength(3)
          const owned = enumerateProcessTree(reported.me)
          expect(owned).toContain(reported.me)
          for (const kid of reported.kids) expect(owned).toContain(kid)
          const failure = terminateOwnedProcessTree(reported.me)
          expect(failure).toBeUndefined()
          for (const pid of owned) expect(isGone(pid)).toBe(true)
          finish()
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)))
        }
      })
      fixture.stdout.on('error', (error) => finish(error))
      fixture.on('error', (error) => finish(error))
    })
  }, 30_000)
})
