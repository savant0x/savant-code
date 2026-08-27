#!/usr/bin/env bun
// FID-2026-0820-009 Step 2: emit Bun-compiled sidecar binaries renamed to the
// Rust target triple Tauri `externalBin` resolution expects
// ($NAME-$TAURI_ENV_TARGET_TRIPLE[.exe]). The gateway entrypoint itself lands
// with FID-2026-0820-008; this pipeline accepts it via --entry and never
// invents a default.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export interface SidecarTarget {
  readonly bun: string
  readonly rust: string
} // Frozen externalBin contract name (tauri.conf.json bundle.externalBin and
// the supervisor's resolve_sidecar_path both key on it).
const SIDECAR_BASE_NAME = 'savant-sidecar'

export const SIDECAR_TARGETS: readonly SidecarTarget[] = [
  { bun: 'bun-windows-x64', rust: 'x86_64-pc-windows-msvc' },
  { bun: 'bun-darwin-arm64', rust: 'aarch64-apple-darwin' },
  { bun: 'bun-linux-x64', rust: 'x86_64-unknown-linux-gnu' },
]

export interface SidecarBuildRequest {
  readonly entry: string
  readonly target: string
  readonly outDir: string
}

export interface ResolvedSidecarBuild extends SidecarBuildRequest {
  readonly rustTriple: string
  readonly outfile: string
}

function knownTargets(): string {
  return SIDECAR_TARGETS.map((candidate) => candidate.bun).join(', ')
}

export function sidecarBinaryName(
  baseName: string,
  rustTriple: string,
): string {
  if (baseName.trim().length === 0 || rustTriple.trim().length === 0) {
    throw new Error('sidecarBinaryName requires a base name and a Rust triple')
  }
  // Tauri resolves triple-suffixed filenames while Bun --compile appends its
  // own .exe on Windows targets — strip first so `.exe.exe` can never happen.
  const stripped = baseName.endsWith('.exe')
    ? baseName.slice(0, -'.exe'.length)
    : baseName
  const extension = rustTriple.includes('windows') ? '.exe' : ''
  return `${stripped}-${rustTriple}${extension}`
}

export function resolveSidecarBuild(
  request: SidecarBuildRequest,
): ResolvedSidecarBuild {
  const match = SIDECAR_TARGETS.find(
    (candidate) => candidate.bun === request.target,
  )
  if (!match) {
    throw new Error(
      `Unknown --target "${request.target}"; expected one of: ${knownTargets()}`,
    )
  } // The emitted name is contract-fixed, independent of the entry filename.
  return {
    ...request,
    rustTriple: match.rust,
    outfile: path.join(
      request.outDir,
      sidecarBinaryName(SIDECAR_BASE_NAME, match.rust),
    ),
  }
}

function readFlagValue(
  argv: readonly string[],
  index: number,
  flag: string,
): string {
  const value = argv[index + 1]
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`)
  }
  return value
}

export function parseSidecarBuildArgs(
  argv: readonly string[],
): SidecarBuildRequest {
  let entry: string | null = null
  let target: string | null = null
  let outDir: string | null = null

  for (let index = 0; index < argv.length; index += 1) {
    switch (argv[index]) {
      case '--entry': {
        entry = readFlagValue(argv, index, '--entry')
        index += 1
        break
      }
      case '--target': {
        target = readFlagValue(argv, index, '--target')
        index += 1
        break
      }
      case '--out-dir': {
        outDir = readFlagValue(argv, index, '--out-dir')
        index += 1
        break
      }
      default: {
        throw new Error(`Unexpected argument: ${String(argv[index])}`)
      }
    }
  }

  if (entry === null) {
    throw new Error(
      '--entry is required — the gateway entrypoint ships with FID-2026-0820-008',
    )
  }
  if (target === null) {
    throw new Error(`--target is required; expected one of: ${knownTargets()}`)
  }

  return {
    entry,
    target,
    outDir:
      outDir ?? path.resolve(import.meta.dir, '..', 'src-tauri', 'binaries'),
  }
}

export function runSidecarBuild(request: SidecarBuildRequest): number {
  let resolved: ResolvedSidecarBuild
  try {
    resolved = resolveSidecarBuild(request)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }

  if (!fs.existsSync(resolved.entry)) {
    console.error(`build-sidecar: entrypoint not found: ${resolved.entry}`)
    console.error(
      'The gateway entrypoint ships with FID-2026-0820-008; pass its path once it exists.',
    )
    return 1
  }

  fs.mkdirSync(resolved.outDir, { recursive: true })
  const result = spawnSync(
    'bun',
    [
      'build',
      resolved.entry,
      '--compile',
      '--target',
      resolved.target,
      '--outfile',
      resolved.outfile,
    ],
    { stdio: 'inherit' },
  )

  if (result.error !== undefined && result.error !== null) {
    console.error(
      `build-sidecar: failed to launch bun: ${String(result.error)}`,
    )
    return 1
  }
  if (result.status !== 0) {
    console.error(`build-sidecar: bun build exited ${String(result.status)}`)
    return result.status ?? 1
  }
  if (!fs.existsSync(resolved.outfile)) {
    console.error(`build-sidecar: expected output missing: ${resolved.outfile}`)
    return 1
  }

  console.log(`build-sidecar: wrote ${resolved.outfile}`)
  return 0
}

if (import.meta.main) {
  process.exitCode = runSidecarBuild(
    parseSidecarBuildArgs(process.argv.slice(2)),
  )
}
