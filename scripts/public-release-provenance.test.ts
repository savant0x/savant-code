// FID-2026-0906-003 — release-provenance guard tests.
//
// RED-first pins for two of the three unguarded provenance surfaces the
// v0.0.29 phantom-source incident exposed (the third — the desktop
// `head_sha` bypass — is pinned in public-release-desktop.test.ts):
//   1. index-state blindness — assume-unchanged/skip-worktree files are
//      invisible to `git status`, so every status-based guard passes while
//      real source is silently excluded from commits;
//   2. no committed-tree compile proof — every gate runs against the
//      worktree, which is exactly the state that lied on release night.
// All command surfaces are injectable — no test spawns git or bun.

import { describe, expect, test } from 'bun:test'

import {
  assertCleanCheckoutCompiles,
  assertNoHiddenTrackedFiles,
  HIDDEN_INDEX_TAGS,
  parseGitLsFilesVerbose,
  type CommandRunner,
} from './public-release/provenance'

/** Captures a sync throw's message (the guards are sync like the pipeline). */
function messageOf(fn: () => unknown): string {
  try {
    fn()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  return ''
}

function runnerOf(output: string, status = 0): CommandRunner {
  return () => ({ status, stdout: output, stderr: '' })
}

describe('parseGitLsFilesVerbose (FID-2026-0906-003)', () => {
  test('skip-worktree (S) and every lowercase tag are hidden; uppercase states visible', () => {
    const lines = [
      'H src/cached.ts',
      'S src/skip-worktree.ts',
      'h src/assume-unchanged.ts',
      's src/assume-lower-s.ts',
      'm src/assume-unmerged.ts',
      'r src/assume-removed.ts',
      'c src/assume-changed.ts',
      'k src/assume-kill.ts',
      'f src/assume-fsmonitor.ts',
      'u src/assume-unresolved.ts',
      'M src/unmerged-visible.ts',
      'R src/removed-visible.ts',
      'C src/changed-visible.ts',
      'K src/kill-visible.ts',
    ]
    const parsed = parseGitLsFilesVerbose(lines.join('\n'))
    expect(parsed.hidden.map(({ path }) => path).sort()).toEqual([
      'src/assume-changed.ts',
      'src/assume-fsmonitor.ts',
      'src/assume-kill.ts',
      'src/assume-lower-s.ts',
      'src/assume-removed.ts',
      'src/assume-unchanged.ts',
      'src/assume-unmerged.ts',
      'src/assume-unresolved.ts',
      'src/skip-worktree.ts',
    ])
    expect(parsed.visible.map(({ path }) => path).sort()).toEqual([
      'src/cached.ts',
      'src/changed-visible.ts',
      'src/kill-visible.ts',
      'src/removed-visible.ts',
      'src/unmerged-visible.ts',
    ])
  })

  test('HIDDEN_INDEX_TAGS is the documented git index-state set', () => {
    expect([...HIDDEN_INDEX_TAGS].sort()).toEqual(
      ['S', 'h', 's', 'm', 'r', 'c', 'k', 'f', 'u'].sort(),
    )
  })

  test('preserves each hidden file tag so the remediation is exact', () => {
    const parsed = parseGitLsFilesVerbose('S a.ts\nh b.ts')
    expect(parsed.hidden).toEqual([
      { tag: 'S', path: 'a.ts' },
      { tag: 'h', path: 'b.ts' },
    ])
  })

  test('tolerates CRLF output and blank lines', () => {
    const parsed = parseGitLsFilesVerbose('H a.ts\r\n\r\nS b.ts\r\n')
    expect(parsed.visible.map(({ path }) => path)).toEqual(['a.ts'])
    expect(parsed.hidden.map(({ path }) => path)).toEqual(['b.ts'])
  })

  test('empty output parses to zero entries (clean tree)', () => {
    expect(parseGitLsFilesVerbose('')).toEqual({ hidden: [], visible: [] })
  })
})

describe('assertNoHiddenTrackedFiles (FID-2026-0906-003)', () => {
  test('returns silently on a fully-visible tree', () => {
    expect(() =>
      assertNoHiddenTrackedFiles('.', runnerOf('H src/clean.ts\n')),
    ).not.toThrow()
  })

  test('fails closed naming every hidden file + the exact remediation', () => {
    const message = messageOf(() =>
      assertNoHiddenTrackedFiles(
        '.',
        runnerOf('S src/skip.ts\nh src/assume.ts\nH src/clean.ts'),
      ),
    )
    expect(message).toContain('src/skip.ts')
    expect(message).toContain('src/assume.ts')
    expect(message).toContain('(skip-worktree)')
    expect(message).toContain('(assume-unchanged)')
    expect(message).not.toContain('src/clean.ts')
    expect(message).toContain('--no-skip-worktree')
    expect(message).toContain('--no-assume-unchanged')
  })

  test('fails closed when git itself fails (cannot prove uniformity)', () => {
    const message = messageOf(() =>
      assertNoHiddenTrackedFiles('.', () => ({
        status: 128,
        stdout: '',
        stderr: 'fatal: not a git repository',
      })),
    )
    expect(message).toMatch(/Unable to inspect tracked-file index state/)
  })
})

describe('assertCleanCheckoutCompiles (FID-2026-0906-003)', () => {
  function recordingRunner(status = 0): {
    calls: Array<{ command: string; args: string[]; cwd: string }>
    runner: CommandRunner
  } {
    const calls: Array<{ command: string; args: string[]; cwd: string }> = []
    return {
      calls,
      runner: (command, args, cwd) => {
        calls.push({ command, args, cwd })
        return { status, stdout: '', stderr: '' }
      },
    }
  }

  test('prunes, adds the detached worktree at HEAD, installs, typechecks, removes', async () => {
    const { calls, runner } = recordingRunner()
    await assertCleanCheckoutCompiles('0.0.29', 'a'.repeat(40), '/repo', runner)
    expect(
      calls.map(({ command, args, cwd }) => ({ command, args, cwd })),
    ).toEqual([
      { command: 'git', args: ['worktree', 'prune'], cwd: '/repo' },
      {
        command: 'git',
        args: [
          'worktree',
          'add',
          '--detach',
          expect.stringContaining('savant-release-checkout-v0.0.29'),
          'a'.repeat(40),
        ],
        cwd: '/repo',
      },
      {
        command: 'bun',
        args: ['install', '--frozen-lockfile'],
        cwd: expect.stringContaining('savant-release-checkout-v0.0.29'),
      },
      { command: 'bun', args: ['run', 'typecheck'], cwd: expect.any(String) },
      {
        command: 'git',
        args: ['worktree', 'remove', '--force', expect.any(String)],
        cwd: '/repo',
      },
    ])
  })

  test('fails closed on a committed-tree compile error, citing the worktree output', () => {
    let calls = 0
    const runner: CommandRunner = (command, args) => {
      calls += 1
      // 1 prune, 2 add, 3 install, 4 typecheck
      if (command === 'bun' && args[0] === 'run') {
        return {
          status: 1,
          stdout: '',
          stderr: 'error TS2307: Cannot find module',
        }
      }
      return { status: 0, stdout: '', stderr: '' }
    }
    const message = messageOf(() =>
      assertCleanCheckoutCompiles('0.0.29', 'a'.repeat(40), '/repo', runner),
    )
    expect(message).toMatch(/Clean checkout compile proof failed/)
    expect(message).toContain('error TS2307: Cannot find module')
    // Cleanup ran despite the failure: prune + add + install + typecheck
    // + remove.
    expect(calls).toBe(5)
  })

  test('fails closed when the worktree cannot be created (unprovable tree)', () => {
    const runner: CommandRunner = (command, args) => {
      if (args[0] === 'worktree' && args[1] === 'add') {
        return {
          status: 128,
          stdout: '',
          stderr: 'fatal: already registered',
        }
      }
      return { status: 0, stdout: '', stderr: '' }
    }
    const message = messageOf(() =>
      assertCleanCheckoutCompiles('0.0.29', 'a'.repeat(40), '/repo', runner),
    )
    expect(message).toMatch(/Unable to create the clean checkout/)
    expect(message).toContain('fatal: already registered')
  })
})
