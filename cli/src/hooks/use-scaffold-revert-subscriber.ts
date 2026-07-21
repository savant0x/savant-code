import { useEffect, useRef } from 'react'

import { useChatStore } from '../state/chat-store'

import type { ChatMessage, ToolContentBlock } from '../types/chat'

function findScaffoldCompletion(messages: ChatMessage[]): boolean {
  for (const message of messages) {
    if (!message.blocks) continue

    for (const block of message.blocks) {
      if (block.type !== 'tool') continue

      const toolBlock = block as ToolContentBlock
      if (toolBlock.toolName !== 'set_scaffold_complete') continue

      const raw = toolBlock.outputRaw
      if (raw && typeof raw === 'object' && 'scaffoldComplete' in raw) {
        return (raw as { scaffoldComplete?: unknown }).scaffoldComplete === true
      }

      const text = toolBlock.output
      if (typeof text === 'string') {
        try {
          const parsed = JSON.parse(text) as Record<string, unknown>
          return parsed.scaffoldComplete === true
        } catch {
          // Not JSON; ignore
        }
      }
    }
  }

  return false
}

/**
 * Watches for the orchestrator's `set_scaffold_complete` tool result and
 * automatically reverts the agent mode from SCAFFOLD back to EDIT.
 * Idempotent: only reverts once per scaffold session.
 */
export function useScaffoldRevertSubscriber() {
  const messages = useChatStore((state) => state.messages)
  const setAgentMode = useChatStore((state) => state.setAgentMode)
  const agentMode = useChatStore((state) => state.agentMode)
  const revertedForModeRef = useRef(false)
  const prevAgentModeRef = useRef(agentMode)

  useEffect(() => {
    const enteredScaffold =
      agentMode === 'SCAFFOLD' && prevAgentModeRef.current !== 'SCAFFOLD'
    if (enteredScaffold) {
      revertedForModeRef.current = false
    }
    prevAgentModeRef.current = agentMode
  }, [agentMode])

  useEffect(() => {
    if (agentMode !== 'SCAFFOLD') return
    if (revertedForModeRef.current) return

    if (findScaffoldCompletion(messages)) {
      revertedForModeRef.current = true
      setAgentMode('EDIT')
    }
  }, [messages, agentMode, setAgentMode])
}
