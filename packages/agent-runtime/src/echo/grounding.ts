import { createHash } from 'node:crypto'

import { BOOT_LEARNINGS_PATH } from '@savant-code/common/constants/learnings-boot'
import { userMessage } from '@savant-code/common/util/messages'

import { buildProtocolRefreshSummary } from './protocol-summary'
import { withSystemTags } from '../util/messages'

import type {
  AgentState,
  GroundingCheckpoint,
} from '@savant-code/common/types/session-state'

export const HARNESS_GROUNDING_PATHS = [
  'ECHO.md',
  'ARCHITECTURE.md',
  'protocol.config.yaml',
  BOOT_LEARNINGS_PATH,
] as const

export const GROUNDING_CHECKPOINT_SCHEMA_VERSION = 1 as const

export function normalizeGroundingPath(filePath: string): string {
  return filePath
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .toLowerCase()
}

export function getRequiredGroundingPaths(agentState: AgentState): string[] {
  const protocolFile = agentState.protocolFile ?? 'ECHO.md'
  const protocolVariant = agentState.protocolVariant ?? 'single-agent'
  const paths =
    protocolVariant === 'harness'
      ? [protocolFile, ...HARNESS_GROUNDING_PATHS]
      : [protocolFile]
  return [...new Set(paths.map(normalizeGroundingPath))].sort()
}

export function getGroundingFingerprint(params: {
  protocolVariant: 'harness' | 'single-agent'
  protocolFile: string
  protocolSource: 'local' | 'embedded'
  protocolVersion: string
  requiredPaths: string[]
}): string {
  const canonical = JSON.stringify([
    params.protocolVariant,
    normalizeGroundingPath(params.protocolFile),
    params.protocolSource,
    params.protocolVersion,
    [...new Set(params.requiredPaths.map(normalizeGroundingPath))].sort(),
  ])
  return createHash('sha256').update(canonical).digest('hex')
}

export function getCurrentGroundingIdentity(agentState: AgentState):
  | {
      requiredPaths: string[]
      fingerprint: string
    }
  | undefined {
  if (!agentState.protocolFile) return undefined
  const protocolVariant = agentState.protocolVariant ?? 'single-agent'
  const protocolSource = agentState.protocolSource ?? 'local'
  const protocolVersion = agentState.protocolVersion ?? ''
  const requiredPaths = getRequiredGroundingPaths(agentState)
  return {
    requiredPaths,
    fingerprint: getGroundingFingerprint({
      protocolVariant,
      protocolFile: agentState.protocolFile,
      protocolSource,
      protocolVersion,
      requiredPaths,
    }),
  }
}

export function createGroundingCheckpoint(
  agentState: AgentState,
): GroundingCheckpoint | undefined {
  const identity = getCurrentGroundingIdentity(agentState)
  if (!identity || !agentState.protocolFile) {
    return undefined
  }
  return {
    schemaVersion: GROUNDING_CHECKPOINT_SCHEMA_VERSION,
    gateArmed: true,
    protocolVariant: agentState.protocolVariant ?? 'single-agent',
    protocolFile: normalizeGroundingPath(agentState.protocolFile),
    protocolSource: agentState.protocolSource ?? 'local',
    protocolVersion: agentState.protocolVersion ?? '',
    groundingSetFingerprint: identity.fingerprint,
    requiredPaths: identity.requiredPaths,
    completedPaths: [],
    fullGroundingCompleted: false,
    logicalUserTurnCount: 0,
    lastFullGroundingTurn: null,
    lastRefreshTurn: null,
    lastRefreshReason: null,
    lastRefreshEpoch: null,
    completionGateRetries: 0,
    completionGateDisarmed: false,
    internalStepsSinceRefresh: 0,
    lastRefreshAtMs: null,
  }
}

export function isGroundingCheckpointCurrent(
  agentState: AgentState,
  checkpoint: GroundingCheckpoint | undefined,
): boolean {
  const identity = getCurrentGroundingIdentity(agentState)
  if (!identity || !checkpoint) return false
  if (
    !Array.isArray(checkpoint.requiredPaths) ||
    !Array.isArray(checkpoint.completedPaths) ||
    typeof checkpoint.groundingSetFingerprint !== 'string' ||
    !checkpoint.requiredPaths.every((path) => typeof path === 'string') ||
    !checkpoint.completedPaths.every((path) => typeof path === 'string') ||
    typeof checkpoint.protocolFile !== 'string'
  ) {
    return false
  }
  const requiredPaths = [...checkpoint.requiredPaths]
  const completedPaths = [...checkpoint.completedPaths]
  const normalizedRequired = requiredPaths.map(normalizeGroundingPath).sort()
  const normalizedCompleted = completedPaths.map(normalizeGroundingPath).sort()
  const hasDuplicatePaths =
    new Set(normalizedRequired).size !== normalizedRequired.length ||
    new Set(normalizedCompleted).size !== normalizedCompleted.length
  return (
    !hasDuplicatePaths &&
    checkpoint.schemaVersion === GROUNDING_CHECKPOINT_SCHEMA_VERSION &&
    checkpoint.gateArmed === true &&
    checkpoint.protocolVariant ===
      (agentState.protocolVariant ?? 'single-agent') &&
    normalizeGroundingPath(checkpoint.protocolFile) ===
      normalizeGroundingPath(agentState.protocolFile ?? '') &&
    checkpoint.protocolSource === (agentState.protocolSource ?? 'local') &&
    checkpoint.protocolVersion === (agentState.protocolVersion ?? '') &&
    checkpoint.groundingSetFingerprint === identity.fingerprint &&
    JSON.stringify(normalizedRequired) ===
      JSON.stringify(identity.requiredPaths) &&
    checkpoint.fullGroundingCompleted === true &&
    normalizedCompleted.length === normalizedRequired.length &&
    normalizedCompleted.every(
      (path, index) => path === normalizedRequired[index],
    )
  )
}

export function appendGroundingRefresh(
  agentState: AgentState,
  refreshText: string | undefined,
): void {
  if (!refreshText) return
  const refreshMessage = userMessage({
    content: withSystemTags(refreshText),
    tags: ['ECHO_REFRESH'],
    keepDuringTruncation: true,
  })
  const withoutOldRefresh = agentState.messageHistory.filter(
    (message) => !message.tags?.includes('ECHO_REFRESH'),
  )
  agentState.messageHistory = [...withoutOldRefresh, refreshMessage]
}

export function buildGroundingRefresh(): string {
  return buildProtocolRefreshSummary()
}

export function isAgentGrounded(agentState: AgentState): boolean {
  if (agentState.parentId || !agentState.protocolFile) {
    return true
  }
  return isGroundingCheckpointCurrent(
    agentState,
    agentState.groundingCheckpoint,
  )
}
