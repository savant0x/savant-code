import {
  CommandTimeoutError,
  SESSION_INIT_TIMEOUT_MS,
  validateSessionInitBounds,
} from '@savant-code/common/util/command-execution'

import type { SavantCodeSpawn } from '@savant-code/common/types/spawn'

/** Max time (ms) a session-init child process (e.g. git) may run. */
export const CHILD_PROCESS_TIMEOUT_MS = SESSION_INIT_TIMEOUT_MS
/** Max accumulated stdout/stderr kept for session-init commands. */
export const CHILD_PROCESS_MAX_BUFFER_BYTES = 5_000_000

/**
 * Helper to convert ChildProcess to Promise with stdout/stderr
 *
 * Bounded in time and memory (FID-2026-0802-008 T1): a hung git process must
 * not block session init forever, and a giant diff must not accumulate
 * unbounded. On timeout the child is killed best-effort and the promise
 * rejects (getGitChanges converts that to an empty string).
 */
export function childProcessToPromise(
  proc: ReturnType<SavantCodeSpawn>,
  timeoutMs: number = CHILD_PROCESS_TIMEOUT_MS,
  maxBufferBytes: number = CHILD_PROCESS_MAX_BUFFER_BYTES,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    validateSessionInitBounds(timeoutMs, maxBufferBytes)
    let stdout = ''
    let stderr = ''
    let settled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      if (timer !== null) clearTimeout(timer)
      fn()
    }

    timer = setTimeout(() => {
      settled = true
      try {
        if (typeof proc.kill !== 'function' || !proc.kill()) {
          reject(
            new CommandTimeoutError(
              timeoutMs / 1000,
              'session-init',
              proc.pid !== undefined,
              'unavailable',
            ),
          )
          return
        }
      } catch (error) {
        reject(
          new Error(
            'Session-init command timed out; its termination request failed.',
            { cause: error },
          ),
        )
        return
      }
      reject(
        new CommandTimeoutError(
          timeoutMs / 1000,
          'session-init',
          proc.pid !== undefined,
        ),
      )
    }, timeoutMs)

    proc.stdout?.on('data', (data: Buffer) => {
      const remaining = maxBufferBytes - stdout.length
      if (remaining > 0) {
        stdout += data.toString().slice(0, remaining)
      }
    })

    proc.stderr?.on('data', (data: Buffer) => {
      const remaining = maxBufferBytes - stderr.length
      if (remaining > 0) {
        stderr += data.toString().slice(0, remaining)
      }
    })

    proc.on('close', (code: number | null) => {
      settle(() => {
        if (code === 0) {
          resolve({ stdout, stderr })
        } else {
          reject(new Error(`Command exited with code ${code}`))
        }
      })
    })

    proc.on('error', (error) => {
      settle(() => reject(error))
    })
  })
}
