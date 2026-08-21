import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

import { type CacheDebugCorrelation } from '@savant-code/common/util/cache-debug'

import {
  normalizeForJson,
  stableHash,
  summarizeLargeValue,
  type SerializableValue,
} from './cache-debug-serialize'

import type { CacheDebugUsageData } from '@savant-code/common/types/contracts/llm'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'
import type { ProviderMetadata } from '@savant-code/common/types/messages/provider-metadata'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

type CacheDebugMessageSnapshot = {
  role: Message['role']
  content: SerializableValue
  tags?: string[]
  timeToLive?: 'agentStep' | 'userPrompt'
  sentAt?: number
  providerOptions?: ProviderMetadata
  toolCallId?: string
  toolName?: string
}

type CacheDebugPreConversionSnapshot = {
  systemPrompt: string
  toolDefinitions: Record<string, JSONValue>
  messages: CacheDebugMessageSnapshot[]
}

type CacheDebugProviderRequestSnapshot = {
  provider: string
  rawBody: SerializableValue
  normalized: SerializableValue
}

export type CacheDebugSnapshot = {
  id: string
  index: number
  filename: string
  filePath: string
  timestamp: string
  agentType: string
  runId?: string
  userInputId?: string
  agentStepId?: string
  model?: string
  systemHash?: string
  toolsHash?: string
  preConversion: CacheDebugPreConversionSnapshot
  providerRequest?: CacheDebugProviderRequestSnapshot
  usage?: CacheDebugUsageData
}

function getCacheDebugDir(projectRoot: string) {
  return join(projectRoot, 'debug', 'cache-debug')
}

let cacheDebugCounter = 0

function snapshotPath(params: { projectRoot: string; filename: string }) {
  return join(getCacheDebugDir(params.projectRoot), params.filename)
}

function loadSnapshot(params: { projectRoot: string; filename: string }) {
  const path = snapshotPath(params)
  if (!existsSync(path)) {
    return null
  }
  return JSON.parse(readFileSync(path, 'utf8')) as CacheDebugSnapshot
}

function writeSnapshot(params: {
  snapshot: CacheDebugSnapshot
  logger: Logger
}) {
  const { snapshot, logger } = params
  mkdirSync(dirname(snapshot.filePath), { recursive: true })
  writeFileSync(snapshot.filePath, JSON.stringify(snapshot, null, 2))
  logger.debug(`[Cache Debug] Wrote enriched snapshot to ${snapshot.filePath}`)
}

function serializeMessage(message: Message): CacheDebugMessageSnapshot {
  return {
    role: message.role,
    content: normalizeForJson(message.content as JSONValue),
    tags: 'tags' in message ? message.tags : undefined,
    timeToLive: 'timeToLive' in message ? message.timeToLive : undefined,
    sentAt: 'sentAt' in message ? message.sentAt : undefined,
    providerOptions:
      'providerOptions' in message ? message.providerOptions : undefined,
    toolCallId: 'toolCallId' in message ? message.toolCallId : undefined,
    toolName: 'toolName' in message ? message.toolName : undefined,
  }
}

export function createCacheDebugSnapshot(params: {
  agentType: string
  system: string
  toolDefinitions: Record<string, JSONValue>
  messages: Message[]
  logger: Logger
  projectRoot: string
  runId?: string
  userInputId?: string
  agentStepId?: string
  model?: string
}): CacheDebugCorrelation {
  const {
    agentType,
    system,
    toolDefinitions,
    messages,
    logger,
    projectRoot,
    runId,
    userInputId,
    agentStepId,
    model,
  } = params

  const cacheDebugDir = getCacheDebugDir(projectRoot)
  mkdirSync(cacheDebugDir, { recursive: true })

  const snapshotId = randomUUID()
  const index = String(cacheDebugCounter++).padStart(3, '0')
  const filename = `${index}-${agentType}-${snapshotId}.json`
  const filePath = snapshotPath({ projectRoot, filename })

  const snapshot: CacheDebugSnapshot = {
    id: snapshotId,
    index: cacheDebugCounter - 1,
    filename,
    filePath,
    timestamp: new Date().toISOString(),
    agentType,
    runId,
    userInputId,
    agentStepId,
    model,
    systemHash: stableHash(system),
    toolsHash: stableHash(toolDefinitions),
    preConversion: {
      systemPrompt: system,
      toolDefinitions,
      messages: messages.map(serializeMessage),
    },
  }

  writeSnapshot({ snapshot, logger })

  return { snapshotId, filename, projectRoot }
}

/**
 * P4b (FID-2026-0806-003): loads the systemHash/toolsHash pair a snapshot
 * recorded, for prefix-stability monitoring. Returns empty hashes when the
 * snapshot is missing (already rotated) so callers degrade to no-op.
 */
export function loadCacheDebugSnapshotHashPair(correlation: {
  projectRoot: string
  filename: string
}): { systemHash?: string; toolsHash?: string } {
  try {
    const existing = loadSnapshot(correlation)
    if (!existing) return {}
    return {
      systemHash: existing.systemHash,
      toolsHash: existing.toolsHash,
    }
  } catch {
    return {}
  }
}

export function enrichCacheDebugSnapshotWithUsage(params: {
  correlation: CacheDebugCorrelation
  usage: CacheDebugUsageData
  logger: Logger
}) {
  const { correlation, usage, logger } = params
  try {
    const existing = loadSnapshot({
      projectRoot: correlation.projectRoot,
      filename: correlation.filename,
    })
    if (!existing) {
      logger.warn(
        `[Cache Debug] Could not find snapshot ${correlation.filename} to enrich with usage`,
      )
      return
    }

    if (existing.id !== correlation.snapshotId) {
      logger.warn(
        `[Cache Debug] Snapshot ID mismatch while enriching ${correlation.filename} with usage`,
      )
      return
    }

    const updated: CacheDebugSnapshot = {
      ...existing,
      usage,
    }

    writeSnapshot({ snapshot: updated, logger })
  } catch (err) {
    logger.warn(
      { error: err },
      '[Cache Debug] Failed to enrich snapshot with usage',
    )
  }
}

export function enrichCacheDebugSnapshotWithProviderRequest(params: {
  correlation: CacheDebugCorrelation
  provider: string
  rawBody: JSONValue
  normalized: JSONValue
  logger: Logger
}) {
  const { correlation, provider, rawBody, normalized, logger } = params
  try {
    const existing = loadSnapshot({
      projectRoot: correlation.projectRoot,
      filename: correlation.filename,
    })
    if (!existing) {
      logger.warn(
        `[Cache Debug] Could not find snapshot ${correlation.filename} to enrich with provider request`,
      )
      return
    }

    if (existing.id !== correlation.snapshotId) {
      logger.warn(
        `[Cache Debug] Snapshot ID mismatch while enriching ${correlation.filename}`,
      )
      return
    }

    const updated: CacheDebugSnapshot = {
      ...existing,
      providerRequest: {
        provider,
        rawBody: summarizeLargeValue(normalizeForJson(rawBody)),
        normalized: summarizeLargeValue(normalizeForJson(normalized)),
      },
    }

    writeSnapshot({ snapshot: updated, logger })
  } catch (err) {
    logger.warn({ error: err }, '[Cache Debug] Failed to enrich snapshot')
  }
}
