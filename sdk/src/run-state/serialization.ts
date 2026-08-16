import { AgentOutputSchema } from '@savant-code/common/types/session-state'

import type { RunState } from './types'
import type { SessionState } from '@savant-code/common/types/session-state'

/** Current durable RunState transport schema. */
export const RUN_STATE_SCHEMA_VERSION = 1 as const

const EPHEMERAL_KEYS = new Set([
  'activity',
  'activityIdleTimer',
  'echoCompliance',
  'provenance',
  '_echoEnforcement',
])

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function omitEphemeralAndFunctions(_key: string, value: unknown): unknown {
  if (EPHEMERAL_KEYS.has(_key) || typeof value === 'function') {
    return undefined
  }
  return value
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function normalizeCheckpointPath(value: string): string {
  return value
    .replaceAll('\\\\', '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .toLowerCase()
}

type RefreshReason =
  | 'initial'
  | 'cadence'
  | 'compaction'
  | 'contract-change'
  | 'explicit'
  | 'backstop'
  | null

function isRefreshReason(value: unknown): value is RefreshReason {
  return (
    value === null ||
    value === 'initial' ||
    value === 'cadence' ||
    value === 'compaction' ||
    value === 'contract-change' ||
    value === 'explicit' ||
    value === 'backstop'
  )
}

function validateGroundingCheckpoint(value: unknown): void {
  if (value === undefined) return
  if (!isRecord(value)) {
    throw new TypeError('RunState groundingCheckpoint must be an object')
  }

  const requiredStringFields = [
    'protocolFile',
    'protocolVersion',
    'groundingSetFingerprint',
  ] as const
  for (const field of requiredStringFields) {
    if (typeof value[field] !== 'string') {
      throw new TypeError(
        `RunState groundingCheckpoint.${field} must be a string`,
      )
    }
  }

  if (
    value.schemaVersion !== 1 ||
    value.gateArmed !== true ||
    (value.protocolVariant !== 'harness' &&
      value.protocolVariant !== 'single-agent') ||
    (value.protocolSource !== 'local' && value.protocolSource !== 'embedded') ||
    !Array.isArray(value.requiredPaths) ||
    !Array.isArray(value.completedPaths) ||
    !value.requiredPaths.every(
      (path): path is string => typeof path === 'string' && path.length > 0,
    ) ||
    !value.completedPaths.every(
      (path): path is string => typeof path === 'string' && path.length > 0,
    )
  ) {
    throw new TypeError('RunState groundingCheckpoint has an invalid contract')
  }

  const normalizedRequiredPaths = value.requiredPaths.map((path) =>
    normalizeCheckpointPath(path),
  )
  const normalizedCompletedPaths = value.completedPaths.map((path) =>
    normalizeCheckpointPath(path),
  )
  if (
    new Set(normalizedRequiredPaths).size !== normalizedRequiredPaths.length ||
    new Set(normalizedCompletedPaths).size !==
      normalizedCompletedPaths.length ||
    normalizedCompletedPaths.some(
      (path) => !normalizedRequiredPaths.includes(path),
    )
  ) {
    throw new TypeError(
      'RunState groundingCheckpoint has invalid required/completed paths',
    )
  }

  if (
    typeof value.fullGroundingCompleted !== 'boolean' ||
    !isFiniteNonNegativeNumber(value.logicalUserTurnCount) ||
    !Number.isInteger(value.logicalUserTurnCount) ||
    (value.lastFullGroundingTurn !== null &&
      (!isFiniteNonNegativeNumber(value.lastFullGroundingTurn) ||
        !Number.isInteger(value.lastFullGroundingTurn))) ||
    (value.lastRefreshTurn !== null &&
      (!isFiniteNonNegativeNumber(value.lastRefreshTurn) ||
        !Number.isInteger(value.lastRefreshTurn))) ||
    !isRefreshReason(value.lastRefreshReason) ||
    (value.lastRefreshEpoch !== null &&
      typeof value.lastRefreshEpoch !== 'string') ||
    !isFiniteNonNegativeNumber(value.completionGateRetries) ||
    !Number.isInteger(value.completionGateRetries) ||
    typeof value.completionGateDisarmed !== 'boolean' ||
    (value.internalStepsSinceRefresh !== undefined &&
      (!isFiniteNonNegativeNumber(value.internalStepsSinceRefresh) ||
        !Number.isInteger(value.internalStepsSinceRefresh))) ||
    (value.lastRefreshAtMs !== undefined &&
      value.lastRefreshAtMs !== null &&
      !isFiniteNonNegativeNumber(value.lastRefreshAtMs))
  ) {
    throw new TypeError(
      'RunState groundingCheckpoint has invalid progress fields',
    )
  }
}

function validateAgentStateCheckpoint(value: unknown): void {
  if (!isRecord(value)) {
    throw new TypeError('RunState subagent state must be an object')
  }
  validateGroundingCheckpoint(value.groundingCheckpoint)
  if (value.subagents !== undefined && !Array.isArray(value.subagents)) {
    throw new TypeError('RunState subagents must be an array')
  }
  for (const subagent of value.subagents ?? []) {
    validateAgentStateCheckpoint(subagent)
  }
}

function validateSessionState(value: unknown): SessionState | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) {
    throw new TypeError('RunState sessionState must be an object when provided')
  }
  if (!isRecord(value.fileContext) || !isRecord(value.mainAgentState)) {
    throw new TypeError(
      'RunState sessionState must contain fileContext and mainAgentState objects',
    )
  }
  validateAgentStateCheckpoint(value.mainAgentState)
  return value as unknown as SessionState
}

/**
 * Serialize only the durable RunState transport representation.
 *
 * Runtime instances, timers, trackers, and function-valued handlers are
 * intentionally omitted. In-process resume continues to use cloneSessionState
 * so function-valued definitions are preserved there.
 */
export function serializeRunState(state: RunState): string {
  if (!isRecord(state)) {
    throw new TypeError('RunState must be an object')
  }
  const serialized = JSON.stringify(
    {
      ...state,
      schemaVersion: RUN_STATE_SCHEMA_VERSION,
    },
    omitEphemeralAndFunctions,
  )
  if (serialized === undefined) {
    throw new TypeError('RunState could not be serialized')
  }
  return serialized
}

/**
 * Deserialize a durable RunState transport payload.
 *
 * Unversioned payloads are accepted as schema version 1 for compatibility with
 * existing checkpoints. Future versions fail closed rather than silently
 * dropping fields under an older runtime.
 */
export function deserializeRunState(input: string | unknown): RunState {
  let value: unknown = input
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input) as unknown
    } catch (error) {
      throw new TypeError(
        `Invalid RunState JSON: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
  if (!isRecord(value)) {
    throw new TypeError('RunState payload must be an object')
  }

  const schemaVersion = value.schemaVersion
  if (
    schemaVersion !== undefined &&
    schemaVersion !== RUN_STATE_SCHEMA_VERSION
  ) {
    throw new RangeError(
      `Unsupported RunState schema version: ${String(schemaVersion)}`,
    )
  }
  if (typeof value.traceSessionId !== 'string') {
    throw new TypeError('RunState traceSessionId must be a string')
  }

  const output = AgentOutputSchema.safeParse(value.output)
  if (!output.success) {
    throw new TypeError(
      'RunState output does not match the public output schema',
    )
  }

  const durablePayload = JSON.parse(
    JSON.stringify(value, omitEphemeralAndFunctions),
  ) as UnknownRecord
  return {
    schemaVersion: RUN_STATE_SCHEMA_VERSION,
    traceSessionId: durablePayload.traceSessionId as string,
    sessionState: validateSessionState(durablePayload.sessionState),
    output: output.data,
  }
}

/** The JSON wire representation emitted by serializeRunState. */
export type RunStateTransport = string
