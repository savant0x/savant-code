import { spawnSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import { runPrePushSecretScan } from './pre-push-scan'

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
  test('end-to-end hook invocation fails closed on a pushed secret', () => {
    const repo = initRepo()
    try {
      writeFileSync(path.join(repo, 'ok.ts'), 'export const x = 1\n')
      const base = commitAll(repo, 'baseline')
      writeFileSync(path.join(repo, 'leak.env'), `API_KEY=${FAKE_TOKEN}\n`)
      const head = commitAll(repo, 'leaks')

      const hookScript = path.join(import.meta.dir, 'pre-push-scan.ts')
      const hook = spawnSync(process.execPath, [hookScript], {
        cwd: repo,
        input: `refs/heads/main ${head} refs/heads/main ${base}\n`,
        encoding: 'utf8',
        windowsHide: true,
      })
      expect(hook.status).toBe(1)
      expect(String(hook.stdout + hook.stderr)).toContain('leak.env')
      expect(String(hook.stdout + hook.stderr)).toContain('refusing to push')
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('end-to-end hook invocation passes on a clean push', () => {
    const repo = initRepo()
    try {
      writeFileSync(path.join(repo, 'ok.ts'), 'export const x = 1\n')
      const base = commitAll(repo, 'baseline')
      writeFileSync(path.join(repo, 'ok2.ts'), 'export const y = 2\n')
      const head = commitAll(repo, 'clean add')

      const hookScript = path.join(import.meta.dir, 'pre-push-scan.ts')
      const hook = spawnSync(process.execPath, [hookScript], {
        cwd: repo,
        input: `refs/heads/main ${head} refs/heads/main ${base}\n`,
        encoding: 'utf8',
        windowsHide: true,
      })
      expect(hook.status).toBe(0)
      expect(String(hook.stdout)).toContain('credential scan passed')
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('refuses to scan nothing when stdin is non-empty but unparseable', () => {
    const repo = initRepo()
    try {
      expect(() =>
        runPrePushSecretScan(repo, 'garbage-that-is-not-a-ref-line\n'),
      ).toThrow('unparseable pre-push ref line')
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })
})
