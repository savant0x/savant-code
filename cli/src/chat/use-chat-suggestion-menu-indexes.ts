import { useEffect } from 'react'

import type { TriggerContext } from '../hooks/use-suggestion-engine'

export interface UseChatSuggestionMenuIndexesArgs {
  slashContext: TriggerContext
  mentionContext: TriggerContext
  slashMatchCount: number
  agentMatchCount: number
  fileMatchCount: number
  slashSelectedIndex: number
  agentSelectedIndex: number
  setSlashSelectedIndex: (value: number | ((prev: number) => number)) => void
  setAgentSelectedIndex: (value: number | ((prev: number) => number)) => void
}

/** Reset and clamp the slash and mention menu selection indexes when context changes. */
export function useChatSuggestionMenuIndexes({
  slashContext,
  mentionContext,
  slashMatchCount,
  agentMatchCount,
  fileMatchCount,
  slashSelectedIndex,
  agentSelectedIndex,
  setSlashSelectedIndex,
  setAgentSelectedIndex,
}: UseChatSuggestionMenuIndexesArgs): void {
  useEffect(() => {
    if (!slashContext.active) {
      setSlashSelectedIndex(0)
      return
    }
    setSlashSelectedIndex(0)
  }, [slashContext.active, slashContext.query, setSlashSelectedIndex])

  useEffect(() => {
    if (slashMatchCount > 0 && slashSelectedIndex >= slashMatchCount) {
      setSlashSelectedIndex(slashMatchCount - 1)
    }
    if (slashMatchCount === 0 && slashSelectedIndex !== 0) {
      setSlashSelectedIndex(0)
    }
  }, [slashMatchCount, slashSelectedIndex, setSlashSelectedIndex])

  useEffect(() => {
    if (!mentionContext.active) {
      setAgentSelectedIndex(0)
      return
    }
    setAgentSelectedIndex(0)
  }, [mentionContext.active, mentionContext.query, setAgentSelectedIndex])

  useEffect(() => {
    const totalMatches = agentMatchCount + fileMatchCount
    if (totalMatches > 0 && agentSelectedIndex >= totalMatches) {
      setAgentSelectedIndex(totalMatches - 1)
    }
    if (totalMatches === 0 && agentSelectedIndex !== 0) {
      setAgentSelectedIndex(0)
    }
  }, [
    agentMatchCount,
    fileMatchCount,
    agentSelectedIndex,
    setAgentSelectedIndex,
  ])
}
