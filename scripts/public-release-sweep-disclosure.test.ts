// Automation-commit sweep disclosure.
//
// `commitAllAutomationChanges` runs `git add --all` over the whole worktree, so
// a path that was never committed enters the release commit unless the pipeline
// says its name. These pins hold that disclosure to the evidence actually read:
// the `-z` status form (a quoted path never equals the staged path it is
// compared against), and no warning at all when the sweep only edits files the
// release already contains.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, spyOn, test } from 'bun:test'

import { commitAllAutomationChanges } from './public-release'

describe('automation release commit — never-committed disclosure', () => {
  test('names every never-committed file an automation commit sweeps in', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'savant-release-new-'))
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
      // One plain path and one git would quote in the non-`-z` status form:
      // a quoted path never equals the staged path it is compared against.
      mkdirSync(path.join(repo, 'dir with spaces'))
      writeFileSync(path.join(repo, 'dir with spaces', 'file name.txt'), 'x')
      writeFileSync(path.join(repo, 'scratch-note.txt'), 'y')

      const warn = spyOn(console, 'warn').mockImplementation(() => {})
      let warnings: string[] = []
      try {
        expect(commitAllAutomationChanges(repo, '0.0.34').files).toEqual([
          'dir with spaces/file name.txt',
          'scratch-note.txt',
        ])
      } finally {
        warnings = warn.mock.calls.map((call) => String(call[0]))
        warn.mockRestore()
      }

      const disclosure = warnings.join('\n')
      expect(disclosure).toContain('never-committed')
      expect(disclosure).toContain('dir with spaces/file name.txt')
      expect(disclosure).toContain('scratch-note.txt')
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test('discloses nothing when the sweep only edits already-committed files', () => {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'savant-release-edit-'))
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
      writeFileSync(path.join(repo, 'tracked.txt'), 'edited')

      const warn = spyOn(console, 'warn').mockImplementation(() => {})
      let warnings: string[] = []
      try {
        expect(commitAllAutomationChanges(repo, '0.0.34').files).toEqual([
          'tracked.txt',
        ])
      } finally {
        warnings = warn.mock.calls.map((call) => String(call[0]))
        warn.mockRestore()
      }

      expect(warnings.join('\n')).not.toContain('never-committed')
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })
})
