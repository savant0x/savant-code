// Shared core for the CLI release command flow. Pure logic with no UI
// dependencies so both the interactive `/release` slash command and the
// standalone `savant-code release <op>` subcommand run the exact same
// operations against the canonical `scripts/public-release.ts` engine.
//
// The release script is never imported here (the CLI workspace does not depend
// on root `scripts/`); it is spawned so the pinned-Bun self-bootstrap inside
// `scripts/public-release.ts` applies unchanged. Only the ops, flag mapping,
// repo-root resolution, process streaming, and status exports live here.

import { spawn } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

export { getReleaseStatus, latestReleaseEvidence } from './release-status'
export type {
  ReleaseReceiptSummary,
  ReleaseStatusOptions,
} from './release-status'

export const RELEASE_SCRIPT_RELATIVE = 'scripts/public-release.ts'

export const RELEASE_COMMAND_PREVIEW = 'preview'
export const RELEASE_COMMAND_DIAGNOSE = 'diagnose'
export const RELEASE_COMMAND_GO = 'go'
export const RELEASE_COMMAND_RESUME = 'resume'
export const RELEASE_COMMAND_STATUS = 'status'

export type ReleaseCommand =
  | typeof RELEASE_COMMAND_PREVIEW
  | typeof RELEASE_COMMAND_DIAGNOSE
  | typeof RELEASE_COMMAND_GO
  | typeof RELEASE_COMMAND_RESUME
  | typeof RELEASE_COMMAND_STATUS

/**
 * Normalizes free-text operation names into the canonical set. `go`, `release`,
 * and `run` are synonyms for the full release transaction; `diagnostic` is an
 * alias for `diagnose`; `continue` for `resume`; `check`/`state` for `status`.
 * Returns `undefined` for anything unrecognized (callers show usage).
 */
export function normalizeReleaseCommand(
  value: string | undefined | null,
): ReleaseCommand | undefined {
  const trimmed = (value ?? '').trim().toLowerCase()
  if (trimmed === RELEASE_COMMAND_PREVIEW) return RELEASE_COMMAND_PREVIEW
  if (
    trimmed === RELEASE_COMMAND_DIAGNOSE ||
    trimmed === 'diagnostic' ||
    trimmed === 'gates'
  ) {
    return RELEASE_COMMAND_DIAGNOSE
  }
  if (trimmed === 'go' || trimmed === 'release' || trimmed === 'run') {
    return RELEASE_COMMAND_GO
  }
  if (trimmed === RELEASE_COMMAND_RESUME || trimmed === 'continue') {
    return RELEASE_COMMAND_RESUME
  }
  if (
    trimmed === RELEASE_COMMAND_STATUS ||
    trimmed === 'check' ||
    trimmed === 'state'
  ) {
    return RELEASE_COMMAND_STATUS
  }
  return undefined
}

/** The `scripts/public-release.ts` flags for each operation (empty = full run). */
export function releaseScriptFlags(command: ReleaseCommand): string[] {
  switch (command) {
    case RELEASE_COMMAND_PREVIEW:
      return ['--preview']
    case RELEASE_COMMAND_DIAGNOSE:
      return ['--diagnose']
    case RELEASE_COMMAND_RESUME:
      return ['--resume']
    case RELEASE_COMMAND_GO:
    case RELEASE_COMMAND_STATUS:
      return []
  }
}

/** Human-readable command for display in the chat UI and console. */
export function buildReleaseCommandLine(command: ReleaseCommand): string {
  const flags = releaseScriptFlags(command)
  return `bun run ${RELEASE_SCRIPT_RELATIVE}${flags.length > 0 ? ` ${flags.join(' ')}` : ''}`
}

/**
 * Walks up from `start` until a directory containing `scripts/public-release.ts`
 * is found (the monorepo root). Returns `undefined` outside the repository.
 */
export function resolveReleaseRoot(start: string): string | undefined {
  let dir = path.resolve(start)
  for (;;) {
    if (existsSync(path.join(dir, RELEASE_SCRIPT_RELATIVE))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

export type ReleaseProcessOutput = {
  command: string
  root: string
  exitCode: number
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
}

export type ReleaseSpawnOptions = {
  root: string
  /** Display command line (e.g. `bun run scripts/public-release.ts --preview`). */
  command: string
  flags?: string[]
  /** Called with every stdout/stderr chunk as it arrives (streaming). */
  onOutput?: (chunk: string, stream: 'stdout' | 'stderr') => void
}

/**
 * Spawns the release engine under the current Bun runtime with cwd = repo root,
 * so the script's own pinned-Bun self-bootstrap and cwd-relative git/package
 * resolution behave exactly as they do under `bun run scripts/public-release.ts`.
 */
export function spawnReleaseScript(
  options: ReleaseSpawnOptions,
): Promise<ReleaseProcessOutput> {
  const { root, command, flags = [], onOutput } = options
  const scriptPath = path.join(root, RELEASE_SCRIPT_RELATIVE)
  const args = [scriptPath, ...flags]
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== undefined),
  ) as Record<string, string>
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    const child = spawn(process.execPath, args, {
      cwd: root,
      windowsHide: true,
      env,
    })
    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      stdout += text
      onOutput?.(text, 'stdout')
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      stderr += text
      onOutput?.(text, 'stderr')
    })
    child.on('error', reject)
    child.on('close', (code, signal) => {
      resolve({
        command,
        root,
        exitCode: code ?? 1,
        signal,
        stdout,
        stderr,
      })
    })
  })
}
