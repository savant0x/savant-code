import { spawnSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import { materializePushedContent, runPrePushSecretScan } from './pre-push-scan'

// Over-cap/pin coverage for the pre-push scan (FID-2026-1016-002), split from
// pre-push-scan.test.ts when the combined suite passed the 300-line quality
// ceiling (scripts/quality-report.ts). Fixtures and budgets are shared
// verbatim with the parent suite.

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

describe('pre-push scan pin exemptions', () => {
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
  }, 30_000)

  test('pins can exempt a vendored over-cap blob from the refusal', () => {
    const repo = initRepo()
    try {
      writeFileSync(
        path.join(repo, 'big.bin'),
        Buffer.alloc(2 * 1024 * 1024 + 1),
      )
      const head = commitAll(repo, 'big blob')
      const blobSha = git(repo, ['rev-parse', 'HEAD:big.bin']).trim()
      const pins = [{ path: 'big.bin', blobSha, size: 2 * 1024 * 1024 + 1 }]

      const { materialized, oversized, pinnedExcluded } =
        materializePushedContent(repo, head, ['big.bin'], pins)
      expect(materialized).toEqual([])
      expect(oversized).toBe(0)
      expect(pinnedExcluded).toEqual(['big.bin'])

      const result = runPrePushSecretScan(
        repo,
        `refs/heads/main ${head} refs/heads/main ${'0'.repeat(40)}\n`,
        pins,
      )
      expect(result.flagged).toEqual([])
      expect(result.oversized).toBe(0)
      expect(result.pinnedExcluded).toBe(1)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  }, 30_000)

  test('a swapped blob at a pinned path still fails closed', () => {
    const repo = initRepo()
    try {
      writeFileSync(
        path.join(repo, 'big.bin'),
        Buffer.alloc(2 * 1024 * 1024 + 1),
      )
      const head = commitAll(repo, 'big blob')
      const swappedPins = [
        {
          path: 'big.bin',
          blobSha: 'f'.repeat(40),
          size: 2 * 1024 * 1024 + 1,
        },
      ]

      const { oversized, pinnedExcluded } = materializePushedContent(
        repo,
        head,
        ['big.bin'],
        swappedPins,
      )
      expect(oversized).toBe(1)
      expect(pinnedExcluded).toEqual([])
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  }, 30_000)
})
