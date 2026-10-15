import { describe, expect, test } from 'bun:test'

import { runContributeGitFlow } from '../contribute'

import type { ExecFn } from '../contribute'

// FID-2026-0819-005 Loop 192: the runContributeGitFlow suite split verbatim
// from contribute.test.ts.

describe('runContributeGitFlow', () => {
  function makeFakeExec(
    calls: { cmd: string; args: string[] }[],
    overrides: { prUrl?: string; branchExists?: boolean } = {},
  ): ExecFn {
    const {
      prUrl = 'https://github.com/savant0x/savant-code/pull/1',
      branchExists = false,
    } = overrides
    return (cmd, args) => {
      calls.push({ cmd, args })
      if (
        cmd === 'git' &&
        args[0] === 'rev-parse' &&
        args[1] === '--abbrev-ref'
      ) {
        return 'main'
      }
      if (cmd === 'git' && args[0] === 'rev-parse' && args[1] === '--verify') {
        if (branchExists) return 'contribute/add-spencer'
        throw new Error('unknown revision')
      }
      if (cmd === 'git' && args[0] === 'status') return ' M CONTRIBUTORS.md'
      if (cmd === 'gh') return prUrl
      return ''
    }
  }

  test('runs checkout -b → commit → push → gh pr create and returns the URL', () => {
    const calls: { cmd: string; args: string[] }[] = []
    const prUrl = runContributeGitFlow('/repo', 'spencer', makeFakeExec(calls))

    expect(prUrl).toBe('https://github.com/savant0x/savant-code/pull/1')

    const commands = calls.map((c) => `${c.cmd} ${c.args.join(' ')}`)
    expect(commands).toContain('git rev-parse --is-inside-work-tree')
    expect(commands).toContain('git checkout -b contribute/add-spencer')
    expect(commands).toContain(
      'git commit -m docs: add @spencer as contributor -- CONTRIBUTORS.md',
    )
    expect(commands).toContain('git push -u origin contribute/add-spencer')
    expect(commands.some((c) => c.startsWith('gh pr create'))).toBe(true)
    // Returns the operator to the original branch.
    expect(commands[commands.length - 1]).toBe('git checkout main')
  })

  test('checks out an existing branch instead of creating it', () => {
    const calls: { cmd: string; args: string[] }[] = []
    runContributeGitFlow(
      '/repo',
      'spencer',
      makeFakeExec(calls, { branchExists: true }),
    )
    const commands = calls.map((c) => c.args.join(' '))
    expect(commands).toContain('checkout contribute/add-spencer')
    expect(commands).not.toContain('checkout -b contribute/add-spencer')
  })

  test('skips the commit when CONTRIBUTORS.md is already clean on the branch', () => {
    const calls: { cmd: string; args: string[] }[] = []
    const fake: ExecFn = (cmd, args) => {
      calls.push({ cmd, args })
      if (
        cmd === 'git' &&
        args[0] === 'rev-parse' &&
        args[1] === '--abbrev-ref'
      ) {
        return 'main'
      }
      if (cmd === 'git' && args[0] === 'status') return ''
      if (cmd === 'gh') return 'url'
      return ''
    }
    runContributeGitFlow('/repo', 'spencer', fake)
    const commands = calls.map((c) => c.args.join(' '))
    expect(commands).not.toContain('commit -m')
    expect(commands).toContain('push -u origin contribute/add-spencer')
  })

  test('propagates failures and still attempts to return to the original branch', () => {
    const calls: { cmd: string; args: string[] }[] = []
    const fake: ExecFn = (cmd, args) => {
      calls.push({ cmd, args })
      if (
        cmd === 'git' &&
        args[0] === 'rev-parse' &&
        args[1] === '--abbrev-ref'
      ) {
        return 'main'
      }
      if (cmd === 'git' && args[0] === 'push') {
        throw new Error('Authentication failed')
      }
      return ''
    }
    expect(() => runContributeGitFlow('/repo', 'spencer', fake)).toThrow(
      'Authentication failed',
    )
    const commands = calls.map((c) => c.args.join(' '))
    expect(commands[commands.length - 1]).toBe('checkout main')
  })
})
