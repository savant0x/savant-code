// FID-2026-0905-009 — BACKUP_BUNDLE release stage tests.
//
// Pins the stage contract on scratch repos: mark-on-verified-backup,
// fail-closed abort (marker NOT advanced), resume skip, stage-list
// ordering, and the pre-009 receipt runs-the-backup-for-real behavior
// (Loop-2 correction: durability over retro-marking).

import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import { runBundleBackup, BACKUP_MARKER_TAG } from './git-bundle-backup'
import { runBackupBundleStage } from './public-release/backup-stage'
import { RELEASE_STAGES } from './public-release/fail'
import { isStageComplete } from './public-release/receipts'

import type {
  ReleaseReceipt,
  TransactionContext,
} from './public-release/catalog'

/** Minimal git repo with one commit on main, returned with its root path. */
function scratchRepo(): { root: string; cleanup: () => void } {
  const root = mkdtempSync(path.join(os.tmpdir(), 'backup-stage-'))
  const git = (args: string[]) => {
    const result = Bun.spawnSync(['git', ...args], {
      cwd: root,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    if (result.exitCode !== 0)
      throw new Error(
        `git ${args.join(' ')} failed: ${result.stderr.toString()}`,
      )
    return result.stdout.toString()
  }
  git(['init', '-b', 'main'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'Test'])
  writeFileSync(path.join(root, 'file.txt'), 'v1\n')
  git(['add', '.'])
  git(['commit', '-m', 'c1'])
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
}

function makeContext(
  root: string,
  completedStages: string[] = [],
): TransactionContext {
  const receipt: ReleaseReceipt = {
    schemaVersion: 'release-receipt/v2',
    version: '0.0.0-test',
    mode: 'automation',
    completedStages,
    restored: false,
    receiptPath: path.join(root, 'receipt.json'),
    repositoryKey: 'testkey1',
    gateAttempts: [],
    evidenceFinalized: false,
  }
  return {
    root,
    version: '0.0.0-test',
    plan: [],
    options: {
      preview: false,
      resume: false,
      automation: true,
    },
    receipt,
    githubToken: '',
    snapshot: undefined as never,
    preflight: { notes: '', warnings: [], headSha: 'unused' },
  }
}

function stageList(): string[] {
  return [...RELEASE_STAGES]
}

/**
 * Point SAVANT_BUNDLE_DIR at the scratch repo's bundles dir for the
 * duration of `fn` (the stage resolves its destination from env by
 * design; tests must not write into the operator's real backup dir).
 */
function withIsolatedBundleDir<T>(root: string, fn: () => T): T {
  const previous = process.env.SAVANT_BUNDLE_DIR
  process.env.SAVANT_BUNDLE_DIR = path.join(root, 'bundles')
  try {
    return fn()
  } finally {
    if (previous === undefined) delete process.env.SAVANT_BUNDLE_DIR
    else process.env.SAVANT_BUNDLE_DIR = previous
  }
}

describe('BACKUP_BUNDLE stage (FID-2026-0905-009)', () => {
  test('stage list ordering: BACKUP_BUNDLE between GIT_PUSH and GITHUB_RELEASE', () => {
    const stages = stageList()
    expect(stages.indexOf('GIT_PUSH')).toBeLessThan(
      stages.indexOf('BACKUP_BUNDLE'),
    )
    expect(stages.indexOf('BACKUP_BUNDLE')).toBeLessThan(
      stages.indexOf('GITHUB_RELEASE'),
    )
  })

  test('marks BACKUP_BUNDLE on a verified incremental backup', () => {
    const { root, cleanup } = scratchRepo()
    try {
      runBundleBackup({
        cwd: root,
        mode: 'baseline',
        bundleDir: path.join(root, 'bundles'),
      })
      writeFileSync(path.join(root, 'file.txt'), 'v2\n')
      const git = (args: string[]) =>
        Bun.spawnSync(['git', ...args], { cwd: root, stdout: 'pipe' })
      git(['add', '.'])
      git(['commit', '-m', 'c2'])

      const ctx = makeContext(root)
      withIsolatedBundleDir(root, () => runBackupBundleStage(ctx))
      expect(isStageComplete(ctx.receipt, 'BACKUP_BUNDLE')).toBe(true)
      // The isolated destination now carries the incremental for HEAD.
      const head = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], {
        cwd: root,
        stdout: 'pipe',
      })
        .stdout.toString()
        .trim()
      expect(
        existsSync(path.join(root, 'bundles', `incr-${head}.bundle`)),
      ).toBe(true)
    } finally {
      cleanup()
    }
  })

  test('fails closed and does NOT mark the stage when the backup fails', () => {
    const { root, cleanup } = scratchRepo()
    try {
      // No marker: incremental mode fails closed by contract.
      const ctx = makeContext(root)
      expect(() => runBackupBundleStage(ctx)).toThrow(/BACKUP_BUNDLE failed/)
      expect(isStageComplete(ctx.receipt, 'BACKUP_BUNDLE')).toBe(false)
    } finally {
      cleanup()
    }
  })

  test('resume with BACKUP_BUNDLE complete skips the backup entirely', () => {
    const { root, cleanup } = scratchRepo()
    try {
      const ctx = makeContext(root, ['GIT_PUSH', 'BACKUP_BUNDLE'])
      // No bundle dir exists; if the backup ran it would throw (no marker),
      // so reaching here cleanly proves the skip.
      runBackupBundleStage(ctx)
      expect(isStageComplete(ctx.receipt, 'BACKUP_BUNDLE')).toBe(true)
    } finally {
      cleanup()
    }
  })

  test('pre-009 receipt (GITHUB_RELEASE done, BACKUP_BUNDLE absent) runs the backup for real', () => {
    const { root, cleanup } = scratchRepo()
    try {
      runBundleBackup({
        cwd: root,
        mode: 'baseline',
        bundleDir: path.join(root, 'bundles'),
      })
      writeFileSync(path.join(root, 'file.txt'), 'v2\n')
      const git = (args: string[]) =>
        Bun.spawnSync(['git', ...args], {
          cwd: root,
          stdout: 'pipe',
        }).stdout.toString()
      git(['add', '.'])
      git(['commit', '-m', 'c2'])

      const ctx = makeContext(root, ['GIT_PUSH', 'GITHUB_RELEASE'])
      withIsolatedBundleDir(root, () => runBackupBundleStage(ctx))
      expect(isStageComplete(ctx.receipt, 'BACKUP_BUNDLE')).toBe(true)
      // The bundle dir now carries the incremental for the new HEAD.
      const head = git(['rev-parse', 'HEAD']).trim()
      expect(
        require('fs').existsSync(
          path.join(root, 'bundles', `incr-${head}.bundle`),
        ),
      ).toBe(true)
    } finally {
      cleanup()
    }
  })

  test('backup core still refuses to advance the marker on a corrupt bundle', () => {
    const { root, cleanup } = scratchRepo()
    try {
      runBundleBackup({
        cwd: root,
        mode: 'baseline',
        bundleDir: path.join(root, 'bundles'),
      })
      const before = Bun.spawnSync(['git', 'rev-parse', BACKUP_MARKER_TAG], {
        cwd: root,
        stdout: 'pipe',
      })
        .stdout.toString()
        .trim()
      // Corrupt the incremental destination by pointing the bundle dir at
      // a file path — resolveBundleDir throws fail-closed.
      const filePath = path.join(root, 'not-a-dir')
      writeFileSync(filePath, 'x')
      expect(() =>
        runBundleBackup({
          cwd: root,
          mode: 'incremental',
          bundleDir: filePath,
        }),
      ).toThrow(/not a directory/)
      const after = Bun.spawnSync(['git', 'rev-parse', BACKUP_MARKER_TAG], {
        cwd: root,
        stdout: 'pipe',
      })
        .stdout.toString()
        .trim()
      expect(after).toBe(before)
    } finally {
      cleanup()
    }
  })
})
