import { spawnSync } from 'child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import {
  commitChangedFiles,
  materializePushedContent,
  parsePrePushRefs,
  pushedRangeCommits,
  runPrePushSecretScan,
  type PushRef,
} from './pre-push-scan'

function git(root: string, args: string[]): string {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    windowsHide: true,
  })
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${String(result.stderr)}`)
  }
  return String(result.stdout ?? '')
}

function initRepo(): string {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'savant-push-scan-'))
  git(repo, ['init', '-q'])
  git(repo, ['config', 'user.email', 'push-scan@test.invalid'])
  git(repo, ['config', 'user.name', 'Push Scan Test'])
  return repo
}

function commitAll(repo: string, message: string): string {
  git(repo, ['add', '-A'])
  git(repo, ['commit', '-q', '-m', message])
  return git(repo, ['rev-parse', 'HEAD']).trim()
}

const FAKE_TOKEN = ['ghp', '_', 'K8sT2vX9mQ4rA7cD1fH5jL0nP3wZ6yB8eG2uR'].join(
  '',
)

describe('pre-push credential scan', () => {
  test('parses hook stdin ref lines', () => {
    const stdin = [
      'refs/heads/main ' +
        'a'.repeat(40) +
        ' refs/heads/main ' +
        'b'.repeat(40),
      '',
      'refs/tags/v0.0.21 ' +
        'c'.repeat(40) +
        ' refs/tags/v0.0.21 ' +
        '0'.repeat(40),
    ].join('\n')
    const refs = parsePrePushRefs(stdin)
    expect(refs).toHaveLength(2)
    expect(refs[0]).toEqual({
      localRef: 'refs/heads/main',
      localSha: 'a'.repeat(40),
      remoteRef: 'refs/heads/main',
      remoteSha: 'b'.repeat(40),
    })
    expect(refs[1].remoteSha).toBe('0'.repeat(40))
  })

  test('rejects malformed hook stdin fail-closed', () => {
    expect(() =>
      parsePrePushRefs('malformed-line-without-four-fields\n'),
    ).toThrow('unparseable pre-push ref line')
    expect(() =>
      parsePrePushRefs(
        'refs/heads/x not-a-sha refs/heads/x ' + 'd'.repeat(40) + '\n',
      ),
    ).toThrow('unparseable pre-push ref line')
  })

  test('enumerates the pushed commit range for existing and new refs', () => {
    const repo = initRepo()
    try {
      writeFileSync(path.join(repo, 'one.txt'), 'one\n')
      const base = commitAll(repo, 'first')
      writeFileSync(path.join(repo, 'two.txt'), 'two\n')
      writeFileSync(path.join(repo, 'three.txt'), 'three\n')
      const head = commitAll(repo, 'second')

      const existing: PushRef = {
        localRef: 'refs/heads/main',
        localSha: head,
        remoteRef: 'refs/heads/main',
        remoteSha: base,
      }
      const existingCommits = pushedRangeCommits(repo, existing)
      expect(existingCommits).toEqual([head])
      expect(commitChangedFiles(repo, head).sort()).toEqual([
        'three.txt',
        'two.txt',
      ])

      const fresh: PushRef = {
        localRef: 'refs/heads/main',
        localSha: head,
        remoteRef: 'refs/heads/main',
        remoteSha: '0'.repeat(40),
      }
      // Oldest-first, exactly the two local commits (no origin/HEAD).
      expect(pushedRangeCommits(repo, fresh)).toEqual([base, head])
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('materializes only the pushed content, preserving relative paths', () => {
    const repo = initRepo()
    try {
      mkdirSync(path.join(repo, 'deep'))
      writeFileSync(path.join(repo, 'deep/nested.txt'), 'content\n')
      git(repo, ['add', '-A'])
      const head = commitAll(repo, 'nested')
      const { mirror, materialized } = materializePushedContent(repo, head, [
        'deep/nested.txt',
      ])
      try {
        expect(materialized).toEqual(['deep/nested.txt'])
      } finally {
        rmSync(mirror, { recursive: true, force: true })
      }
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('flags credential-shaped content in the pushed range and passes clean content', () => {
    const repo = initRepo()
    try {
      writeFileSync(path.join(repo, 'safe.ts'), 'export const ok = 1\n')
      const base = commitAll(repo, 'safe baseline')
      writeFileSync(path.join(repo, 'leaked.txt'), `token ${FAKE_TOKEN}\n`)
      writeFileSync(path.join(repo, 'safe.ts'), 'export const ok = 2\n')
      const head = commitAll(repo, 'adds leaked secret')

      const result = runPrePushSecretScan(
        repo,
        `refs/heads/main ${head} refs/heads/main ${base}\n`,
      )
      expect(result.flagged.length).toBeGreaterThan(0)
      expect(result.flagged.some((entry) => entry.includes('leaked.txt'))).toBe(
        true,
      )
      // The unchanged baseline content is not part of the pushed range.
      expect(result.flagged.some((entry) => entry.includes('safe.ts'))).toBe(
        false,
      )
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('catches a secret committed and reverted inside the pushed range', () => {
    const repo = initRepo()
    try {
      writeFileSync(path.join(repo, 'safe.ts'), 'export const ok = 1\n')
      const base = commitAll(repo, 'baseline')
      // Commit A adds the secret; commit B reverts it. The net tip-vs-tip diff
      // is empty for leaked.txt, but the blob still lands in remote history.
      writeFileSync(path.join(repo, 'leaked.txt'), `token ${FAKE_TOKEN}\n`)
      const leakCommit = commitAll(repo, 'adds secret')
      rmSync(path.join(repo, 'leaked.txt'))
      writeFileSync(path.join(repo, 'safe.ts'), 'export const ok = 2\n')
      const head = commitAll(repo, 'reverts secret')

      const result = runPrePushSecretScan(
        repo,
        `refs/heads/main ${head} refs/heads/main ${base}\n`,
      )
      expect(result.flagged.some((entry) => entry.includes('leaked.txt'))).toBe(
        true,
      )
      expect(result.scanned).toBeGreaterThan(0)
      void leakCommit
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('enumerates root commits (the very first commit has no parents)', () => {
    const repo = initRepo()
    try {
      writeFileSync(path.join(repo, 'first.txt'), `token ${FAKE_TOKEN}\n`)
      const root = commitAll(repo, 'root commit')

      // A brand-new ref pushes the root commit; its files must be scanned
      // even though diff-tree needs --root to report them.
      expect(commitChangedFiles(repo, root)).toEqual(['first.txt'])

      const result = runPrePushSecretScan(
        repo,
        `refs/heads/main ${root} refs/heads/main ${'0'.repeat(40)}\n`,
      )
      expect(result.flagged.some((entry) => entry.includes('first.txt'))).toBe(
        true,
      )
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('deletion refs push no content and never block', () => {
    const repo = initRepo()
    try {
      writeFileSync(path.join(repo, 'ok.ts'), 'export const x = 1\n')
      const base = commitAll(repo, 'baseline')
      const result = runPrePushSecretScan(
        repo,
        `refs/heads/main ${'0'.repeat(40)} refs/heads/main ${base}\n`,
      )
      expect(result.flagged).toEqual([])
      expect(result.scanned).toBe(0)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('over-cap blobs are counted oversized and block the push', () => {
    const repo = initRepo()
    try {
      writeFileSync(
        path.join(repo, 'big.bin'),
        Buffer.alloc(2 * 1024 * 1024 + 1),
      )
      const head = commitAll(repo, 'big blob')
      const { materialized, oversized } = materializePushedContent(repo, head, [
        'big.bin',
      ])
      expect(materialized).toEqual([])
      expect(oversized).toBe(1)

      const result = runPrePushSecretScan(
        repo,
        `refs/heads/main ${head} refs/heads/main ${'0'.repeat(40)}\n`,
      )
      expect(result.flagged).toHaveLength(1)
      expect(result.flagged[0]).toContain('exceed the 2MB credential-scan cap')
      expect(result.oversized).toBe(1)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('skips deleted files safely (nothing to scan)', () => {
    const repo = initRepo()
    try {
      writeFileSync(path.join(repo, 'keep.txt'), 'keep\n')
      commitAll(repo, 'baseline')
      // Remove a file and add a clean one: only the addition is scanned.
      rmSync(path.join(repo, 'keep.txt'), { force: true })
      writeFileSync(path.join(repo, 'new.txt'), 'new\n')
      const head = commitAll(repo, 'delete keep, add new')

      const { materialized } = materializePushedContent(
        repo,
        head,
        commitChangedFiles(repo, head),
      )
      expect(materialized).toEqual(['new.txt'])
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })
})
