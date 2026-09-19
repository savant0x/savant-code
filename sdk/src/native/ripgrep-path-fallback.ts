/**
 * @module native/ripgrep-path-fallback
 *
 * FID-2026-0918-007: PATH-fallback candidate for the ripgrep resolver,
 * extracted under the 300-line ceiling (FID-2026-0913-002 split
 * discipline). When every vendored candidate misses — the fresh-install
 * state, since nothing in `bun install` guarantees the vendor tree — an
 * `rg` on PATH resolves instead of hard-failing. The vendored candidates
 * keep priority: the pinned binary is the supported configuration.
 */

import { spawnSync as nodeSpawnSync } from 'node:child_process'

/**
 * Probe result cache. Memoized per process: the PATH rarely changes
 * mid-session, and re-spawning `where`/`which` on every failed vendored
 * lookup would add latency for no change in outcome. `null` =
 * uninitialized; `undefined` = cached miss.
 */
let cachedPathRg: string | undefined | null = null

/** Spawn a locator command and return its first non-empty stdout line.
 * `node:child_process` (not Bun's spawnSync) so the SDK keeps its Node
 * compatibility contract — executor.ts sets the same precedent. */
function defaultPathProbe(command: string[]): string | undefined {
  try {
    const spawned = nodeSpawnSync(command[0], command.slice(1), {
      encoding: 'utf8',
    })
    if (spawned.status !== 0) return undefined
    const first = (spawned.stdout ?? '')
      .split(/\r?\n/)
      .find((line) => line.trim().length > 0)
    const candidate = first?.trim()
    return candidate !== undefined && candidate.length > 0
      ? candidate
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Resolve an `rg` binary from PATH as the final resolver candidate.
 * Windows probes `where rg`, everything else `which rg` (both spawnSync,
 * no shell). Memoized per process; a miss is cached too. The probe is
 * injectable so tests stay deterministic on machines that DO have ripgrep
 * on PATH.
 */
export function resolveRgFromPath(
  binaryName?: string,
  probe: (command: string[]) => string | undefined = defaultPathProbe,
): string | undefined {
  if (cachedPathRg !== null) return cachedPathRg
  const name = binaryName ?? (process.platform === 'win32' ? 'rg.exe' : 'rg')
  cachedPathRg = locateOnPath(name, probe)
  return cachedPathRg
}

function locateOnPath(
  name: string,
  probe: (command: string[]) => string | undefined,
): string | undefined {
  if (process.platform === 'win32') return probe(['where', name])
  return probe(['which', name])
}

/** Test hook: clear the memoized PATH-probe result. */
export function resetPathRgCacheForTests(): void {
  cachedPathRg = null
}
