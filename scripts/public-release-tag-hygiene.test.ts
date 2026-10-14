// Public release contract — tag hygiene. Split from
// public-release-git.test.ts (FID-2026-0918-003: the automation pin additions
// pushed the sibling past the 300-line ceiling; move-only per the
// FID-2026-0915-002 split discipline, assertion count preserved).

import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import { pruneLocalOnlyFailedTag, receiptPath } from './public-release'
import { blockedTagMessage } from './public-release/preflight'

// The release-contract fixtures drive real git repositories. This file's first
// test performs ~22 git spawns, and a Windows spawn costs ~200 ms, so it needs
// an explicit budget over bun's 5 s default (FID-2026-1013-006; measured 5.19 s).
describe('public release contract — tag hygiene', () => {
  test('prunes a local-only failed-run tag but never a remote, unowned or unverifiable one', () => {
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
      expect(pruneLocalOnlyFailedTag(repo, version, head)).toBe('kept')
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
      expect(pruneLocalOnlyFailedTag(repo, version, head)).toBe('pruned')
      expect(runGit(['tag', '-l', `v${version}`], repo)).toBe('')

      // Receipt owns it but the tag IS on the remote -> refuse to prune.
      runGit(['tag', '-a', `v${version}`, '-m', 't'], repo)
      runGit(['push', 'origin', `v${version}`], repo)
      expect(pruneLocalOnlyFailedTag(repo, version, head)).toBe('kept')
      expect(runGit(['tag', '-l', `v${version}`], repo)).toBe(`v${version}`)

      // Receipt head mismatch -> refuse to prune.
      runGit(['tag', '-d', `v${version}`], repo)
      runGit(['push', 'origin', `:refs/tags/v${version}`], repo)
      runGit(['tag', '-a', `v${version}`, '-m', 't2'], repo)
      expect(pruneLocalOnlyFailedTag(repo, version, '0'.repeat(40))).toBe(
        'kept',
      )
      expect(runGit(['tag', '-l', `v${version}`], repo)).toBe(`v${version}`)

      // FID-2026-0924-001: unreachable origin is an absence of evidence, not
      // evidence of presence — it must not read as "the tag already exists".
      runGit(
        [
          'remote',
          'set-url',
          'origin',
          path.join(os.tmpdir(), 'savant-release-prune-absent-origin'),
        ],
        repo,
      )
      expect(pruneLocalOnlyFailedTag(repo, version, head)).toBe(
        'kept-unverified',
      )
      expect(runGit(['tag', '-l', `v${version}`], repo)).toBe(`v${version}`)
    } finally {
      rmSync(receipt, { force: true })
      rmSync(repo, { recursive: true, force: true })
      rmSync(remote, { recursive: true, force: true })
    }
  }, 30_000)

  test('reports an unverifiable remote as unverified, never as a present tag', () => {
    // FID-2026-0924-001: a failed `git ls-remote` is an absence of evidence.
    // Rendering it as "the tag already exists" told the operator a fact the
    // pipeline had not established, and pointed them at `--resume` for a tag
    // that was never pushed.
    const unverified = blockedTagMessage('kept-unverified', '9.9.9')
    expect(unverified).toMatch(
      /Cannot verify whether tag v9\.9\.9 exists on origin/,
    )
    expect(unverified).not.toMatch(/already exists/)

    expect(blockedTagMessage('kept', '9.9.9')).toMatch(/already exists/)
    expect(blockedTagMessage('pruned', '9.9.9')).toBeUndefined()
  })
})
