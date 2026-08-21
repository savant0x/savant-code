import { spawnSync } from 'child_process'
import * as os from 'os'

import type { ChildProcess } from 'child_process'

// Grace period between SIGTERM and SIGKILL for commands that trap or ignore
// SIGTERM.
export const KILL_ESCALATION_MS = 1500

export function killProcessGroup(child: ChildProcess, signal: NodeJS.Signals) {
  if (os.platform() === 'win32' && child.pid) {
    // Node's child.kill() only terminates the direct process on Windows. Since
    // the direct process is Git Bash, killing it first can orphan Bun/Node
    // grandchildren before the later SIGKILL escalation has a tree to find.
    // taskkill snapshots and force-terminates the complete descendant tree.
    const result = spawnSync(
      'taskkill.exe',
      ['/pid', String(child.pid), '/t', '/f'],
      {
        stdio: 'ignore',
        windowsHide: true,
        timeout: 5_000,
      },
    )
    if (!result.error && result.status === 0) return
  }

  if (os.platform() !== 'win32' && child.pid) {
    try {
      // Negative pid signals the whole process group.
      process.kill(-child.pid, signal)
      return
    } catch {
      // Process group may already be gone; fall back to a direct kill.
    }
  }
  try {
    child.kill(signal)
  } catch {}
}

export function isProcessGroupAlive(child: ChildProcess): boolean {
  if (os.platform() === 'win32' || !child.pid) {
    return child.exitCode === null && child.signalCode === null
  }
  try {
    // Signal 0 checks for any remaining member without changing its state.
    process.kill(-child.pid, 0)
    return true
  } catch {
    return false
  }
}

// Children are spawned detached on POSIX (own process group) so that abort and
// timeout can kill the whole tree. That also detaches them from this process's
// lifetime, so sweep any still-running children when this process exits.
const liveChildren = new Set<ChildProcess>()
let exitSweepInstalled = false

export type ActiveTerminalCommandProcess = {
  pid: number
  processGroupId?: number
}

/**
 * Return the process IDs owned by in-flight terminal tools. Commands are
 * started in their own process group on POSIX, where the group ID matches the
 * child PID. No command text or environment is exposed: diagnostics are often
 * pasted into bug reports and those values may contain secrets.
 */
export function getActiveTerminalCommandProcesses(): ActiveTerminalCommandProcess[] {
  return Array.from(liveChildren).flatMap((child) => {
    if (!child.pid) return []
    return [
      {
        pid: child.pid,
        ...(os.platform() === 'win32' ? {} : { processGroupId: child.pid }),
      },
    ]
  })
}

export function registerLiveChild(child: ChildProcess): void {
  liveChildren.add(child)
  installExitSweep()
}

export function unregisterLiveChild(child: ChildProcess): void {
  liveChildren.delete(child)
}

function installExitSweep() {
  if (exitSweepInstalled) return
  exitSweepInstalled = true
  process.on('exit', () => {
    for (const child of liveChildren) {
      killProcessGroup(child, 'SIGKILL')
    }
  })
}
