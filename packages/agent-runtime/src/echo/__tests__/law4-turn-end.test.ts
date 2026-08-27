/**
 * Law 4 turn-end gate coverage — FID-2026-0823-007.
 *
 * Closes the Detective zero-coverage finding: evaluateLaw4TurnEnd had no
 * tests anywhere in the repo. Contract under FID-2026-0823-007: unwired
 * features BLOCK the turn end in EVERY execution mode (immutable law);
 * verified or empty feature sets pass cleanly.
 */
import { describe, expect, it } from 'bun:test'

import { EchoEnforcement } from '../enforcement'
import { createEnforcementState } from '../enforcement-state'
import { evaluateLaw4TurnEnd } from '../law4-turn-end'

describe('evaluateLaw4TurnEnd — universal hard block (FID-2026-0823-007)', () => {
  function run(tier: 'core_4' | 'all_15') {
    const state = createEnforcementState()
    state.featuresWired.add('src/feature.ts#newHelper')
    return {
      state,
      result: evaluateLaw4TurnEnd({
        state,
        mode: tier === 'all_15' ? 'strict' : 'hybrid',
        tier,
      }),
    }
  }

  it('BLOCKS in hybrid mode when a wired feature has no caller grep', () => {
    const { result } = run('core_4')
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('Law 4')
    expect(result.reason).toContain('wired but not verified')
    expect(result.warnings.some((w) => w.law === 4)).toBe(true)
  })

  it('BLOCKS in strict mode identically', () => {
    const { result } = run('all_15')
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('Law 4')
  })

  it('names every unwired feature in the reason', () => {
    const state = createEnforcementState()
    state.featuresWired.add('a.ts#f1')
    state.featuresWired.add('b.ts#f2')
    state.featuresVerified.add('a.ts#f1')
    const result = evaluateLaw4TurnEnd({
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('1 feature(s)')
    expect(result.reason).toContain('b.ts#f2')
    expect(result.reason).not.toContain('a.ts#f1')
  })

  it('passes cleanly when every wired feature was caller-verified', () => {
    const state = createEnforcementState()
    state.featuresWired.add('a.ts#f1')
    state.featuresVerified.add('a.ts#f1')
    const result = evaluateLaw4TurnEnd({
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(result.blocked).toBe(false)
  })

  it('passes cleanly with no wired features at all', () => {
    const state = createEnforcementState()
    const result = evaluateLaw4TurnEnd({
      state,
      mode: 'strict',
      tier: 'all_15',
    })
    expect(result.blocked).toBe(false)
  })
})

describe('Law 4 credit channel — run_readonly_command greps (hybrid deadlock fix)', () => {
  /** Wire one feature exactly as the tracking layer does: a successful
   *  write_file whose payload carries an export statement. */
  function wiredEnforcement(): EchoEnforcement {
    const enf = new EchoEnforcement('hybrid')
    enf.afterToolCall({
      toolName: 'write_file',
      input: { path: '/proj/src/feature.ts' },
      result: {},
      writtenContent: 'export const helper = 1\n',
      writeSucceeded: true,
    })
    return enf
  }

  it('run_readonly_command grep credits featuresVerified (turn end passes)', () => {
    const enf = wiredEnforcement()
    expect(enf.evaluateTurnEnd().blocked).toBe(true)
    enf.afterToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'grep -rn "helper" packages/agent-runtime/src' },
      result: {},
    })
    expect(enf.evaluateTurnEnd().blocked).toBe(false)
  })

  it('run_readonly_command without grep/find does NOT credit', () => {
    const enf = wiredEnforcement()
    enf.afterToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'ls packages/agent-runtime/src' },
      result: {},
    })
    expect(enf.evaluateTurnEnd().blocked).toBe(true)
  })

  it('code_search pattern containing grep still credits (existing contract)', () => {
    const enf = wiredEnforcement()
    enf.afterToolCall({
      toolName: 'code_search',
      input: { pattern: 'grep for callers of helper' },
      result: {},
    })
    expect(enf.evaluateTurnEnd().blocked).toBe(false)
  })

  it('commands-array grep credits featuresVerified (FID-2026-0824-001)', () => {
    const enf = wiredEnforcement()
    enf.afterToolCall({
      toolName: 'run_readonly_command',
      input: {
        commands: [
          'bun run --cwd=common typecheck',
          'grep -rn "helper" packages/agent-runtime/src',
        ],
      },
      result: {},
    })
    expect(enf.evaluateTurnEnd().blocked).toBe(false)
  })

  it('commands-array without grep/find does NOT credit', () => {
    const enf = wiredEnforcement()
    enf.afterToolCall({
      toolName: 'run_readonly_command',
      input: { commands: ['ls -la', 'git status'] },
      result: {},
    })
    expect(enf.evaluateTurnEnd().blocked).toBe(true)
  })

  it('batch takes precedence over an ignored singular command', () => {
    // The tool schema: "When provided, `command` is ignored" — so a
    // verification-named singular next to a plain batch must NOT credit.
    const enf = wiredEnforcement()
    enf.afterToolCall({
      toolName: 'run_readonly_command',
      input: {
        command: 'grep -rn "helper" src',
        commands: ['ls -la'],
      },
      result: {},
    })
    expect(enf.evaluateTurnEnd().blocked).toBe(true)
  })
})

describe('Law 3 credit channel — run_readonly_command commands arrays (FID-2026-0824-001)', () => {
  /** Create one dirty file exactly as the tracking layer does. */
  function dirtyEnforcement(): EchoEnforcement {
    const enf = new EchoEnforcement('hybrid')
    enf.afterToolCall({
      toolName: 'write_file',
      input: { path: '/proj/src/mod.ts' },
      result: {},
      writtenContent: 'export const value = 1\n',
      writeSucceeded: true,
    })
    return enf
  }

  it('commands-array typecheck entry credits verifiedFiles (Law 3)', () => {
    const enf = dirtyEnforcement()
    expect(enf.getState().verifiedFiles.has('/proj/src/mod.ts')).toBe(false)
    enf.afterToolCall({
      toolName: 'run_readonly_command',
      input: { commands: ['git status', 'bun run --cwd=common typecheck'] },
      result: {},
    })
    expect(enf.getState().verifiedFiles.has('/proj/src/mod.ts')).toBe(true)
  })

  it('commands-array without verification entries does NOT credit', () => {
    const enf = dirtyEnforcement()
    enf.afterToolCall({
      toolName: 'run_readonly_command',
      input: { commands: ['ls -la', 'cat README.md'] },
      result: {},
    })
    expect(enf.getState().verifiedFiles.has('/proj/src/mod.ts')).toBe(false)
  })

  it('singular command keeps crediting (regression guard)', () => {
    const enf = dirtyEnforcement()
    enf.afterToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'bun run --cwd=common typecheck' },
      result: {},
    })
    expect(enf.getState().verifiedFiles.has('/proj/src/mod.ts')).toBe(true)
  })

  it('run_terminal_command batch form also credits (same extractor)', () => {
    const enf = dirtyEnforcement()
    enf.afterToolCall({
      toolName: 'run_terminal_command',
      input: { commands: ['bun test src/'] },
      result: {},
    })
    expect(enf.getState().verifiedFiles.has('/proj/src/mod.ts')).toBe(true)
  })
})
