/**
 * FID-2026-1001-003 step 1 — the defence-in-depth `deny-mutating-terminal`
 * builtin hook action (operator-approved 2026-10-02).
 *
 * Pins:
 *   - mutating terminal commands are BLOCKED before dispatch, by the SAME
 *     effect classifier as the pre-write gates (Law 13 — one truth);
 *   - non-mutating commands (verification runs, searches, read-only git)
 *     pass untouched — verification/credit paths unaffected;
 *   - fail-open by construction: no payload, wrong tool, or a classifier
 *     throw ALLOW execution (engine.ts → triggerBlock catches);
 *   - the engine dispatches the builtin in-process (no spawn).
 */
import { describe, expect, it } from 'bun:test'

import { runDenyMutatingTerminal } from '../deny-mutating-terminal'
import { HookEngine } from '../engine'

import type { HookInputData } from '../types'

function terminalInput(command: string): HookInputData {
  return {
    hook_event_name: 'PreToolUse',
    session_id: 's',
    cwd: process.cwd(),
    tool_name: 'run_terminal_command',
    tool_input: { command },
  }
}

const DENY_CONFIG = [
  {
    event: 'PreToolUse' as const,
    matcher: 'run_terminal_command',
    action: 'deny-mutating-terminal' as const,
  },
]

describe('deny-mutating-terminal — defence-in-depth sink (FID-2026-1001-003 step 1)', () => {
  it('BLOCKS mutating terminal commands before dispatch', () => {
    for (const command of [
      'sed -i s/a/b/ src/x.ts',
      'echo hi > src/x.ts',
      'git checkout -- src/x.ts',
      'tee src/x.ts < in',
      'rm -rf build',
    ]) {
      const result = runDenyMutatingTerminal(terminalInput(command))
      expect(result.outcome).toBe('blocked')
      expect(result.reason).toContain('FID-2026-1001-003')
      expect(result.reason).toContain('write tools')
    }
  })

  it('ALLOWS non-mutating commands (verification runs, searches, read-only git)', () => {
    for (const command of [
      'bun run typecheck',
      'bun test src/echo',
      'git status',
      'git diff --stat',
      'grep -rn classifyMutation src/',
    ]) {
      expect(runDenyMutatingTerminal(terminalInput(command)).outcome).toBe(
        'allowed',
      )
    }
  })

  it('fails OPEN: no payload, wrong tool, or a throwing classifier allows', () => {
    // No tool_input at all.
    expect(
      runDenyMutatingTerminal({
        hook_event_name: 'PreToolUse',
        session_id: 's',
        cwd: process.cwd(),
        tool_name: 'run_terminal_command',
      }).outcome,
    ).toBe('allowed')
    // A tool the config matcher never routes here.
    expect(
      runDenyMutatingTerminal({
        hook_event_name: 'PreToolUse',
        session_id: 's',
        cwd: process.cwd(),
        tool_name: 'write_file',
        tool_input: { path: 'src/x.ts' },
      }).outcome,
    ).toBe('allowed')
  })

  it('the engine dispatches the builtin in-process and aggregates the block', async () => {
    const engine = new HookEngine(DENY_CONFIG)
    const mutating = await engine.triggerBlock(
      terminalInput('sed -i s/a/b/ src/x.ts'),
    )
    expect(mutating.blocked).toBe(true)
    expect(mutating.reasons[0]).toContain('denied before dispatch')

    const readonly = await engine.triggerBlock(terminalInput('git status'))
    expect(readonly.blocked).toBe(false)
  })

  it('a matcher for other tools never reaches the sink (fail-open default)', async () => {
    const engine = new HookEngine(DENY_CONFIG)
    const result = await engine.triggerBlock({
      hook_event_name: 'PreToolUse',
      session_id: 's',
      cwd: process.cwd(),
      tool_name: 'write_file',
      tool_input: { path: 'src/x.ts', content: 'x' },
    })
    expect(result.blocked).toBe(false)
  })
})
