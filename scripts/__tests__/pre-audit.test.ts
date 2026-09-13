// FID-2026-0913-004 — pre-audit check tests. Uses real temp git repos (house
// style: pre-push-scan.test.ts) so the checks are exercised against genuine
// git state, not mocks.

import { spawnSync } from 'child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'fs'
import os from 'os'
import path from 'path'

import { afterAll, describe, expect, test } from 'bun:test'

import { releaseLockPath } from '../public-release/lock'
import {
  findTestFakesInRecord,
  isTestFakeValue,
} from '../public-release/pre-audit-config'
import {
  checkReleaseLock,
  checkStaleTag,
  checkWorktreeClean,
} from '../public-release/pre-audit-local'
import { oversizedPushedBlobs } from '../public-release/pre-audit-push'

function git(root: string, args: string[]): string {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    windowsHide: true,
    shell: false,
  })
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${String(result.stderr)}`)
  }
  return String(result.stdout ?? '')
}

const tempDirs: string[] = []

function initRepo(): string {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'savant-preaudit-'))
  tempDirs.push(repo)
  git(repo, ['init', '-q'])
  git(repo, ['config', 'user.email', 'preaudit@test.invalid'])
  git(repo, ['config', 'user.name', 'Pre-Audit Test'])
  git(repo, ['config', 'commit.gpgsign', 'false'])
  writeFileSync(path.join(repo, 'base.txt'), 'base\n')
  git(repo, ['add', '-A'])
  git(repo, ['commit', '-q', '-m', 'base'])
  return repo
}

/** A separate origin repo (a self-referential remote makes every local ref
 *  instantly "on origin", which defeats the stale-tag/push-range tests). */
function wireOrigin(repo: string): void {
  const origin = mkdtempSync(path.join(os.tmpdir(), 'savant-preaudit-origin-'))
  tempDirs.push(origin)
  git(origin, ['init', '-q', '--bare'])
  git(repo, ['remote', 'add', 'origin', origin])
  git(repo, ['push', '-q', 'origin', 'HEAD:refs/heads/main'])
}

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
})

describe('checkWorktreeClean', () => {
  test('clean tree produces no findings', () => {
    const repo = initRepo()
    const result = checkWorktreeClean(repo)
    expect(result.findings).toEqual([])
    expect(result.fixes).toEqual([])
  })

  test('telemetry-only churn is auto-fixable', () => {
    const repo = initRepo()
    mkdirSync(path.join(repo, 'dev/experiences'), { recursive: true })
    writeFileSync(path.join(repo, 'dev/experiences/raw-traces.jsonl'), '{}\n')
    git(repo, ['add', '-A'])
    git(repo, ['commit', '-q', '-m', 'telemetry'])
    writeFileSync(
      path.join(repo, 'dev/experiences/raw-traces.jsonl'),
      '{}\n{}\n',
    )

    const result = checkWorktreeClean(repo)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]?.severity).toBe('fixed')
    expect(result.fixes).toHaveLength(1)
    const message = result.fixes[0]?.()
    expect(message).toContain('committed telemetry churn')
    expect(git(repo, ['status', '--porcelain'])).toBe('')
  })

  test('non-telemetry dirt blocks', () => {
    const repo = initRepo()
    writeFileSync(path.join(repo, 'base.txt'), 'changed\n')
    const result = checkWorktreeClean(repo)
    expect(result.findings[0]?.severity).toBe('block')
    expect(result.fixes).toEqual([])
  })
})

describe('checkReleaseLock', () => {
  test('absent lock is clean', () => {
    const repo = initRepo()
    const result = checkReleaseLock(repo, '9.9.9')
    expect(result.findings).toEqual([])
  })

  test('stale lock (dead pid) is auto-fixable', () => {
    const repo = initRepo()
    const lockPath = releaseLockPath('9.9.9')
    mkdirSync(lockPath, { recursive: true })
    writeFileSync(
      path.join(lockPath, 'owner.json'),
      JSON.stringify({ pid: 999999999 }),
    )
    const result = checkReleaseLock(repo, '9.9.9')
    expect(result.findings[0]?.severity).toBe('fixed')
    expect(result.fixes).toHaveLength(1)
    result.fixes[0]?.()
    expect(existsSync(lockPath)).toBe(false)
  })

  test('live lock blocks (own pid)', () => {
    const repo = initRepo()
    const lockPath = releaseLockPath('9.9.9')
    mkdirSync(lockPath, { recursive: true })
    writeFileSync(
      path.join(lockPath, 'owner.json'),
      JSON.stringify({ pid: process.pid }),
    )
    const result = checkReleaseLock(repo, '9.9.9')
    expect(result.findings[0]?.severity).toBe('block')
    rmSync(lockPath, { recursive: true, force: true })
  })
})

describe('checkStaleTag', () => {
  test('absent tag is clean', () => {
    const repo = initRepo()
    const result = checkStaleTag(repo, '9.9.9', false)
    expect(result.findings).toEqual([])
  })

  test('local-only tag is auto-fixable in mutation mode', () => {
    const repo = initRepo()
    wireOrigin(repo)
    git(repo, ['tag', 'v9.9.9'])
    const result = checkStaleTag(repo, '9.9.9', false)
    expect(result.findings[0]?.severity).toBe('fixed')
    result.fixes[0]?.()
    expect(
      spawnSync('git', ['rev-parse', '--verify', 'refs/tags/v9.9.9'], {
        cwd: repo,
      }).status,
    ).not.toBe(0)
  })

  test('local-only tag is kept in resume mode', () => {
    const repo = initRepo()
    wireOrigin(repo)
    git(repo, ['tag', 'v9.9.9'])
    const result = checkStaleTag(repo, '9.9.9', true)
    expect(result.findings[0]?.severity).toBe('warn')
    expect(result.fixes).toEqual([])
    expect(
      spawnSync('git', ['rev-parse', '--verify', 'refs/tags/v9.9.9'], {
        cwd: repo,
      }).status,
    ).toBe(0)
    git(repo, ['tag', '-d', 'v9.9.9'])
  })

  test('tag present on origin blocks (never auto-deletes a shipped tag)', () => {
    const repo = initRepo()
    wireOrigin(repo)
    git(repo, ['tag', 'v9.9.9'])
    git(repo, ['push', '-q', 'origin', 'v9.9.9'])
    const result = checkStaleTag(repo, '9.9.9', false)
    expect(result.findings[0]?.severity).toBe('block')
    expect(result.fixes).toEqual([])
  })
})

describe('oversizedPushedBlobs', () => {
  test('detects a blob over the 2MB cap in the unpushed range', () => {
    const repo = initRepo()
    wireOrigin(repo)
    const big = Buffer.alloc(2 * 1024 * 1024 + 1, 65)
    writeFileSync(path.join(repo, 'big.bin'), big)
    git(repo, ['add', '-A'])
    git(repo, ['commit', '-q', '-m', 'big blob'])
    const oversized = oversizedPushedBlobs(repo)
    expect(oversized).toHaveLength(1)
    expect(oversized[0]?.path).toBe('big.bin')
    expect(oversized[0]?.size).toBeGreaterThan(2 * 1024 * 1024)
  })
})

describe('config-dir fake detection', () => {
  test('isTestFakeValue matches the incident values', () => {
    expect(isTestFakeValue('test-nous-key')).toBe(true)
    expect(isTestFakeValue('stored-key')).toBe(true)
    expect(isTestFakeValue('sk-or-v1-real')).toBe(false)
  })

  test('findTestFakesInRecord walks nested records', () => {
    const fakes = findTestFakesInRecord({
      providerApiKeys: {
        OPENROUTER_API_KEY: 'stored-key',
        TOKENROUTER_API_KEY: 'sk-real',
      },
      other: { nested: 'test-x' },
    })
    expect(fakes).toEqual([
      'providerApiKeys.OPENROUTER_API_KEY=<test fake>',
      'other.nested=<test fake>',
    ])
  })
})
