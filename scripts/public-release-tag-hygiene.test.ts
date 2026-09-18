// Public release contract — tag hygiene. Split from
// public-release-git.test.ts (FID-2026-0918-003: the automation pin additions
// pushed the sibling past the 300-line ceiling; move-only per the
// FID-2026-0915-002 split discipline, assertion count preserved).

import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import { pruneLocalOnlyFailedTag, receiptPath } from './public-release'

describe('public release contract — tag hygiene', () => {
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
