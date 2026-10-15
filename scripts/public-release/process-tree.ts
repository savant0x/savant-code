// FID-2026-0905-007 — public-release decomposition: process tree.
//
// Windows-only owned process-tree enumeration and safe termination for
// timed-out release commands. Verbatim moves from scripts/public-release.ts.

import { spawnSync } from 'child_process'

export function processTableRows(): Array<[number, number]> | undefined {
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Get-CimInstance Win32_Process | ForEach-Object { [pscustomobject]@{ pid = $_.ProcessId; ppid = $_.ParentProcessId } } | ConvertTo-Json -Compress',
    ],
    {
      encoding: 'utf8',
      stdio: 'pipe',
      windowsHide: true,
      timeout: 20_000,
      killSignal: 'SIGTERM',
      shell: false,
    },
  )
  if (result.status !== 0 || !result.stdout.trim()) return undefined
  try {
    const parsed: unknown = JSON.parse(result.stdout)
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    return rows
      .filter(
        (row): row is { pid?: unknown; ppid?: unknown } =>
          typeof row === 'object' &&
          row !== null &&
          'pid' in row &&
          'ppid' in row,
      )
      .map((row) => [Number(row.pid), Number(row.ppid)] as [number, number])
      .filter(
        (entry): entry is [number, number] =>
          Number.isInteger(entry[0]) && Number.isInteger(entry[1]),
      )
  } catch {
    return undefined
  }
}

/** Enumerate the full owned descendant tree of `pid` via parent-chain walk. */
export function enumerateProcessTree(pid: number): number[] {
  const children = new Map<number, number[]>()
  const rows = processTableRows()
  if (rows === undefined) return []
  for (const [childPid, parentPid] of rows) {
    const siblings = children.get(parentPid) ?? []
    siblings.push(childPid)
    children.set(parentPid, siblings)
  }
  const owned = new Set<number>([pid])
  const queue = [pid]
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    for (const child of children.get(current) ?? []) {
      if (!owned.has(child)) {
        owned.add(child)
        queue.push(child)
      }
    }
  }
  return [...owned].sort((left, right) => left - right)
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function killableOwnedSurvivors(
  rootPid: number,
  owned: readonly number[],
): number[] {
  const rows = processTableRows()
  if (rows === undefined) return []
  const alive = new Set(rows.map(([childPid]) => childPid))
  const parentOf = new Map(
    rows.map(([childPid, parentPid]) => [childPid, parentPid]),
  )
  const ownedSet = new Set(owned)
  const killable: number[] = []
  for (const entry of owned) {
    if (!alive.has(entry)) continue
    if (entry === rootPid) {
      killable.push(entry)
      continue
    }
    const parent = parentOf.get(entry)
    if (parent !== undefined && ownedSet.has(parent)) killable.push(entry)
  }
  return killable
}

export function terminateOwnedProcessTree(
  pid: number | undefined,
): string | undefined {
  if (!pid) return 'timed-out process did not expose an owned PID'
  if (process.platform !== 'win32') {
    return 'process-tree verification is only supported on Windows'
  }
  const owned = enumerateProcessTree(pid)
  if (owned.length === 0) {
    return 'owned process tree could not be enumerated for verification'
  }
  const terminated = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
    encoding: 'utf8',
    stdio: 'pipe',
    windowsHide: true,
    shell: false,
  })
  if (terminated.status !== 0) {
    return 'timed-out process tree could not be terminated safely'
  }
  let survivors = owned.filter((entry) => isProcessAlive(entry))
  if (survivors.length > 0) {
    // Kill stragglers only when a fresh process-table read confirms the PID is
    // still parented inside the owned tree; a PID reused by an unrelated
    // process (parent outside the owned set) is never terminated.
    for (const survivor of killableOwnedSurvivors(pid, owned)) {
      spawnSync('taskkill', ['/PID', String(survivor), '/T', '/F'], {
        encoding: 'utf8',
        stdio: 'pipe',
        windowsHide: true,
        shell: false,
      })
    }
    survivors = owned.filter((entry) => isProcessAlive(entry))
  }
  if (survivors.length > 0) {
    const bounded = survivors.slice(0, 20).join(', ')
    const suffix = survivors.length > 20 ? ', …' : ''
    return `owned timed-out processes remained after tree termination (${bounded}${suffix})`
  }
  return undefined
}
