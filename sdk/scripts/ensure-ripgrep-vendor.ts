#!/usr/bin/env bun
/**
 * Install-time vendored-ripgrep guarantee (FID-2026-0918-007 part 3,
 * operator-approved 2026-09-19).
 *
 * Wired into the root `prepare` script (bun runs `prepare` after every
 * `bun install` — exactly the fresh-clone / node_modules-recreation window
 * where the 13 recorded code_search ENOENT recurrences happened). Best-effort
 * and fail-open: a developer machine must never get a broken install from
 * this step. Skips entirely when:
 *   - the current platform's binary already exists (dev tree
 *     sdk/vendor/ripgrep/<dir>/<bin> or installed dist
 *     node_modules/@savant-code/sdk/dist/vendor/ripgrep/<dir>/<bin>), or
 *   - SAVANT_CODE_SKIP_RG_FETCH=1 is set (air-gapped / offline / CI mirrors),
 *   - the sdk workspace layout cannot be located.
 *
 * When it does run, it reuses the pinned, checksum-verified fetch
 * (sdk/scripts/fetch-ripgrep.ts, FID-2026-0821-005 B2) so every downloaded
 * binary is verified against PINNED_RIPGREP_SHA256 before it lands.
 * On any failure: warn to stderr, exit 0. The runtime PATH fallback
 * (sdk/src/native/ripgrep-path-fallback.ts) and the resolver's remediation
 * error remain the backstops.
 */
import { existsSync } from 'fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

import { vendorBinaryPath } from './vendor-manifest'
import { PLATFORM_TARGETS } from '../src/native/platform-targets'

const SKIP_ENV = 'SAVANT_CODE_SKIP_RG_FETCH'

function repoRoot(): string {
  // <repo>/sdk/scripts/ensure-ripgrep-vendor.ts
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
}

function currentTarget(): (typeof PLATFORM_TARGETS)[number] | undefined {
  return PLATFORM_TARGETS.find((target) => {
    const runtimeDir =
      process.platform === 'win32'
        ? 'win32'
        : process.platform === 'darwin'
          ? 'darwin'
          : 'linux'
    const runtimeArch = process.arch === 'arm64' ? 'arm64' : 'x64'
    return (
      target.platformDir === `${runtimeArch}-${runtimeDir}` &&
      (process.platform !== 'win32' || target.binaryName.endsWith('.exe'))
    )
  })
}

function sdkVendorDir(): string {
  return join(repoRoot(), 'sdk', 'vendor', 'ripgrep')
}

function installedDistVendorDir(): string | undefined {
  const candidate = join(
    repoRoot(),
    'node_modules',
    '@savant-code',
    'sdk',
    'dist',
    'vendor',
    'ripgrep',
  )
  return existsSync(join(candidate, '..')) ? candidate : undefined
}

function binaryPresent(): boolean {
  const target = currentTarget()
  if (!target) return false
  if (existsSync(vendorBinaryPath(sdkVendorDir(), target))) return true
  const dist = installedDistVendorDir()
  if (dist && existsSync(vendorBinaryPath(dist, target))) return true
  return false
}

function warn(message: string): void {
  console.warn(`[ensure-ripgrep-vendor] ${message}`)
}

async function main(): Promise<void> {
  if (process.env[SKIP_ENV] === '1') {
    console.log(
      `[ensure-ripgrep-vendor] ${SKIP_ENV}=1 — skipping vendored ripgrep fetch.`,
    )
    return
  }

  const target = currentTarget()
  if (!target) {
    warn(
      `no vendored platform target for ${process.platform}-${process.arch}; skipping (PATH fallback applies at runtime).`,
    )
    return
  }

  if (binaryPresent()) {
    console.log(
      `[ensure-ripgrep-vendor] ${target.platformDir} binary present — nothing to do.`,
    )
    return
  }

  warn(
    `vendored ripgrep missing for ${target.platformDir} — fetching the pinned binary ` +
      `(checksum-verified; skip with ${SKIP_ENV}=1).`,
  )

  const sdkDir = join(repoRoot(), 'sdk')
  // Spawn the running runtime by ABSOLUTE path: a bare `'bun'` resolves on
  // PATH only in a dev shell and dies with uv_spawn ENOENT under the release
  // gate's sanitized spawn environment (v0.0.30 incident; enforced by
  // `audit.gate-env-parity` in validate:repository, FID-2026-0919-022).
  const spawned = spawnSync(process.execPath, ['run', 'fetch-ripgrep'], {
    cwd: sdkDir,
    stdio: 'inherit',
  })
  if (spawned.error || spawned.status !== 0) {
    warn(
      `fetch failed (status ${String(spawned.status)}). Install stays green — ` +
        `code_search will fall back to an rg on PATH, or run ` +
        `'bun run --cwd=sdk fetch-ripgrep' manually.`,
    )
    return
  }

  console.log(
    `[ensure-ripgrep-vendor] vendored ripgrep ready for ${target.platformDir}.`,
  )
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    warn(
      `unexpected failure (${error instanceof Error ? error.message : String(error)}) — install stays green.`,
    )
    process.exit(0)
  })
}
