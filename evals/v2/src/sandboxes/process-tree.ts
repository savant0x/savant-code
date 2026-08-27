import { spawn } from 'node:child_process'

/**
 * FID-2026-0824-015: process-tree teardown helpers for eval sandboxes.
 *
 * Capability probe, not environment-dependent guards: the platform decides
 * ONCE which teardown mechanism is available and every call dispatches on
 * that probe result.
 *   - win32 → `taskkill /PID <pid> /T /F` (walks the parent/child snapshot,
 *     reaping grandchildren a plain child.kill() orphans)
 *   - posix → detached spawn puts the child in its own process group; a
 *     negative-PID SIGKILL ends the whole group. Falls back to a direct
 *     single-process kill when the group edge is already gone.
 */

export type TeardownMechanism = 'taskkill-tree' | 'process-group' | 'single'

let cachedMechanism: TeardownMechanism | undefined

/** Probe (once) which tree-teardown mechanism this platform supports. */
export function probeTeardownMechanism(): TeardownMechanism {
  if (cachedMechanism !== undefined) {
    return cachedMechanism
  }
  cachedMechanism =
    process.platform === 'win32'
      ? 'taskkill-tree'
      : typeof process.kill === 'function'
        ? 'process-group'
        : 'single'
  return cachedMechanism
}

/**
 * Kill a process and its whole descendant tree.
 *
 * Idempotent: returns false when nothing was left to kill (already exited).
 * Never throws — best-effort by contract, so teardown cannot mask the
 * original failure with its own.
 */
export async function killProcessTree(pid: number): Promise<boolean> {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false
  }

  const mechanism = probeTeardownMechanism()

  if (mechanism === 'taskkill-tree') {
    const killed = await new Promise<boolean>((resolve) => {
      try {
        const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        })
        killer.on('close', (code) => resolve(code === 0))
        killer.on('error', () => resolve(false))
      } catch {
        resolve(false)
      }
    })
    if (killed) {
      return true
    }
    // taskkill missing or refused — fall through to the direct attempt.
  }

  if (mechanism === 'process-group') {
    try {
      process.kill(-pid, 'SIGKILL')
      return true
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ESRCH') {
        // Already gone — nothing was left to kill.
        return false
      }
      // EPERM or others: try the direct single-process edge below.
    }
  }

  try {
    process.kill(pid, 'SIGKILL')
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return code === 'ESRCH' ? false : false
  }
}
