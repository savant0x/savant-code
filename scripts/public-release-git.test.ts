// Public release contract — git automation, worktree fingerprints, and tag
// hygiene. Sibling of the FID-2026-0819-005 Loop 317 decomposition.

import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import {
  changedWorktreePaths,
  commitAllAutomationChanges,
  fingerprintWorktree,
  ignoredPathDelta,
  pruneLocalOnlyFailedTag,
  receiptPath,
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

  test('prunes a local-only failed-run tag but never a remote or unowned tag', () => {
    const version = '9.9.9-prune'
    const receipt = receiptPath(version)
    const repo = mkdtempSync(path.join(os.tmpdir(), 'savant-release-prune-'))
    const remote = mkdtempSync(
      path.join(os.tmpdir(), 'savant-release-prune-remote-'),
    )
    const runGit = (args: string[], cwd: string) => {
      const result = Bun.spawnSync({
        cmd: ['git', ...args],
        cwd,
        stdout: 'pipe',
        stderr: 'pipe',
      })
      if (result.exitCode !== 0)
        throw new Error(new TextDecoder().decode(result.stderr))
      return new TextDecoder().decode(result.stdout).trim()
    }
    try {
      runGit(['init', '--bare'], remote)
      runGit(['init'], repo)
      runGit(['config', 'user.email', 'release-test@example.invalid'], repo)
      runGit(['config', 'user.name', 'Release Test'], repo)
      runGit(['remote', 'add', 'origin', remote], repo)
      writeFileSync(path.join(repo, 'a.txt'), 'x')
      runGit(['add', '--all'], repo)
      runGit(['commit', '-m', 'base'], repo)
      const head = runGit(['rev-parse', 'HEAD'], repo)

      // No receipt -> nothing pruned, tag untouched.
      runGit(['tag', '-a', `v${version}`, '-m', 't'], repo)
      expect(pruneLocalOnlyFailedTag(repo, version, head)).toBe(false)
      expect(runGit(['tag', '-l', `v${version}`], repo)).toBe(`v${version}`)

      // Failed receipt owning this head + tag absent on remote -> pruned.
      writeFileSync(
        receipt,
        JSON.stringify({
          schemaVersion: 'release-receipt/v2',
          version,
          mode: 'automation',
          headSha: head,
          completedStages: ['TAG'],
          failedStage: 'Stage command failed: git push origin main',
          restored: true,
        }),
      )
      expect(pruneLocalOnlyFailedTag(repo, version, head)).toBe(true)
      expect(runGit(['tag', '-l', `v${version}`], repo)).toBe('')

      // Receipt owns it but the tag IS on the remote -> refuse to prune.
      runGit(['tag', '-a', `v${version}`, '-m', 't'], repo)
      runGit(['push', 'origin', `v${version}`], repo)
      expect(pruneLocalOnlyFailedTag(repo, version, head)).toBe(false)
      expect(runGit(['tag', '-l', `v${version}`], repo)).toBe(`v${version}`)

      // Receipt head mismatch -> refuse to prune.
      runGit(['tag', '-d', `v${version}`], repo)
      runGit(['push', 'origin', `:refs/tags/v${version}`], repo)
      runGit(['tag', '-a', `v${version}`, '-m', 't2'], repo)
      expect(pruneLocalOnlyFailedTag(repo, version, '0'.repeat(40))).toBe(false)
      expect(runGit(['tag', '-l', `v${version}`], repo)).toBe(`v${version}`)
    } finally {
      rmSync(receipt, { force: true })
      rmSync(repo, { recursive: true, force: true })
      rmSync(remote, { recursive: true, force: true })
    }
  })
})
