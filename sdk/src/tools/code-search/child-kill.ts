/**
 * Escalating kill for a spawned search child: `SIGTERM` first, then
 * `SIGKILL` after a one-second grace period, then the unconditional
 * fallback kill. Extracted verbatim from `executor.ts` (quality ceiling,
 * FID-2026-1004-006) — behavior contract unchanged.
 */

import type { ChildProcess } from 'child_process'

export interface EscalatingKill {
  /** SIGTERM now; escalate to SIGKILL after the grace period. */
  terminate: () => void
  /** Cancel any pending escalation (the child already exited). */
  dispose: () => void
}

export function createEscalatingKill(
  childProcess: ChildProcess,
): EscalatingKill {
  let killTimeoutId: ReturnType<typeof setTimeout> | null = null

  const terminate = () => {
    try {
      childProcess.kill('SIGTERM')
    } catch {
      // Best-effort kill: an already-exited child is the expected outcome.
    }
    // Store the timeout reference so it can be disposed if the process
    // closes normally before escalation fires.
    killTimeoutId = setTimeout(() => {
      try {
        childProcess.kill('SIGKILL')
      } catch {
        // Best-effort escalation: the process may have exited between
        // signals — the fallback kill below shares that contract.
        try {
          childProcess.kill()
        } catch {
          // Same best-effort contract; nothing actionable remains.
        }
      }
      killTimeoutId = null
    }, 1000)
  }

  const dispose = () => {
    if (killTimeoutId) {
      clearTimeout(killTimeoutId)
      killTimeoutId = null
    }
  }

  return { terminate, dispose }
}
