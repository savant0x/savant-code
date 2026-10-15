// FID-2026-0905-007 — public-release decomposition: release lock.
//
// Repo-scoped, version-keyed advisory lock with owner-evidence-based stale
// recovery and the IN-PROGRESS quiescence marker for concurrent sessions
// (P1-A, FID-2026-0821-002). Verbatim moves from scripts/public-release.ts.

import { randomUUID } from 'crypto'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import os from 'os'
import path from 'path'

import { fail } from './fail'
import { transcriptDirectory } from './gates'
import { repositoryRoot } from './local-state'
import { receiptPath } from './receipts'
import { sha256Text } from './redaction'

/**
 * Repo-scoped, version-keyed lock path. Lives inside the repository's `.git`
 * directory when present (survives OS temp cleaners and cannot collide with
 * other repos); falls back to the OS temp directory otherwise.
 */
export function releaseLockPath(version: string): string {
  const repoKey = sha256Text(repositoryRoot()).slice(0, 8)
  const gitDir = path.join(repositoryRoot(), '.git')
  const base =
    existsSync(gitDir) && lstatSync(gitDir).isDirectory() ? gitDir : os.tmpdir()
  return path.join(base, `savant-release-${repoKey}-${version}.lock`)
}

export function acquireReleaseLock(version: string, mode: string): () => void {
  const lockPath = releaseLockPath(version)
  try {
    mkdirSync(lockPath)
  } catch {
    const ownerPath = path.join(lockPath, 'owner.json')
    if (!existsSync(ownerPath)) {
      fail(`Release lock is present but owner evidence is missing: ${lockPath}`)
    }
    let owner: {
      pid?: number
      host?: string
      ownerToken?: string
      startedAt?: string
      version?: string
      mode?: string
    }
    try {
      owner = JSON.parse(readFileSync(ownerPath, 'utf8')) as typeof owner
    } catch {
      fail(`Release lock owner evidence is invalid: ${lockPath}`)
    }
    if (
      !owner.pid ||
      owner.host !== os.hostname() ||
      owner.version !== version ||
      !owner.mode ||
      !owner.ownerToken ||
      !/^\d{4}-\d{2}-\d{2}T/.test(owner.startedAt ?? '') ||
      Number.isNaN(Date.parse(owner.startedAt ?? ''))
    ) {
      fail(`Release lock owner cannot be safely classified: ${lockPath}`)
    }
    let alive = true
    try {
      process.kill(owner.pid, 0)
    } catch {
      alive = false
    }
    if (alive)
      fail(`Another ${mode} process owns the release lock: ${lockPath}`)
    const currentOwner = JSON.parse(readFileSync(ownerPath, 'utf8')) as {
      ownerToken?: string
    }
    if (currentOwner.ownerToken !== owner.ownerToken) {
      fail(`Release lock owner changed during stale recovery: ${lockPath}`)
    }
    rmSync(lockPath, { recursive: true, force: true })
    try {
      mkdirSync(lockPath)
    } catch {
      fail(`Release lock recovery raced with another process: ${lockPath}`)
    }
  }
  const ownerToken = randomUUID()
  const ownerPath = path.join(lockPath, 'owner.json')
  try {
    writeFileSync(
      ownerPath,
      JSON.stringify(
        {
          pid: process.pid,
          host: os.hostname(),
          startedAt: new Date().toISOString(),
          ownerToken,
          version,
          mode,
          receiptPath: receiptPath(version),
          transcriptDirectory: transcriptDirectory(version),
        },
        null,
        2,
      ),
      { encoding: 'utf8', mode: 0o600 },
    )
    const persisted = JSON.parse(readFileSync(ownerPath, 'utf8')) as {
      ownerToken?: string
    }
    if (persisted.ownerToken !== ownerToken) {
      fail(
        `Release lock ownership was replaced during acquisition: ${lockPath}`,
      )
    }
    // P1-A (FID-2026-0821-002): signal to concurrent sessions that a public
    // release is running and the tree must stay quiescent. Lives inside the
    // lock dir, so lock release removes it automatically.
    writeFileSync(
      path.join(lockPath, 'IN-PROGRESS.md'),
      [
        '# Release in progress',
        '',
        `A public release (v${version}, ${mode}) is running from ${os.hostname()} (pid ${process.pid}, started ${new Date().toISOString()}).`,
        'Concurrent sessions should pause writes under dev/ (FIDs, scratchpad, session summaries) until this marker disappears:',
        'automation mode commits the entire worktree and fails closed if the tree changes mid-gates.',
        `Owner token: ${ownerToken}`,
        '',
      ].join('\n'),
      { encoding: 'utf8' },
    )
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('ownership was replaced')
    )
      throw error
    rmSync(lockPath, { recursive: true, force: true })
    fail(`Unable to persist release ownership lock: ${lockPath}`)
  }
  return () => {
    try {
      const owner = JSON.parse(readFileSync(ownerPath, 'utf8')) as {
        ownerToken?: string
      }
      if (owner.ownerToken === ownerToken)
        rmSync(lockPath, { recursive: true, force: true })
    } catch {
      // Never remove an unreadable or replaced lock during cleanup.
    }
  }
}
