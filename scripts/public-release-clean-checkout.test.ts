// FID-2026-0909-001 — self-healing clean-checkout lifecycle pins.
//
// The v0.0.30 cut incident: a failed gate run left the Temp checkout dir on
// disk (silent removal failure under Windows node_modules locks); every
// subsequent run aborted at `git worktree add` with `already exists`.
//
// Pins (RED-first, all surfaces injected — no test spawns git/bun, no real
// filesystem):
//   1. a stale checkout directory is cleared by the pre-create guard and
//      the run proceeds to `worktree add` (self-healing);
//   2. the finally-removal result is captured — a failed `git worktree
//      remove` produces a structured warning (never silent);
//   3. the filesystem fallback removes a directory that survives the git
//      removal (the incident class: git says removed, files remain);
//   4. the release-path default chain keeps the documented shape (parity).
//
// The guard is best-effort by design (FID Missed Question 2): cleanup
// failure never fails the run — it warns, and the NEXT run self-heals.

import { describe, expect, test } from 'bun:test'

import {
  cleanupCheckoutDirectory,
  ensureCheckoutDirectoryAbsent,
} from './public-release/clean-checkout'
import { assertCleanCheckoutCompiles } from './public-release/provenance'

import type { CheckoutFilesystem } from './public-release/clean-checkout'
import type { CommandRunner } from './public-release/provenance'

const HEAD = 'a'.repeat(40)

/** Memory fs adapter: tracks existence + removal calls; removals can fail. */
function memoryFs(options?: { exists?: boolean; removalFails?: boolean }): {
  fs: CheckoutFilesystem
  removals: () => number
} {
  let exists = options?.exists ?? false
  const removalFails = options?.removalFails ?? false
  let removals = 0
  return {
    fs: {
      exists: () => exists,
      remove: () => {
        removals += 1
        if (removalFails) return false
        exists = false
        return true
      },
    },
    removals: () => removals,
  }
}

/** CommandRunner keyed by its shape string; records every invocation. */
function runnerFor(
  handler: (shape: string) => {
    status: number
    stdout: string
    stderr: string
  },
): { calls: string[]; runner: CommandRunner } {
  const calls: string[] = []
  return {
    calls,
    runner: (command, args) => {
      const shape = `${command} ${args.join(' ')}`
      calls.push(shape)
      return handler(shape)
    },
  }
}

function alwaysOk(): { status: number; stdout: string; stderr: string } {
  return { status: 0, stdout: '', stderr: '' }
}

function messageOf(fn: () => unknown): string {
  try {
    fn()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  return ''
}

describe('ensureCheckoutDirectoryAbsent (FID-2026-0909-001)', () => {
  test('a stale directory is git-removed then fs-removed; removals are warned, never thrown', () => {
    const { calls, runner } = runnerFor(() => alwaysOk())
    const { fs, removals } = memoryFs({ exists: true })
    const result = ensureCheckoutDirectoryAbsent('/tmp/co', '/repo', runner, fs)
    // Guard sequence: git removal (unregister), then fs removal (the dir
    // still exists from git's perspective being unregistered).
    expect(calls).toEqual(['git worktree remove --force /tmp/co'])
    expect(removals()).toBe(1)
    expect(result.warnings).toEqual([])
  })

  test('a failing git removal still reaches the filesystem fallback', () => {
    const { calls, runner } = runnerFor(() => ({
      status: 128,
      stdout: '',
      stderr: 'fatal: not a working tree',
    }))
    const { fs, removals } = memoryFs({ exists: true })
    const result = ensureCheckoutDirectoryAbsent('/tmp/co', '/repo', runner, fs)
    expect(calls).toEqual(['git worktree remove --force /tmp/co'])
    expect(removals()).toBe(1)
    expect(result.warnings).toEqual([])
  })

  test('an absent directory triggers no removal at all', () => {
    const { calls, runner } = runnerFor(() => alwaysOk())
    const { fs, removals } = memoryFs({ exists: false })
    const result = ensureCheckoutDirectoryAbsent('/tmp/co', '/repo', runner, fs)
    expect(calls).toEqual([])
    expect(removals()).toBe(0)
    expect(result.warnings).toEqual([])
  })

  test('is best-effort: a failing fs removal warns and never throws', () => {
    const { runner } = runnerFor(() => ({
      status: 128,
      stdout: '',
      stderr: 'fatal: locked',
    }))
    const { fs } = memoryFs({ exists: true, removalFails: true })
    const result = ensureCheckoutDirectoryAbsent('/tmp/co', '/repo', runner, fs)
    expect(result.warnings.length).toBe(1)
    expect(result.warnings[0]).toContain('/tmp/co')
    expect(result.warnings[0]).toContain('rm -rf')
  })
})

describe('cleanupCheckoutDirectory (FID-2026-0909-001)', () => {
  test('a failed git removal is captured as a warning (never silent)', () => {
    const { calls, runner } = runnerFor(() => ({
      status: 128,
      stdout: '',
      stderr: 'fatal: unable to remove (locked)',
    }))
    const { fs, removals } = memoryFs({ exists: true, removalFails: true })
    const result = cleanupCheckoutDirectory('/tmp/co', '/repo', runner, fs)
    expect(calls).toEqual(['git worktree remove --force /tmp/co'])
    expect(removals()).toBe(1)
    expect(result.warnings.length).toBe(1)
    expect(result.warnings[0]).toContain('locked')
  })

  test('a directory surviving the git removal is fs-removed (fallback)', () => {
    const { calls, runner } = runnerFor(() => alwaysOk())
    // exists() keeps returning true until remove() flips it — exactly the
    // incident shape: git reports success, the files remain on disk.
    const { fs, removals } = memoryFs({ exists: true })
    const result = cleanupCheckoutDirectory('/tmp/co', '/repo', runner, fs)
    expect(calls).toEqual(['git worktree remove --force /tmp/co'])
    expect(removals()).toBe(1)
    expect(result.warnings).toEqual([])
  })

  test('an already-absent directory still unregisters the worktree (git removal always issued)', () => {
    // The finally-path git removal is the registration owner even in
    // degenerate states — it must run so `git worktree list` stays clean.
    const { calls, runner } = runnerFor(() => alwaysOk())
    const { fs, removals } = memoryFs({ exists: false })
    const result = cleanupCheckoutDirectory('/tmp/co', '/repo', runner, fs)
    expect(calls).toEqual(['git worktree remove --force /tmp/co'])
    expect(removals()).toBe(0)
    expect(result.warnings).toEqual([])
  })

  test('every failure layer contributes its warning; success contributes none', () => {
    const { runner } = runnerFor(() => alwaysOk())
    const { fs } = memoryFs({ exists: true, removalFails: true })
    const failed = cleanupCheckoutDirectory('/tmp/co', '/repo', runner, fs)
    expect(failed.warnings.length).toBe(1)
    const clean = cleanupCheckoutDirectory(
      '/tmp/co',
      '/repo',
      runner,
      memoryFs({ exists: false }).fs,
    )
    expect(clean.warnings).toEqual([])
  })
})

describe('assertCleanCheckoutCompiles — self-healing lifecycle (FID-2026-0909-001)', () => {
  function recordingRunner(): {
    calls: Array<{ command: string; args: string[]; cwd: string }>
    runner: CommandRunner
  } {
    const calls: Array<{ command: string; args: string[]; cwd: string }> = []
    return {
      calls,
      runner: (command, args, cwd) => {
        calls.push({ command, args, cwd })
        return { status: 0, stdout: '', stderr: '' }
      },
    }
  }

  test('a stale directory is self-healed before prune + add (guard runs FIRST)', () => {
    const { calls, runner } = recordingRunner()
    const { fs } = memoryFs({ exists: true })
    assertCleanCheckoutCompiles('0.0.29', HEAD, '/repo', runner, { fs })
    expect(calls[0].command).toBe('git')
    expect(calls[0].args.slice(0, 3)).toEqual(['worktree', 'remove', '--force'])
    expect(calls[1]).toMatchObject({
      command: 'git',
      args: ['worktree', 'prune'],
    })
    expect(calls[2].command).toBe('git')
    expect(calls[2].args.slice(0, 3)).toEqual(['worktree', 'add', '--detach'])
    expect(calls[2].args[4]).toBe(HEAD)
  })

  test('absent directory keeps the documented chain: prune → add → install → typecheck → remove', () => {
    const { calls, runner } = recordingRunner()
    const { fs } = memoryFs({ exists: false })
    assertCleanCheckoutCompiles('0.0.29', HEAD, '/repo', runner, { fs })
    const shapes = calls.map((c) => `${c.command} ${c.args.join(' ')}`)
    expect(shapes).toEqual([
      'git worktree prune',
      expect.stringContaining('git worktree add --detach'),
      'bun install --frozen-lockfile',
      'bun run typecheck',
      expect.stringContaining('git worktree remove --force'),
    ])
  })

  test('a gate failure still runs the finally cleanup best-effort and fails the run', () => {
    let runnerCalls = 0
    const runner: CommandRunner = (command, args) => {
      runnerCalls += 1
      if (command === 'bun' && args[0] === 'run') {
        return {
          status: 1,
          stdout: '',
          stderr: 'error TS2307: Cannot find module',
        }
      }
      return { status: 0, stdout: '', stderr: '' }
    }
    // Every removal fails (locked node_modules) — the incident environment.
    const { fs } = memoryFs({ exists: true, removalFails: true })
    const message = messageOf(() =>
      assertCleanCheckoutCompiles('0.0.29', HEAD, '/repo', runner, { fs }),
    )
    expect(message).toContain('does not compile')
    // Guard (git remove) + prune + add + install + typecheck + finally git
    // remove — cleanup attempted despite the failure, never crashing it.
    expect(runnerCalls).toBe(6)
  })

  test('an already-exists worktree add failure no longer blocks the next run', () => {
    // Reproduction of the incident: leftover dir + git refusing the add.
    // The pre-create guard removes the dir, so the add failure surface the
    // incident hit (dir present at add time) cannot recur from debris.
    const { calls, runner } = recordingRunner()
    const { fs } = memoryFs({ exists: true })
    expect(() =>
      assertCleanCheckoutCompiles('0.0.29', HEAD, '/repo', runner, { fs }),
    ).not.toThrow()
    expect(calls[0].args[0]).toBe('worktree')
    expect(calls[0].args[1]).toBe('remove')
  })
})
