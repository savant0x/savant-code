// Public release contract — git automation, worktree fingerprints, and tag
// hygiene. Sibling of the FID-2026-0819-005 Loop 317 decomposition.

import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import {
  changedWorktreePaths,
  commitAutomationChangesOrTagHead,
  commitAllAutomationChanges,
  fingerprintWorktree,
  ignoredPathDelta,
  recoverAutomationCommit,
} from './public-release'

describe('public release contract — git & worktree', () => {
  test('recovers a release commit created before receipt persistence', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'savant-release-recover-'))
    try {
      const runGit = (args: string[]) => {
        const result = Bun.spawnSync({
          cmd: ['git', ...args],
          cwd: repo,
          stdout: 'pipe',
          stderr: 'pipe',
        })
        if (result.exitCode !== 0) {
          throw new Error(new TextDecoder().decode(result.stderr))
        }
      }
      runGit(['init'])
      runGit(['config', 'user.email', 'release-test@example.invalid'])
      runGit(['config', 'user.name', 'Release Test'])
      writeFileSync(path.join(repo, 'base.txt'), 'base')
      runGit(['add', '--all'])
      runGit(['commit', '-m', 'base'])
      const previousHead = new TextDecoder()
        .decode(
          Bun.spawnSync({
            cmd: ['git', 'rev-parse', 'HEAD'],
            cwd: repo,
            stdout: 'pipe',
            stderr: 'pipe',
          }).stdout,
        )
        .trim()
      writeFileSync(path.join(repo, 'release.txt'), 'release')
      const committed = commitAllAutomationChanges(repo, '0.0.21')

      expect(recoverAutomationCommit(repo, previousHead, '0.0.21')).toEqual(
        committed,
      )
      expect(
        recoverAutomationCommit(repo, 'b'.repeat(40), '0.0.21'),
      ).toBeUndefined()
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('tags current HEAD without a commit when the automation worktree is clean', () => {
    const repo = mkdtempSync(
      path.join(os.tmpdir(), 'savant-release-clean-auto-'),
    )
    try {
      const runGit = (args: string[]) => {
        const result = Bun.spawnSync({
          cmd: ['git', ...args],
          cwd: repo,
          stdout: 'pipe',
          stderr: 'pipe',
        })
        if (result.exitCode !== 0) {
          throw new Error(new TextDecoder().decode(result.stderr))
        }
        return new TextDecoder().decode(result.stdout).trim()
      }
      runGit(['init'])
      runGit(['config', 'user.email', 'release-test@example.invalid'])
      runGit(['config', 'user.name', 'Release Test'])
      writeFileSync(path.join(repo, 'base.txt'), 'base')
      runGit(['add', '--all'])
      runGit(['commit', '-m', 'base'])
      const headBefore = runGit(['rev-parse', 'HEAD'])

      const committed = commitAutomationChangesOrTagHead(repo, '0.0.33')

      expect(committed.headSha).toBe(headBefore)
      expect(committed.files).toEqual([])
      expect(runGit(['rev-parse', 'HEAD'])).toBe(headBefore)
      expect(runGit(['log', '-1', '--format=%s'])).toBe('base')
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('still sweeps dirty worktrees into one automation commit via the shared entry point', () => {
    const repo = mkdtempSync(
      path.join(os.tmpdir(), 'savant-release-dirty-auto-'),
    )
    try {
      const runGit = (args: string[]) => {
        const result = Bun.spawnSync({
          cmd: ['git', ...args],
          cwd: repo,
          stdout: 'pipe',
          stderr: 'pipe',
        })
        if (result.exitCode !== 0) {
          throw new Error(new TextDecoder().decode(result.stderr))
        }
        return new TextDecoder().decode(result.stdout).trim()
      }
      runGit(['init'])
      runGit(['config', 'user.email', 'release-test@example.invalid'])
      runGit(['config', 'user.name', 'Release Test'])
      writeFileSync(path.join(repo, 'base.txt'), 'base')
      runGit(['add', '--all'])
      runGit(['commit', '-m', 'base'])
      const headBefore = runGit(['rev-parse', 'HEAD'])
      writeFileSync(path.join(repo, 'tracked.txt'), 'tracked')
      writeFileSync(path.join(repo, 'untracked.txt'), 'untracked')

      const committed = commitAutomationChangesOrTagHead(repo, '0.0.33')

      expect(committed.files).toEqual(['tracked.txt', 'untracked.txt'])
      expect(committed.headSha).toMatch(/^[0-9a-f]{40}$/)
      expect(runGit(['rev-parse', 'HEAD^'])).toBe(headBefore)
      expect(runGit(['log', '-1', '--format=%s'])).toBe(
        'chore(release): prepare v0.0.33',
      )
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('creates one automation commit containing tracked and untracked changes', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'savant-release-git-'))
    try {
      const runGit = (args: string[]) => {
        const result = Bun.spawnSync({
          cmd: ['git', ...args],
          cwd: repo,
          stdout: 'pipe',
          stderr: 'pipe',
        })
        if (result.exitCode !== 0) {
          throw new Error(new TextDecoder().decode(result.stderr))
        }
      }
      runGit(['init'])
      runGit(['config', 'user.email', 'release-test@example.invalid'])
      runGit(['config', 'user.name', 'Release Test'])
      writeFileSync(path.join(repo, 'tracked.txt'), 'tracked')
      writeFileSync(path.join(repo, 'untracked.txt'), 'untracked')

      const committed = commitAllAutomationChanges(repo, '0.0.21')

      expect(committed.files).toEqual(['tracked.txt', 'untracked.txt'])
      expect(committed.headSha).toMatch(/^[0-9a-f]{40}$/)
      const log = Bun.spawnSync({
        cmd: ['git', 'log', '-1', '--format=%s'],
        cwd: repo,
        stdout: 'pipe',
        stderr: 'pipe',
      })
      expect(new TextDecoder().decode(log.stdout).trim()).toBe(
        'chore(release): prepare v0.0.21',
      )
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('reports changed tracked and untracked paths between fingerprints', () => {
    const before = {
      hash: 'before',
      trackedDetails: { 'a.txt': '1', 'b.txt': '2' },
      status: '?? extra.txt',
    }
    const after = {
      hash: 'after',
      trackedDetails: { 'a.txt': '9', 'c.txt': '3' },
      status: ' M a.txt',
    }
    expect(changedWorktreePaths(before, after)).toEqual([
      'a.txt',
      'b.txt',
      'c.txt',
      'extra.txt',
    ])
  })

  test('computes added and removed ignored paths between snapshots', () => {
    expect(ignoredPathDelta('!! a/\n!! b/x.log', '!! a/\n!! c/')).toEqual({
      added: ['!! c/'],
      removed: ['!! b/x.log'],
    })
    expect(ignoredPathDelta('', '')).toEqual({ added: [], removed: [] })
  })

  test('fingerprints the tracked worktree and detects mutations', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'savant-release-fp-'))
    try {
      const runGit = (args: string[]) => {
        const result = Bun.spawnSync({
          cmd: ['git', ...args],
          cwd: repo,
          stdout: 'pipe',
          stderr: 'pipe',
        })
        if (result.exitCode !== 0) {
          throw new Error(new TextDecoder().decode(result.stderr))
        }
      }
      runGit(['init'])
      runGit(['config', 'user.email', 'release-test@example.invalid'])
      runGit(['config', 'user.name', 'Release Test'])
      writeFileSync(path.join(repo, 'tracked.txt'), 'base')
      runGit(['add', '--all'])
      runGit(['commit', '-m', 'base'])

      const baseline = fingerprintWorktree(repo)
      expect(fingerprintWorktree(repo).hash).toBe(baseline.hash)

      writeFileSync(path.join(repo, 'tracked.txt'), 'changed')
      const mutated = fingerprintWorktree(repo)
      expect(mutated.hash).not.toBe(baseline.hash)
      expect(changedWorktreePaths(baseline, mutated)).toEqual(['tracked.txt'])

      writeFileSync(path.join(repo, 'tracked.txt'), 'base')
      expect(fingerprintWorktree(repo).hash).toBe(baseline.hash)

      writeFileSync(path.join(repo, 'untracked.txt'), 'new')
      const untracked = fingerprintWorktree(repo)
      expect(untracked.hash).not.toBe(baseline.hash)
      expect(changedWorktreePaths(baseline, untracked)).toEqual([
        'untracked.txt',
      ])
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

})
