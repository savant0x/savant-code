// FID-2026-0907-002 (Step 4) — verify-clean tests.
// Arg parsing and runner-call-sequence contracts with an injected mock
// runner — no test spawns git or bun (the public-release-provenance
// pattern). The live clean-room proof is the command's own exit-0 run.

import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { parseVerifyCleanArgs, runVerifyClean } from '../verify-clean'

import type { CommandRunner } from '../public-release/provenance'

// runVerifyClean resolves the product version from the repo's VERSION file
// (a real read); tests use the actual repo root — the mock runner still
// never spawns git or bun.
const REPO_ROOT = path.resolve(import.meta.dir, '..', '..')

function messageOf(fn: () => unknown): string {
  try {
    fn()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  return ''
}

/** Always-succeeding runner recording every invocation. */
function recordingRunner(cwd = '/root'): {
  calls: Array<{ command: string; args: string[]; cwd: string }>
  runner: CommandRunner
} {
  const calls: Array<{ command: string; args: string[]; cwd: string }> = []
  const runner: CommandRunner = (command, args, runCwd) => {
    calls.push({ command, args, cwd: runCwd })
    return { status: 0, stdout: 'abc123def\n', stderr: '' }
  }
  void cwd
  return { calls, runner }
}

describe('parseVerifyCleanArgs (FID-2026-0907-002)', () => {
  test('no args → empty (sha resolves to HEAD at run time)', () => {
    expect(parseVerifyCleanArgs([])).toEqual({})
  })

  test('--sha <ref> is captured', () => {
    expect(parseVerifyCleanArgs(['--sha', 'abc123']).sha).toBe('abc123')
  })

  test('--help and -h set help', () => {
    expect(parseVerifyCleanArgs(['--help']).help).toBe(true)
    expect(parseVerifyCleanArgs(['-h']).help).toBe(true)
  })

  test('--sha without a value fails with a named error', () => {
    const message = messageOf(() => parseVerifyCleanArgs(['--sha']))
    expect(message).toContain('--sha requires a commit ref')
  })

  test('unknown arguments fail with usage guidance', () => {
    const message = messageOf(() => parseVerifyCleanArgs(['--bogus']))
    expect(message).toContain('Unknown argument: --bogus')
    expect(message).toContain('Usage: bun scripts/verify-clean.ts')
  })
})

describe('runVerifyClean (FID-2026-0907-002)', () => {
  // FID-2026-0909-003: verify:clean's chain gained the SDK declaration
  // build (build:sdk) after the typecheck chain — the plain-TS dts surface
  // the release consumes and the typecheck chain never compiles.
  test('composes prune → worktree add → install → typecheck → build:sdk → remove, in order', () => {
    const { calls, runner } = recordingRunner()
    const result = runVerifyClean({
      sha: 'abc123def',
      root: REPO_ROOT,
      runner,
    })

    expect(result.sha).toBe('abc123def')
    expect(result.version).toMatch(/^\d+\.\d+\.\d+/)
    const shapes = calls.map((call) => `${call.command} ${call.args.join(' ')}`)
    expect(shapes[0]).toBe('git worktree prune')
    expect(shapes[1]).toContain('git worktree add --detach')
    expect(shapes[2]).toBe('bun install --frozen-lockfile')
    expect(shapes[3]).toBe('bun run typecheck')
    expect(shapes[4]).toBe('bun run build:sdk')
    expect(shapes[5]).toContain('git worktree remove --force')
    // install + typecheck + build:sdk run INSIDE the checkout; git calls
    // run at root
    expect(calls[2].cwd).toContain('savant-release-checkout')
    expect(calls[3].cwd).toContain('savant-release-checkout')
    expect(calls[4].cwd).toContain('savant-release-checkout')
    expect(calls[0].cwd).toBe(REPO_ROOT)
  })

  test('cleanup runs even when the typecheck fails', () => {
    const calls: Array<{ command: string; args: string[]; cwd: string }> = []
    const runner: CommandRunner = (command, args, runCwd) => {
      calls.push({ command, args, cwd: runCwd })
      if (command === 'bun' && args[0] === 'run') {
        return { status: 1, stdout: 'typecheck failed', stderr: '' }
      }
      return { status: 0, stdout: 'abc123def\n', stderr: '' }
    }
    const message = messageOf(() =>
      runVerifyClean({ sha: 'abc123def', root: REPO_ROOT, runner }),
    )
    expect(message).toContain('does not compile')
    const shapes = calls.map((call) => `${call.command} ${call.args.join(' ')}`)
    expect(shapes[shapes.length - 1]).toContain('git worktree remove --force')
  })

  test('default sha resolves from git rev-parse HEAD', () => {
    const calls: Array<{ command: string; args: string[]; cwd: string }> = []
    const runner: CommandRunner = (command, args, runCwd) => {
      calls.push({ command, args, cwd: runCwd })
      return { status: 0, stdout: 'feedface99\n', stderr: '' }
    }
    const result = runVerifyClean({ root: REPO_ROOT, runner })
    expect(result.sha).toBe('feedface99')
    expect(calls[0]).toMatchObject({
      command: 'git',
      args: ['rev-parse', 'HEAD'],
    })
  })

  test('an unresolvable HEAD fails closed', () => {
    const runner: CommandRunner = () => ({
      status: 128,
      stdout: '',
      stderr: 'fatal: not a git repository',
    })
    const message = messageOf(() => runVerifyClean({ root: '/root', runner }))
    expect(message).toContain('Unable to resolve HEAD')
    expect(message).toContain('not a git repository')
  })
})
