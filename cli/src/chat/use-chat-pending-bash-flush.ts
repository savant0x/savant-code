import { useEffect } from 'react'

import { addBashMessageToHistory } from '../commands/router'
import { useChatStore } from '../state/chat-store'

import type { ChatMessage } from '../types/chat'
import type { PendingBashMessage } from '../types/store'
import type { MutableRefObject } from 'react'

export type UseChatPendingBashFlushArgs = {
  isStreaming: boolean
  streamMessageIdRef: MutableRefObject<string | null>
  isChainInProgressRef: MutableRefObject<boolean>
  pendingBashMessages: PendingBashMessage[]
  setMessages: (
    value: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void
}

export function useChatPendingBashFlush({
  isStreaming,
  streamMessageIdRef,
  isChainInProgressRef,
  pendingBashMessages,
  setMessages,
}: UseChatPendingBashFlushArgs): void {
  useEffect(() => {
    if (
      !isStreaming &&
      !streamMessageIdRef.current &&
      !isChainInProgressRef.current &&
      pendingBashMessages.length > 0
    ) {
      const ghostModeMessages = pendingBashMessages.filter(
        (msg) => !msg.isRunning && !msg.addedToHistory,
      )

      for (const msg of ghostModeMessages) {
        addBashMessageToHistory({
          command: msg.command,
          stdout: msg.stdout,
          stderr: msg.stderr ?? null,
          exitCode: msg.exitCode,
          cwd: msg.cwd || process.cwd(),
          setMessages,
        })
      }

      if (ghostModeMessages.length > 0) {
        const ghostIds = new Set(ghostModeMessages.map((m) => m.id))
        useChatStore.setState((state) => ({
          pendingBashMessages: state.pendingBashMessages.map((m) =>
            ghostIds.has(m.id) ? { ...m, addedToHistory: true } : m,
          ),
        }))
      }
    }
  }, [isStreaming, pendingBashMessages, setMessages])
}
