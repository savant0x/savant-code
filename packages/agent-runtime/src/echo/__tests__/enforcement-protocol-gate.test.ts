// EchoEnforcement session-init protocol gate (FID-2026-0806-005) — gate
// arming, clearance, and hybrid-mode universality. Sibling of the Loop-340
// decomposition (parent: enforcement.test.ts).
import { describe, expect, it } from 'bun:test'

import { createMockAgentState } from '../../templates/__tests__/strings-test-harness'
import {
  completeGroundingReads,
  readLineWindow,
} from '../../tools/tool-executor/grounding-read'
import { EchoEnforcement } from '../enforcement'

import type { AgentState } from '@savant-code/common/types/session-state'

describe('EchoEnforcement — session-init protocol gate (FID-2026-0806-005)', () => {
  it('blocks non-read tools before the protocol file is read (strict)', () => {
    const enforcement = new EchoEnforcement('strict')
    const result = enforcement.beforeToolCall({
      toolName: 'glob',
      input: { pattern: '**/*.ts' },
      agentId: 'savant',
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('ECHO.md')
  })

  it('allows read-only context tools and ask_user/write_todos pre-read', () => {
    const enforcement = new EchoEnforcement('strict')
    for (const toolName of [
      'read_files',
      'read_subtree',
      'ask_user',
      'write_todos',
    ] as const) {
      const result = enforcement.beforeToolCall({
        toolName,
        input: toolName === 'read_files' ? { paths: ['src/a.ts'] } : {},
        agentId: 'savant',
      })
      expect(result.blocked).toBe(false)
    }
  })

  it('clears the gate when a read targets the protocol file', () => {
    const enforcement = new EchoEnforcement('strict')
    const blockedGlob = enforcement.beforeToolCall({
      toolName: 'glob',
      input: { pattern: '**/*.ts' },
      agentId: 'savant',
    })
    expect(blockedGlob.blocked).toBe(true)

    const read = enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['ECHO.md'] },
      agentId: 'savant',
    })
    expect(read.blocked).toBe(false)

    const allowedGlob = enforcement.beforeToolCall({
      toolName: 'glob',
      input: { pattern: '**/*.ts' },
      agentId: 'savant',
    })
    expect(allowedGlob.blocked).toBe(false)
  })

  it('does not accept a same-basename protocol file in another directory', () => {
    const enforcement = new EchoEnforcement('strict', {
      protocolFile: 'docs/ECHO.md',
    })
    const wrongRead = enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['other/ECHO.md'] },
      agentId: 'savant',
    })
    expect(wrongRead.blocked).toBe(false)
    const blockedGlob = enforcement.beforeToolCall({
      toolName: 'glob',
      input: { pattern: '**/*.ts' },
      agentId: 'savant',
    })
    expect(blockedGlob.blocked).toBe(true)
  })

  it('matches a nested protocol path and a configured protocol file', () => {
    const enforcement = new EchoEnforcement('strict', {
      protocolFile: 'docs/ECHO.md',
    })
    const read = enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['docs/ECHO.md'] },
      agentId: 'savant',
    })
    expect(read.blocked).toBe(false)
    const glob = enforcement.beforeToolCall({
      toolName: 'glob',
      input: { pattern: '**/*.ts' },
      agentId: 'savant',
    })
    expect(glob.blocked).toBe(false)
  })

  it('is no longer a no-op in hybrid mode (universal gate, FID-2026-0810-002)', () => {
    const enforcement = new EchoEnforcement('hybrid')
    const result = enforcement.beforeToolCall({
      toolName: 'glob',
      input: { pattern: '**/*.ts' },
      agentId: 'savant',
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('ECHO.md')
  })

  it('honors gateArmed:false as the legacy no-gate contract (SDK embedders)', () => {
    const enforcement = new EchoEnforcement('hybrid', { gateArmed: false })
    const result = enforcement.beforeToolCall({
      toolName: 'glob',
      input: { pattern: '**/*.ts' },
      agentId: 'savant',
    })
    expect(result.blocked).toBe(false)
  })

  it('clears the universal gate when a read targets the protocol file (hybrid)', () => {
    const enforcement = new EchoEnforcement('hybrid')
    expect(
      enforcement.beforeToolCall({
        toolName: 'glob',
        input: { pattern: '**/*.ts' },
        agentId: 'savant',
      }).blocked,
    ).toBe(true)

    enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['ECHO.md'] },
      agentId: 'savant',
    })

    expect(
      enforcement.beforeToolCall({
        toolName: 'glob',
        input: { pattern: '**/*.ts' },
        agentId: 'savant',
      }).blocked,
    ).toBe(false)
  })

  it('subagent-seeded instances skip the gate', () => {
    const enforcement = new EchoEnforcement('strict', {
      protocolPreSeeded: true,
    })
    const result = enforcement.beforeToolCall({
      toolName: 'glob',
      input: { pattern: '**/*.ts' },
      agentId: 'forge',
    })
    expect(result.blocked).toBe(false)
  })
})

describe('EchoEnforcement — session-init completion gate', () => {
  it('completion gate blocks an ungrounded turn end with corrective steering', () => {
    const enforcement = new EchoEnforcement('hybrid')
    const result = enforcement.evaluateUngroundedTurnEnd()
    expect(result.blocked).toBe(true)
    expect(result.steering).toContain('Session-init grounding required')
    expect(result.steering).toContain('ECHO.md')
  })

  it('completion gate passes after the protocol is read', () => {
    const enforcement = new EchoEnforcement('hybrid')
    enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['ECHO.md'] },
      agentId: 'savant',
    })
    expect(enforcement.evaluateUngroundedTurnEnd()).toEqual({ blocked: false })
  })

  it('completion gate disarms with a one-time notice after the retry cap', () => {
    const enforcement = new EchoEnforcement('hybrid')
    // The cap is 3; retries 1-3 block, the 4th exceeds the cap and disarms.
    expect(enforcement.evaluateUngroundedTurnEnd().blocked).toBe(true)
    expect(enforcement.evaluateUngroundedTurnEnd().blocked).toBe(true)
    expect(enforcement.evaluateUngroundedTurnEnd().blocked).toBe(true)
    const disarmed = enforcement.evaluateUngroundedTurnEnd()
    expect(disarmed.blocked).toBe(false)
    expect(disarmed.notice).toContain('disarmed')
    // Session-wide disarm: further ungrounded turn ends are no-ops.
    expect(enforcement.evaluateUngroundedTurnEnd()).toEqual({ blocked: false })
  })

  it('completion gate is a no-op when gateArmed is false (legacy)', () => {
    const enforcement = new EchoEnforcement('hybrid', { gateArmed: false })
    expect(enforcement.evaluateUngroundedTurnEnd()).toEqual({ blocked: false })
  })

  // FID-2026-1018-009: the live 2026-10-18 23:21 run read all four harness
  // boot files, passed `limit: 2000` on the 923-line ECHO.md, was credited
  // for only three of them, and the gate therefore blocked three times,
  // disarmed, and ended the turn with no tool call. This exercises the same
  // seam the tool executor uses (completeGroundingReads → the enforcement
  // checkpoint), not the helper alone.
  const harnessState = (): AgentState => ({
    ...createMockAgentState('savant'),
    protocolFile: 'ECHO.md',
    protocolVariant: 'harness',
  })

  const recordRead = (
    enforcement: EchoEnforcement,
    path: string,
    content: string,
    input: Record<string, unknown>,
  ): void => {
    const reads = completeGroundingReads({
      output: [{ type: 'json', value: [{ path, content }] }],
      lineWindow: readLineWindow(input),
    })
    enforcement.recordSuccessfulGroundingRead(reads.map((read) => read.path))
  }

  it('a generous limit on the protocol file still completes harness grounding', () => {
    const enforcement = new EchoEnforcement('hybrid', {
      agentState: harnessState(),
    })
    recordRead(enforcement, 'ECHO.md', '# ECHO\n'.repeat(923), {
      paths: ['ECHO.md'],
      limit: 2000,
    })
    for (const path of [
      'ARCHITECTURE.md',
      'protocol.config.yaml',
      'docs/embedded-learnings.md',
    ])
      recordRead(enforcement, path, '# brief\n', { paths: [path] })
    expect(enforcement.evaluateUngroundedTurnEnd()).toEqual({ blocked: false })
  })

  it('a limit that actually truncated the protocol file still blocks', () => {
    const enforcement = new EchoEnforcement('hybrid', {
      agentState: harnessState(),
    })
    recordRead(enforcement, 'ECHO.md', `${'# ECHO\n'.repeat(50)}\n`, {
      paths: ['ECHO.md'],
      limit: 50,
    })
    const result = enforcement.evaluateUngroundedTurnEnd()
    expect(result.blocked).toBe(true)
    expect(result.steering).toContain('Session-init grounding required')
  })
})
