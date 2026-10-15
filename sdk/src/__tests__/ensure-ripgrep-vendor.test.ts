/**
 * FID-2026-0918-007 part 3 — install-time vendored-ripgrep guarantee.
 *
 * `sdk/scripts/ensure-ripgrep-vendor.ts` runs from the root `prepare` hook
 * after every `bun install`. Contract pinned here:
 *
 *   1. It is BEST-EFFORT and FAIL-OPEN: exit 0 in every scenario — present,
 *      missing-then-fetched, or fetch-failed — so an install can never break
 *      (offline machines use SAVANT_CODE_SKIP_RG_FETCH=1).
 *   2. The skip env is honored before anything else.
 *   3. The current platform always has a vendored manifest target, so the
 *      presence short-circuit is meaningful on every supported platform.
 *
 * The "present" assertion is conditional on actual disk state (checked via
 * the same vendor manifest the script uses), keeping the suite deterministic
 * on machines with and without the vendored binary.
 */
import { existsSync } from 'fs'
import { spawnSync } from 'node:child_process'
import { join } from 'path'

import { describe, expect, it } from 'bun:test'

import { vendorBinaryPath } from '../../scripts/vendor-manifest'
import { PLATFORM_TARGETS } from '../native/platform-targets'

const SCRIPT = join(
  import.meta.dir,
  '..',
  '..',
  'scripts',
  'ensure-ripgrep-vendor.ts',
)
const SDK_ROOT = join(import.meta.dir, '..', '..')

function runScript(env: Record<string, string>): {
  status: number | null
  stdout: string
  stderr: string
} {
  // Absolute runtime path, never a bare `'bun'` — the bare name is
  // PATH-resolvable only in a dev shell and ENOENTs under the release
  // gate's sanitized spawn environment (v0.0.30 incident; enforced by
  // `audit.gate-env-parity`, FID-2026-0919-022).
  const spawned = spawnSync(process.execPath, [SCRIPT], {
    cwd: SDK_ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  return {
    status: spawned.status,
    stdout: spawned.stdout ?? '',
    stderr: spawned.stderr ?? '',
  }
}

function currentPlatformBinaryPresent(): boolean {
  const runtimeDir =
    process.platform === 'win32'
      ? 'win32'
      : process.platform === 'darwin'
        ? 'darwin'
        : 'linux'
  const runtimeArch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const target = PLATFORM_TARGETS.find(
    (candidate) => candidate.platformDir === `${runtimeArch}-${runtimeDir}`,
  )
  if (!target) return false
  const devTree = vendorBinaryPath(join(SDK_ROOT, 'vendor', 'ripgrep'), target)
  if (existsSync(devTree)) return true
  const dist = join(
    SDK_ROOT,
    '..',
    'node_modules',
    '@savant-code',
    'sdk',
    'dist',
    'vendor',
    'ripgrep',
  )
  return existsSync(vendorBinaryPath(dist, target))
}

describe('ensure-ripgrep-vendor (FID-2026-0918-007 part 3)', () => {
  it('honors SAVANT_CODE_SKIP_RG_FETCH=1 and exits 0', () => {
    const { status, stdout } = runScript({ SAVANT_CODE_SKIP_RG_FETCH: '1' })
    expect(status).toBe(0)
    expect(stdout).toContain('skipping vendored ripgrep fetch')
  })

  it('exits 0 in every vendor state (fail-open install hook)', () => {
    const { status } = runScript({})
    expect(status).toBe(0)
  })

  it('short-circuits with the present-binary message when the binary exists', () => {
    if (!currentPlatformBinaryPresent()) {
      // On a vendor-less machine the script takes the fetch/warn path —
      // covered by the exit-0 contract above; the message is not asserted.
      return
    }
    const { status, stdout } = runScript({})
    expect(status).toBe(0)
    expect(stdout).toContain('nothing to do')
  })

  it('resolves a vendored manifest target for the running platform', () => {
    const runtimeDir =
      process.platform === 'win32'
        ? 'win32'
        : process.platform === 'darwin'
          ? 'darwin'
          : 'linux'
    const runtimeArch = process.arch === 'arm64' ? 'arm64' : 'x64'
    const target = PLATFORM_TARGETS.find(
      (candidate) => candidate.platformDir === `${runtimeArch}-${runtimeDir}`,
    )
    expect(target).toBeDefined()
  })
})
