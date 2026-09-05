// FID-2026-0905-007 — public-release decomposition: pinned Bun runtime.
//
// Pinned-Bun candidate resolution and PATH promotion so every release spawn
// honors `.bun-version` (fails closed with install guidance). Verbatim moves
// from scripts/public-release.ts.

import { existsSync } from 'fs'
import os from 'os'
import path from 'path'

import { run } from './command-runner'
import { REQUIRED_BUN_VERSION, REQUIRED_NPM_MAJOR, fail } from './fail'

/**
 * Candidate locations for the pinned Bun install, most specific first. The
 * first candidate is the out-of-band version-pinned install used when the
 * globally installed Bun predates `.bun-version`; the second is the standard
 * Bun installer location. Each candidate is version-verified before use.
 */
export function pinnedBunCandidates(home = os.homedir()): string[] {
  const executable = process.platform === 'win32' ? 'bun.exe' : 'bun'
  return [
    path.join(home, `.bun-${REQUIRED_BUN_VERSION}`, 'bin', executable),
    path.join(home, '.bun', 'bin', executable),
  ]
}

/**
 * Returns the first candidate that exists and reports exactly the required
 * Bun version, or undefined when no pinned install is present. A candidate
 * that exists but reports a different version is skipped so a stale install
 * never passes the version gate.
 */
export function resolvePinnedBun(
  root: string,
  home = os.homedir(),
): string | undefined {
  for (const candidate of pinnedBunCandidates(home)) {
    if (!existsSync(candidate)) continue
    const probe = run(candidate, ['--version'], root, true)
    if (probe.status === 0 && probe.stdout.trim() === REQUIRED_BUN_VERSION) {
      return candidate
    }
  }
  return undefined
}

/**
 * Makes the pinned Bun the effective runtime for this process. If the `bun`
 * on PATH already satisfies `.bun-version` this is a no-op; otherwise the
 * pinned install's bin directory is prepended to `process.env.PATH` so every
 * subsequent `bun`/`bunx` spawn (gate specs, version checks) resolves to the
 * required version. Fails closed with install guidance when no pinned install
 * can be found, so daily pushes never depend on a hand-tuned shell PATH.
 */
export function ensurePinnedBunOnPath(root: string, home = os.homedir()): void {
  const current = run('bun', ['--version'], root, true)
  if (current.status === 0 && current.stdout.trim() === REQUIRED_BUN_VERSION) {
    return
  }
  const pinned = resolvePinnedBun(root, home)
  if (!pinned) {
    const found = current.status === 0 ? current.stdout.trim() : 'unavailable'
    fail(
      `Release requires Bun ${REQUIRED_BUN_VERSION} but 'bun' resolves to ${found} and no pinned install was found at ${pinnedBunCandidates(home).join(' or ')}. Install Bun ${REQUIRED_BUN_VERSION} or add it to PATH.`,
    )
  }
  const pinnedDir = path.dirname(pinned)
  const existing = process.env.PATH ?? ''
  process.env.PATH = existing
    ? `${pinnedDir}${path.delimiter}${existing}`
    : pinnedDir
}

export function validateToolVersions(
  bunVersion: string,
  npmVersion: string,
): void {
  if (bunVersion !== REQUIRED_BUN_VERSION) {
    fail(`Release requires Bun ${REQUIRED_BUN_VERSION}; found ${bunVersion}.`)
  }
  const npmMajor = Number.parseInt(npmVersion.split('.')[0] ?? '', 10)
  if (npmMajor !== REQUIRED_NPM_MAJOR) {
    fail(`Release requires npm ${REQUIRED_NPM_MAJOR}.x; found ${npmVersion}.`)
  }
}
