import { useEffect, useRef } from 'react'

import { useProviderNotifications } from './provider-notification-lifecycle'
import { tryGetProjectRoot } from '../project-files'
import { useChatStore } from '../state/chat-store'
import { useGatewayCatalogStore } from '../state/gateway-catalog-store'
import { IS_SAVANT_FREE } from '../utils/constants'
import {
  buildDiscoveryAnnouncement,
  readAnnouncedKey,
  writeAnnouncedKey,
} from '../utils/discovery-announce'
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
  // Sanitized discovery announce (FID-2026-0914-003 MQ5, rebuilt by
  // FID-2026-1004-001): surfaces the harvester's agent-context block once
  // per candidate set — repo-gated, free-build exempt, fail-silent. The
  // block is built by the harvester from structured facts only, so no
  // feed prose can enter model context by construction.
  const discoveryAnnouncedRef = useRef(false)
  useEffect(() => {
    if (discoveryAnnouncedRef.current) return
    discoveryAnnouncedRef.current = true
    try {
      const repoRoot = tryGetProjectRoot()
      if (!repoRoot || IS_SAVANT_FREE) return
      const announcement = buildDiscoveryAnnouncement({
        repoRoot,
        lastAnnouncedKey: readAnnouncedKey(repoRoot),
      })
      if (!announcement) return
      args.setMessages((prev) => [
        ...prev,
        getSystemMessage(announcement.block),
      ])
      writeAnnouncedKey(repoRoot, announcement.setKey)
    } catch {
      // Fail-silent (MQ5): announce failures never break the TUI.
    }
  }, [args.setMessages])
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
