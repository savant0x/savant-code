// FID-2026-0905-008 — bundle backup characterization tests.
//
// Maps each BO-2026-08-23 FID-3 acceptance gate to a test: scratch-repo
// create+verify e2e, verify-or-no-advance on failure, incremental from
// marker, fail-closed without marker, destination resolution + env
// override, idempotent same-HEAD rerun.

import { spawnSync } from 'child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import {
  BACKUP_MARKER_TAG,
  SAVANT_BUNDLE_DIR_DEFAULT,
  runBundleBackup,
} from './git-bundle-backup'

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

function initScratchRepo(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'bundle-backup-test-'))
  git(['init', '-b', 'main'], dir)
  git(['config', 'user.email', 'test@example.com'], dir)
  git(['config', 'user.name', 'Test'], dir)
  writeFileSync(path.join(dir, 'f.txt'), 'one\n', 'utf8')
  git(['add', 'f.txt'], dir)
  git(['commit', '-m', 'one'], dir)
  return dir
}

function commitIn(dir: string, message: string): void {
  writeFileSync(path.join(dir, 'f.txt'), `${message}\n`, 'utf8')
  git(['add', 'f.txt'], dir)
  git(['commit', '-m', message], dir)
}

function markerAt(dir: string): string {
  return git(['rev-parse', BACKUP_MARKER_TAG], dir).stdout.trim()
}

function headAt(dir: string): string {
  return git(['rev-parse', 'HEAD'], dir).stdout.trim()
}

describe('git bundle backup', () => {
  test('baseline creates, verifies, and advances the marker', () => {
    const repo = initScratchRepo()
    const dest = mkdtempSync(path.join(os.tmpdir(), 'bundle-dest-'))
    try {
      const baseline = runBundleBackup({
        cwd: repo,
        mode: 'baseline',
        bundleDir: dest,
      })
      expect(baseline.ok).toBe(true)
      expect(existsSync(path.join(dest, 'baseline.bundle'))).toBe(true)
      expect(markerAt(repo)).toBe(headAt(repo))
    } finally {
      rmSync(repo, { recursive: true, force: true })
      rmSync(dest, { recursive: true, force: true })
    }
  })

  test('incremental flows from the marker and advances it (full e2e chain)', () => {
    const repo = initScratchRepo()
    const dest = mkdtempSync(path.join(os.tmpdir(), 'bundle-dest-'))
    try {
      runBundleBackup({ cwd: repo, mode: 'baseline', bundleDir: dest })
      const baselineMarker = markerAt(repo)

      commitIn(repo, 'two')
      const incr = runBundleBackup({
        cwd: repo,
        mode: 'incremental',
        bundleDir: dest,
      })
      expect(incr.ok).toBe(true)
      expect(incr.bundlePath?.startsWith(path.join(dest, 'incr-'))).toBe(true)
      expect(markerAt(repo)).toBe(headAt(repo))
      expect(markerAt(repo)).not.toBe(baselineMarker)
      expect(existsSync(path.join(dest, `incr-${headAt(repo)}.bundle`))).toBe(
        true,
      )
    } finally {
      rmSync(repo, { recursive: true, force: true })
      rmSync(dest, { recursive: true, force: true })
    }
  })

  test('incremental fails closed without a marker and does not create one', () => {
    const repo = initScratchRepo()
    const dest = mkdtempSync(path.join(os.tmpdir(), 'bundle-dest-'))
    try {
      expect(() =>
        runBundleBackup({ cwd: repo, mode: 'incremental', bundleDir: dest }),
      ).toThrow(/baseline first/)
      expect(
        git(['rev-parse', '--verify', BACKUP_MARKER_TAG], repo).status,
      ).not.toBe(0)
    } finally {
      rmSync(repo, { recursive: true, force: true })
      rmSync(dest, { recursive: true, force: true })
    }
  })

  test('same-HEAD rerun is idempotent (no second incremental for one commit)', () => {
    const repo = initScratchRepo()
    const dest = mkdtempSync(path.join(os.tmpdir(), 'bundle-dest-'))
    try {
      runBundleBackup({ cwd: repo, mode: 'baseline', bundleDir: dest })
      commitIn(repo, 'two')
      const first = runBundleBackup({
        cwd: repo,
        mode: 'incremental',
        bundleDir: dest,
      })
      expect(first.ok).toBe(true)
      const rerun = runBundleBackup({
        cwd: repo,
        mode: 'incremental',
        bundleDir: dest,
      })
      expect(rerun.ok).toBe(true)
      expect(rerun.message).toContain('already backed up')
    } finally {
      rmSync(repo, { recursive: true, force: true })
      rmSync(dest, { recursive: true, force: true })
    }
  })

  test('baseline path is resolvable and env var overrides the destination', () => {
    expect(SAVANT_BUNDLE_DIR_DEFAULT.length).toBeGreaterThan(0)
    const repo = initScratchRepo()
    const dest = mkdtempSync(path.join(os.tmpdir(), 'bundle-dest-'))
    const previous = process.env.SAVANT_BUNDLE_DIR
    try {
      process.env.SAVANT_BUNDLE_DIR = dest
      const result = runBundleBackup({ cwd: repo, mode: 'baseline' })
      expect(result.ok).toBe(true)
      expect(existsSync(path.join(dest, 'baseline.bundle'))).toBe(true)
    } finally {
      if (previous === undefined) delete process.env.SAVANT_BUNDLE_DIR
      else process.env.SAVANT_BUNDLE_DIR = previous
      rmSync(repo, { recursive: true, force: true })
      rmSync(dest, { recursive: true, force: true })
    }
  })

  test('unwritable destination fails closed without touching the marker', () => {
    const repo = initScratchRepo()
    try {
      runBundleBackup({ cwd: repo, mode: 'baseline' })
      const before = markerAt(repo)
      commitIn(repo, 'after-good-baseline')
      // A file where the incremental destination directory should be.
      const blocker = mkdtempSync(path.join(os.tmpdir(), 'bundle-blocker-'))
      const blockedDir = path.join(blocker, 'not-a-dir')
      writeFileSync(blockedDir, 'file in the way\n', 'utf8')
      let threw = false
      try {
        runBundleBackup({
          cwd: repo,
          mode: 'incremental',
          bundleDir: blockedDir,
        })
      } catch {
        threw = true
      }
      expect(threw).toBe(true)
      expect(markerAt(repo)).toBe(before)
      rmSync(blocker, { recursive: true, force: true })
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('restore drill: baseline clone + incremental fetch reaches main', () => {
    const repo = initScratchRepo()
    const dest = mkdtempSync(path.join(os.tmpdir(), 'bundle-dest-'))
    const restore = mkdtempSync(path.join(os.tmpdir(), 'bundle-restore-'))
    try {
      runBundleBackup({ cwd: repo, mode: 'baseline', bundleDir: dest })
      commitIn(repo, 'two')
      const incr = runBundleBackup({
        cwd: repo,
        mode: 'incremental',
        bundleDir: dest,
      })
      expect(incr.ok).toBe(true)

      const cloneInto = path.join(restore, 'clone')
      mkdirSync(cloneInto, { recursive: true })
      const clone = git(
        ['clone', path.join(dest, 'baseline.bundle'), cloneInto],
        restore,
      )
      expect(clone.status).toBe(0)
      const fetched = git(
        ['fetch', incr.bundlePath as string, 'main:refs/remotes/backup/main'],
        cloneInto,
      )
      expect(fetched.status).toBe(0)
      const restored = git(['rev-parse', 'refs/remotes/backup/main'], cloneInto)
      expect(restored.stdout.trim()).toBe(headAt(repo))
    } finally {
      rmSync(repo, { recursive: true, force: true })
      rmSync(dest, { recursive: true, force: true })
      rmSync(restore, { recursive: true, force: true })
    }
  })
})
