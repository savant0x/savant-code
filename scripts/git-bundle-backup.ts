#!/usr/bin/env bun
// FID-2026-0905-008 — git bundle backup (Rule G5 durability layer).
//
// Implements the operator-approved git-workflow research
// (docs/design/Solo Git Workflow Optimization.md) via
// BO-2026-08-23 FID 3: full bundle once (--baseline), then
// `last-backup..main` incrementals to a OneDrive-synced directory.
// Every bundle is `git bundle verify`-checked after creation; the
// `last-backup` marker tag advances ONLY on verified success
// (verify-or-no-advance, fail-closed).
//
// Restore drill (scratch clone):
//   git clone <baseline.bundle> restore/
//   cd restore && git fetch <incr-N>.bundle main:refs/remotes/backup/main
//   git bundle verify <each bundle>
//
// Usage:
//   bun scripts/git-bundle-backup.ts --baseline   # one-time full archive
//   bun scripts/git-bundle-backup.ts              # incremental since marker

import { spawnSync } from 'child_process'
import { mkdirSync, existsSync, readdirSync, statSync } from 'fs'
import path from 'path'

export const BACKUP_MARKER_TAG = 'last-backup'

/**
 * Destination for bundle archives. Override with SAVANT_BUNDLE_DIR
 * (BO Open Question 2: the operator confirms the OneDrive path); the
 * constant is a documented placeholder that keeps the script runnable
 * before that confirmation lands.
 */
export const SAVANT_BUNDLE_DIR_DEFAULT =
  'C:/Users/spenc/OneDrive/savant-backups'

export type BundleResult = {
  ok: boolean
  bundlePath?: string
  message: string
  files?: string[]
}

function git(
  args: string[],
  cwd: string,
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

function resolveBundleDir(explicit?: string): string {
  const dir =
    explicit ?? process.env.SAVANT_BUNDLE_DIR ?? SAVANT_BUNDLE_DIR_DEFAULT
  const resolved = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir)
  if (!existsSync(resolved)) {
    try {
      mkdirSync(resolved, { recursive: true })
    } catch (error) {
      throw new Error(
        `Bundle destination is not creatable: ${resolved} (${error instanceof Error ? error.message : String(error)})`,
      )
    }
  } else if (!statSync(resolved).isDirectory()) {
    throw new Error(`Bundle destination is not a directory: ${resolved}`)
  }
  return resolved
}

function assertMainBranch(cwd: string): void {
  const branch = git(['branch', '--show-current'], cwd)
  if (branch.status !== 0 || branch.stdout.trim() !== 'main') {
    throw new Error(
      `Bundle backup requires the main branch (found "${branch.stdout.trim() || 'detached'}"); refusing to run.`,
    )
  }
}

function markerTarget(cwd: string): string | undefined {
  const marker = git(['rev-parse', '--verify', `${BACKUP_MARKER_TAG}`], cwd)
  if (marker.status === 0) return marker.stdout.trim()
  return undefined
}

function currentHead(cwd: string): string {
  const head = git(['rev-parse', 'HEAD'], cwd)
  if (head.status !== 0) throw new Error('Unable to resolve HEAD.')
  return head.stdout.trim()
}

function moveMarkerForward(newSha: string, cwd: string): void {
  git(['tag', '-f', BACKUP_MARKER_TAG, newSha], cwd)
}

function latestIncrementalFile(bundleDir: string): string | undefined {
  if (!existsSync(bundleDir)) return undefined
  const candidates = readdirSync(bundleDir)
    .filter((name) => /^incr-[0-9a-f]{40}\.bundle$/.test(name))
    .sort()
  return candidates.at(-1)
}

/**
 * One-shot backup run. `mode: 'baseline'` writes a full self-sufficient
 * archive; `mode: 'incremental'` writes `last-backup..main`. The marker
 * tag advances only after `git bundle verify` exits 0 on the written file.
 */
export function runBundleBackup(options: {
  cwd: string
  mode: 'baseline' | 'incremental'
  bundleDir?: string
}): BundleResult {
  const { cwd, mode } = options
  assertMainBranch(cwd)
  const bundleDir = resolveBundleDir(options.bundleDir)
  const head = currentHead(cwd)
  const marker = markerTarget(cwd)
  const files: string[] = []

  if (mode === 'baseline') {
    if (marker) {
      console.log(
        `Warning: baseline already exists (marker at ${marker.slice(0, 12)}); creating a fresh full archive anyway.`,
      )
    }
    const baselinePath = path.join(bundleDir, 'baseline.bundle')
    const create = git(['bundle', 'create', baselinePath, '--all'], cwd)
    if (create.status !== 0) {
      return {
        ok: false,
        message: `baseline create failed: ${create.stderr.trim()}`,
        files,
      }
    }
    const verify = git(['bundle', 'verify', baselinePath], cwd)
    if (verify.status !== 0) {
      return {
        ok: false,
        bundlePath: baselinePath,
        message: `baseline verify failed (marker NOT advanced): ${verify.stderr.trim()}`,
        files,
      }
    }
    moveMarkerForward(head, cwd)
    files.push(baselinePath)
    return {
      ok: true,
      bundlePath: baselinePath,
      message: `baseline verified; marker at ${head.slice(0, 12)}`,
      files,
    }
  }

  // Incremental mode
  if (!marker) {
    throw new Error(
      `No ${BACKUP_MARKER_TAG} marker found; run with --baseline first (fail-closed: an incremental without a verified chain is unrestorable).`,
    )
  }
  const range = `${marker}..main`
  const incrementalPath = path.join(bundleDir, `incr-${head}.bundle`)
  if (marker === head) {
    // Nothing new since the last verified backup. Idempotent no-op when the
    // bundle for this HEAD exists and verifies; otherwise a success no-op
    // (an empty range cannot form a bundle, and there is nothing to back up).
    if (existsSync(incrementalPath)) {
      const existingVerify = git(['bundle', 'verify', incrementalPath], cwd)
      if (existingVerify.status === 0) {
        return {
          ok: true,
          bundlePath: incrementalPath,
          message: `already backed up at ${head.slice(0, 12)}`,
          files: [incrementalPath],
        }
      }
    }
    return {
      ok: true,
      message: `no new commits since ${marker.slice(0, 12)}; nothing to back up`,
    }
  }
  const create = git(['bundle', 'create', incrementalPath, range], cwd)
  if (create.status !== 0) {
    return {
      ok: false,
      bundlePath: incrementalPath,
      message: `incremental create failed (marker NOT advanced): ${create.stderr.trim()}`,
      files,
    }
  }
  const verify = git(['bundle', 'verify', incrementalPath], cwd)
  if (verify.status !== 0) {
    return {
      ok: false,
      bundlePath: incrementalPath,
      message: `incremental verify failed (marker NOT advanced): ${verify.stderr.trim()}`,
      files,
    }
  }
  moveMarkerForward(head, cwd)
  files.push(incrementalPath)
  return {
    ok: true,
    bundlePath: incrementalPath,
    message: `incremental verified; marker at ${head.slice(0, 12)}`,
    files,
  }
}

function main(): number {
  const args = process.argv.slice(2)
  const mode = args.includes('--baseline') ? 'baseline' : 'incremental'
  const cwd = process.cwd()
  try {
    const result = runBundleBackup({ cwd, mode })
    console.log(result.message)
    return result.ok ? 0 : 1
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}

if (import.meta.main) {
  process.exitCode = main()
}

// Referenced for the restore-drill documentation path (kept exported for
// tests that enumerate the destination).
export { latestIncrementalFile }
