import { spawnSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import { commitWatermarkLines, runPrePushSecretScan } from './pre-push-scan'

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

describe('commit-message watermark scan', () => {
  test('pure helper flags both known agent trailer lines', () => {
    expect(
      commitWatermarkLines(
        'feat: thing\n\nDetails.\n🤖 Generated with Codebuff\nCo-Authored-By: Codebuff <noreply@codebuff.com>',
      ),
    ).toEqual([
      '🤖 Generated with Codebuff',
      'Co-Authored-By: Codebuff <noreply@codebuff.com>',
    ])
    expect(
      commitWatermarkLines(
        'feat: thing\n\nCo-Authored-By: CommandCodeBot <bot@commandcode.ai>',
      ),
    ).toEqual(['Co-Authored-By: CommandCodeBot <bot@commandcode.ai>'])
  })

  test('pure helper allows legitimate co-authors and prose mentions', () => {
    expect(
      commitWatermarkLines(
        'feat: thing\n\nCo-Authored-By: Jane Doe <jane@example.com>',
      ),
    ).toEqual([])
    expect(
      commitWatermarkLines(
        'docs: record the co-author guard\n\nThe policy bans coding-agent attribution\nwatermarks on this repository.',
      ),
    ).toEqual([])
  })

  test('end-to-end: a trailered commit in the pushed range blocks the push', () => {
    const repo = initRepo()
    try {
      writeFileSync(path.join(repo, 'ok.ts'), 'export const x = 1\n')
      const base = commitAll(repo, 'baseline')
      writeFileSync(path.join(repo, 'ok2.ts'), 'export const y = 2\n')
      const head = commitAll(
        repo,
        'feat: add y\n\n🤖 Generated with Codebuff\nCo-Authored-By: Codebuff <noreply@codebuff.com>',
      )

      const result = runPrePushSecretScan(
        repo,
        `refs/heads/main ${head} refs/heads/main ${base}\n`,
      )
      expect(result.flagged.some((entry) => entry.includes('watermark'))).toBe(
        true,
      )
      expect(result.flagged[0]).toContain('Codebuff')
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('end-to-end: clean messages push without watermark flags', () => {
    const repo = initRepo()
    try {
      writeFileSync(path.join(repo, 'ok.ts'), 'export const x = 1\n')
      const base = commitAll(repo, 'baseline')
      writeFileSync(path.join(repo, 'ok2.ts'), 'export const y = 2\n')
      const head = commitAll(
        repo,
        'feat: clean add\n\nCo-Authored-By: Jane Doe <jane@example.com>',
      )

      const result = runPrePushSecretScan(
        repo,
        `refs/heads/main ${head} refs/heads/main ${base}\n`,
      )
      expect(
        result.flagged.filter((entry) => entry.includes('watermark')),
      ).toEqual([])
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })
})
