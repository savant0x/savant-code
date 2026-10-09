import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { getOrCreateEnforcement } from '../../../../echo/enforcement/factory'
import { handleTransitionPhase } from '../transition-phase'

import type {
  AgentState,
  FsmPhase,
} from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'

function callTransition(
  currentPhase: FsmPhase | undefined,
  phase: FsmPhase,
  fileContext: Pick<ProjectFileContext, 'cwd'> & { devMode?: boolean },
) {
  return handleTransitionPhase({
    previousToolCallFinished: Promise.resolve(),
    toolCall: {
      toolCallId: 'test-call',
      toolName: 'transition_phase',
      input: { phase, reason: 'test transition' },
    },
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    agentState: { fsmPhase: currentPhase, iterationCount: 0 },
    fileContext: fileContext as ProjectFileContext,
  })
}

function getMessage(
  result: Awaited<ReturnType<typeof callTransition>>,
): string {
  const output = result.output as { type: string; value: { message: string } }[]
  return output[0].value.message
}

describe('handleTransitionPhase — ADVERSARIAL state (FID-2026-0805-004)', () => {
  let projectRoot: string

  beforeEach(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fsm-adv-test-'))
  })

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true })
  })

  it('allows audit → adversarial', async () => {
    const result = await callTransition('audit', 'adversarial', {
      cwd: projectRoot,
    })
    const message = getMessage(result)
    expect(message).toContain('audit → adversarial')
    expect(result.output).toBeDefined()
  })

  it('allows adversarial → complete (clean meta-verification)', async () => {
    const result = await callTransition('adversarial', 'complete', {
      cwd: projectRoot,
    })
    expect(getMessage(result)).toContain('adversarial → complete')
  })

  it('allows adversarial → self_correct (findings found)', async () => {
    const result = await callTransition('adversarial', 'self_correct', {
      cwd: projectRoot,
    })
    expect(getMessage(result)).toContain('adversarial → self_correct')
  })

  it('rejects adversarial → green (must route through self_correct)', async () => {
    const result = await callTransition('adversarial', 'green', {
      cwd: projectRoot,
    })
    expect(getMessage(result)).toContain('INVALID FSM transition')
  })

  it('rejects idle → adversarial (backward compatible — only reachable from audit)', async () => {
    const result = await callTransition('idle', 'adversarial', {
      cwd: projectRoot,
    })
    expect(getMessage(result)).toContain('INVALID FSM transition')
  })

  it('keeps audit → complete working when adversarial is skipped', async () => {
    const result = await callTransition('audit', 'complete', {
      cwd: projectRoot,
    })
    expect(getMessage(result)).toContain('audit → complete')
  })
})

describe('handleTransitionPhase — green → complete verification-credit guard (FID-2026-1007-015 P5)', () => {
  let projectRoot: string

  beforeEach(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fsm-p5-test-'))
  })

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true })
  })

  /**
   * P5 pins construct the enforcement layer through the same factory the
   * executor uses, keyed on the SAME agentState object the handler receives
   * — so the guard reads exactly the credit the EHEL gate granted.
   */
  function callWithCredit(
    currentPhase: FsmPhase | undefined,
    phase: FsmPhase,
    seed: 'green-run' | 'no-run' | 'write-after-run' | 'none',
  ) {
    const agentState: {
      fsmPhase?: FsmPhase
      iterationCount: number
      enforcementMode?: string
    } = { fsmPhase: currentPhase, iterationCount: 0 }
    if (seed !== 'none') {
      const enforcement = getOrCreateEnforcement(
        agentState as unknown as AgentState,
      )
      enforcement.beforeToolCall({
        toolName: 'read_files',
        input: { paths: ['ECHO.md'] },
        agentId: 'savant',
      })
      if (seed === 'green-run' || seed === 'write-after-run') {
        enforcement.afterToolCall({
          toolName: 'run_readonly_command',
          input: { command: 'bun run typecheck' },
          result: { text: 'ok' },
          commandSucceeded: true,
        })
      }
      if (seed === 'no-run' || seed === 'write-after-run') {
        enforcement.afterToolCall({
          toolName: 'write_file',
          input: { path: '/proj/src/a.ts' },
          result: { text: 'ok' },
          writeSucceeded: true,
        })
      }
    }
    return handleTransitionPhase({
      previousToolCallFinished: Promise.resolve(),
      toolCall: {
        toolCallId: 'test-call',
        toolName: 'transition_phase',
        input: { phase, reason: 'test transition' },
      },
      logger: {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      agentState,
      fileContext: { cwd: projectRoot } as ProjectFileContext,
    })
  }

  it('allows green → complete WITH verification credit (a green run followed the last write)', async () => {
    const result = await callWithCredit('green', 'complete', 'green-run')
    expect(getMessage(result)).toContain('green → complete')
  })

  it('REFUSES green → complete WITHOUT verification credit (unverified writes pending)', async () => {
    const result = await callWithCredit('green', 'complete', 'no-run')
    expect(getMessage(result)).toContain('INVALID FSM transition')
    expect(getMessage(result)).toContain('verification credit')
  })

  it('no enforcement history: a fresh state starts clean, so the edge is lawful (createEnforcementState contract)', async () => {
    // hasVerifiedSinceLastDirty initializes TRUE ("start clean") — with zero
    // dirty files there is nothing unverified, and turn-end Law 15 passes
    // identically. The guard reads the same flag, so it must agree.
    const result = await callWithCredit('green', 'complete', 'none')
    expect(getMessage(result)).toContain('green → complete')
  })

  it('a write AFTER the green run revokes credit (the edge refuses again)', async () => {
    const result = await callWithCredit('green', 'complete', 'write-after-run')
    expect(getMessage(result)).toContain('INVALID FSM transition')
  })

  it('keeps green → audit working (the lawful detour is intact)', async () => {
    const result = await callWithCredit('green', 'audit', 'none')
    expect(getMessage(result)).toContain('green → audit')
  })
})
