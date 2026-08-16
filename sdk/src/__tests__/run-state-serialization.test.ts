import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { getStubProjectFileContext } from '@savant-code/common/util/file'
import { describe, expect, it } from 'bun:test'

import {
  deserializeRunState,
  RUN_STATE_SCHEMA_VERSION,
  serializeRunState,
} from '../run-state'

import type { RunState } from '../run-state'

function makeRunState(): RunState {
  const state = getInitialSessionState(getStubProjectFileContext())
  state.mainAgentState.activity = {
    kind: 'thinking',
    startedAt: 1,
  }
  ;(state.mainAgentState as Record<string, unknown>).activityIdleTimer =
    setTimeout(() => {}, 1)
  return {
    schemaVersion: RUN_STATE_SCHEMA_VERSION,
    traceSessionId: 'trace-1',
    sessionState: state,
    output: {
      type: 'error',
      message: 'No output yet',
    },
  }
}

describe('RunState transport serialization', () => {
  it('round-trips durable state with the current schema version', () => {
    const state = makeRunState()
    const restored = deserializeRunState(serializeRunState(state))

    expect(restored.schemaVersion).toBe(RUN_STATE_SCHEMA_VERSION)
    expect(restored.traceSessionId).toBe(state.traceSessionId)
    expect(restored.output).toEqual(state.output)
    expect(restored.sessionState?.mainAgentState.agentId).toBe('main-agent')
    expect(restored.sessionState?.mainAgentState.activity).toBeUndefined()
    expect(
      (restored.sessionState?.mainAgentState as Record<string, unknown>)
        .activityIdleTimer,
    ).toBeUndefined()
  })

  it('accepts legacy unversioned payloads and normalizes them to v1', () => {
    const state = makeRunState()
    const payload = JSON.parse(serializeRunState(state)) as Record<
      string,
      unknown
    >
    delete payload.schemaVersion

    const restored = deserializeRunState(payload)
    expect(restored.schemaVersion).toBe(1)
    expect(restored.traceSessionId).toBe('trace-1')
  })

  it('preserves checkpoints with an empty legacy protocol version', () => {
    const state = makeRunState()
    const mainAgent = state.sessionState!.mainAgentState
    mainAgent.protocolVariant = 'harness'
    mainAgent.protocolFile = 'ECHO.md'
    mainAgent.protocolSource = 'local'
    mainAgent.groundingCheckpoint = {
      schemaVersion: 1,
      gateArmed: true,
      protocolVariant: 'harness',
      protocolFile: 'echo.md',
      protocolSource: 'local',
      protocolVersion: '',
      groundingSetFingerprint: 'fingerprint',
      requiredPaths: ['echo.md'],
      completedPaths: ['echo.md'],
      fullGroundingCompleted: true,
      logicalUserTurnCount: 1,
      lastFullGroundingTurn: 1,
      lastRefreshTurn: null,
      lastRefreshReason: null,
      lastRefreshEpoch: null,
      completionGateRetries: 0,
      completionGateDisarmed: false,
    }

    const restored = deserializeRunState(serializeRunState(state))
    expect(
      restored.sessionState?.mainAgentState.groundingCheckpoint
        ?.protocolVersion,
    ).toBe('')
  })

  it('rejects unsupported schema versions and malformed output', () => {
    const state = makeRunState()
    const payload = JSON.parse(serializeRunState(state)) as Record<
      string,
      unknown
    >

    expect(() =>
      deserializeRunState({ ...payload, schemaVersion: 999 }),
    ).toThrow('Unsupported RunState schema version')
    expect(() =>
      deserializeRunState({ ...payload, output: { type: 'unknown' } }),
    ).toThrow('RunState output does not match')
  })

  it('rejects malformed nested subagent checkpoints', () => {
    const state = makeRunState()
    state.sessionState!.mainAgentState.subagents = [
      { groundingCheckpoint: { schemaVersion: 1 } } as never,
    ]

    expect(() => deserializeRunState(serializeRunState(state))).toThrow(
      'RunState groundingCheckpoint.protocolFile',
    )
  })

  it('omits function-valued transport fields without changing the source', () => {
    const state = makeRunState()
    const agentState = state.sessionState!.mainAgentState as Record<
      string,
      unknown
    >
    agentState.runtimeOnlyHandler = () => 'not durable'

    const encoded = serializeRunState(state)
    expect(encoded).not.toContain('runtimeOnlyHandler')
    expect(agentState.runtimeOnlyHandler).toBeDefined()
    clearTimeout(agentState.activityIdleTimer as ReturnType<typeof setTimeout>)
  })

  it('FID-2026-0815-015: omits the provenance session instance from the transport', () => {
    const state = makeRunState()
    ;(
      state.sessionState!.mainAgentState as Record<string, unknown>
    ).provenance = {
      finalize: () => Promise.resolve(),
      manifest: { internal: true },
    }

    const encoded = serializeRunState(state)
    expect(encoded).not.toContain('provenance')
    // The in-memory instance is untouched on the source object.
    expect(
      (state.sessionState!.mainAgentState as Record<string, unknown>)
        .provenance,
    ).toBeDefined()
    clearTimeout(
      state.sessionState!.mainAgentState.activityIdleTimer as ReturnType<
        typeof setTimeout
      >,
    )
  })
})
