// EchoEnforcement protocol-refresh cadence — logical-turn counter, step
// backstop, compaction and history-replacement refreshes. Sibling of the
// Loop-340 decomposition (parent: enforcement.test.ts).
import { describe, expect, it } from 'bun:test'

import { EchoEnforcement } from '../enforcement'

describe('EchoEnforcement — protocol refresh cadence', () => {
  it('injects a protocol refresh after five completed logical turns', () => {
    const enforcement = new EchoEnforcement('strict')
    for (const path of [
      'ECHO.md',
      'ARCHITECTURE.md',
      'protocol.config.yaml',
      'dev/LEARNINGS.md',
    ]) {
      enforcement.beforeToolCall({
        toolName: 'read_files',
        input: { paths: [path] },
        agentId: 'savant',
      })
      enforcement.recordSuccessfulGroundingRead([path])
    }

    let refresh: string | undefined
    for (let i = 1; i <= 5; i++) {
      refresh = enforcement.recordLogicalUserTurn().refreshText
    }
    expect(refresh).toBeDefined()
    expect(refresh).toContain('<!--echo-critical-->')
    expect(refresh).toContain('Read 0-EOF')
    expect(enforcement.recordLogicalUserTurn().refreshText).toBeUndefined()
  })

  it('does not refresh before the protocol is read', () => {
    const enforcement = new EchoEnforcement('strict')
    let refresh: string | undefined
    for (let i = 1; i <= 15; i++) {
      refresh = enforcement.onStepBoundary().refreshText
    }
    expect(refresh).toBeUndefined()
  })

  it('allows the internal backstop during the first long turn after cadence refresh', () => {
    const enforcement = new EchoEnforcement('strict')
    enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['ECHO.md'] },
      agentId: 'savant',
    })

    for (let i = 0; i < 5; i++) {
      enforcement.recordLogicalUserTurn()
    }

    let refresh: string | undefined
    for (let i = 0; i < 12; i++) {
      refresh = enforcement.onStepBoundary().refreshText
    }
    expect(refresh).toContain('<!--echo-critical-->')
  })

  it('rejects duplicate paths in a persisted grounding checkpoint', () => {
    const agentState = {
      agentId: 'main',
      protocolVariant: 'harness',
      protocolFile: 'ECHO.md',
      protocolSource: 'local',
      protocolVersion: '0.2.0',
      groundingCheckpoint: {
        schemaVersion: 1,
        gateArmed: true,
        protocolVariant: 'harness',
        protocolFile: 'echo.md',
        protocolSource: 'local',
        protocolVersion: '0.2.0',
        groundingSetFingerprint: 'not-used',
        requiredPaths: ['echo.md', 'echo.md'],
        completedPaths: ['echo.md', 'echo.md'],
        fullGroundingCompleted: true,
        logicalUserTurnCount: 0,
        lastFullGroundingTurn: null,
        lastRefreshTurn: null,
        lastRefreshReason: null,
        lastRefreshEpoch: null,
        completionGateRetries: 0,
        completionGateDisarmed: false,
      },
    } as never
    const enforcement = new EchoEnforcement('hybrid', {
      agentState,
      gateArmed: true,
    })
    expect(enforcement.getState().protocolRead).toBe(false)
  })

  it('delivers a fresh refresh after history replacement even after pre-compaction refresh', () => {
    const enforcement = new EchoEnforcement('strict')
    for (const path of [
      'ECHO.md',
      'ARCHITECTURE.md',
      'protocol.config.yaml',
      'dev/LEARNINGS.md',
    ]) {
      enforcement.beforeToolCall({
        toolName: 'read_files',
        input: { paths: [path] },
        agentId: 'savant',
      })
      enforcement.recordSuccessfulGroundingRead([path])
    }
    expect(enforcement.recordCompaction().refreshText).toBeDefined()
    expect(enforcement.recordHistoryReplacement().refreshText).toContain(
      '<!--echo-critical-->',
    )
  })

  it('requests an idempotent refresh for compaction', () => {
    const enforcement = new EchoEnforcement('strict')
    for (const path of [
      'ECHO.md',
      'ARCHITECTURE.md',
      'protocol.config.yaml',
      'dev/LEARNINGS.md',
    ]) {
      enforcement.beforeToolCall({
        toolName: 'read_files',
        input: { paths: [path] },
        agentId: 'savant',
      })
      enforcement.recordSuccessfulGroundingRead([path])
    }
    const first = enforcement.recordCompaction().refreshText
    const second = enforcement.recordCompaction().refreshText
    expect(first).toContain('<!--echo-critical-->')
    expect(second).toBeUndefined()
  })
})
