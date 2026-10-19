import { getAgentBaseName, moveSpawnAgentBlock } from './message-block-helpers'

import type { SpawnAgentInfo } from '../hooks/stream-state'
import type { ContentBlock } from '../types/chat'
import type { JSONValue } from '@savant-code/common/types/json'
import type { PrintModeSubagentStart } from '@savant-code/common/types/print-mode'

export interface SpawnAgentMatch {
  tempId: string
  info: SpawnAgentInfo
}

export const findMatchingSpawnAgent = (
  spawnAgentsMap: Map<string, SpawnAgentInfo>,
  eventAgentType: string,
  spawnOrigin?: PrintModeSubagentStart['spawnOrigin'],
): SpawnAgentMatch | null => {
  const eventBaseName = getAgentBaseName(eventAgentType || '')

  // Batch identity survives asynchronous template/evidence loading and
  // distinguishes identical roles, prompts and simultaneous parent batches.
  if (spawnOrigin) {
    const tempId = `${spawnOrigin.toolCallId}-${spawnOrigin.index}`
    const info = spawnAgentsMap.get(tempId)
    return info && getAgentBaseName(info.agentType) === eventBaseName
      ? { tempId, info }
      : null
  }

  for (const [tempId, info] of spawnAgentsMap.entries()) {
    const storedBaseName = getAgentBaseName(info.agentType || '')
    if (eventBaseName === storedBaseName) {
      return { tempId, info }
    }
  }

  return null
}

export const resolveSpawnAgentToReal = (options: {
  blocks: ContentBlock[]
  match: SpawnAgentMatch
  realAgentId: string
  realAgentType?: string
  parentAgentId?: string
  params?: Record<string, JSONValue>
  prompt?: string
}): ContentBlock[] => {
  const {
    blocks,
    match,
    realAgentId,
    realAgentType,
    parentAgentId,
    params: agentParams,
    prompt,
  } = options

  return moveSpawnAgentBlock(
    blocks,
    match.tempId,
    realAgentId,
    parentAgentId,
    agentParams,
    prompt,
    realAgentType,
  )
}
