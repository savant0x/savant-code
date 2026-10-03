import { useEffect, useRef } from 'react'

import { useProviderNotifications } from './provider-notification-lifecycle'
import { useChatStore } from '../state/chat-store'
import { useGatewayCatalogStore } from '../state/gateway-catalog-store'
import { IS_SAVANT_FREE } from '../utils/constants'
import { getSystemMessage } from '../utils/message-history'
import {
  resolveContextWindowForModel,
  resolveContextWindowSourceForModel,
} from '../utils/openrouter-models'
import {
  getMissingProviderSetup,
  getProviderSetupGuidance,
} from '../utils/provider-setup'

import type { ChatMessage } from '../types/chat'
import type { AgentMode } from '../utils/constants'
import type { PermissionMode } from '../utils/settings'

export interface UseChatBootstrapArgs {
  messages: ChatMessage[]
  setMessages: (
    value: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void
  sidebarModel: string | null | undefined
  updateContextTokensMax: (maxTokens: number) => void
  updateContextWindowSource: (
    source: 'catalog' | 'fallback-table' | 'default',
  ) => void
  initialMode?: AgentMode
  setAgentMode: (mode: AgentMode) => void
  initialPermissionMode?: PermissionMode
}

export function useChatBootstrap(args: UseChatBootstrapArgs): void {
  useProviderNotifications()
  const shown = useRef(false)
  useEffect(() => {
    if (IS_SAVANT_FREE || shown.current || args.messages.length !== 0) return
    const missing = getMissingProviderSetup()
    if (!missing) return
    shown.current = true
    args.setMessages((prev) => [
      ...prev,
      getSystemMessage(getProviderSetupGuidance(missing)),
    ])
  }, [args.messages.length, args.setMessages])
  const loadedAt = useGatewayCatalogStore((s) => s.lastLoadedAt)
  useEffect(() => {
    if (!args.sidebarModel) return
    args.updateContextTokensMax(resolveContextWindowForModel(args.sidebarModel))
    args.updateContextWindowSource(
      resolveContextWindowSourceForModel(args.sidebarModel),
    )
  }, [
    args.sidebarModel,
    args.updateContextTokensMax,
    args.updateContextWindowSource,
    loadedAt,
  ])
  useEffect(() => {
    if (args.initialMode) args.setAgentMode(args.initialMode)
  }, [args.initialMode, args.setAgentMode])
  useEffect(() => {
    if (args.initialPermissionMode)
      useChatStore.getState().setPermissionMode(args.initialPermissionMode)
  }, [args.initialPermissionMode])
}
