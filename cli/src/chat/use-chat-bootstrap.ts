import { useEffect, useRef } from 'react'

import { useProviderNotifications } from './provider-notification-lifecycle'
import { tryGetProjectRoot } from '../project-files'
import { useChatStore } from '../state/chat-store'
import { useGatewayCatalogStore } from '../state/gateway-catalog-store'
import {
  buildDiscoveryAnnouncement,
  readAnnouncedKey,
  readDiscoveryCounts,
  writeAnnouncedKey,
} from '../utils/discovery-announce'
import { startDiscoveryCompletionWatcher } from '../utils/discovery-completion-watcher'
import { observeDiscoveryCandidates } from '../utils/discovery-inbox'
import {
  freeOptionsPaths,
  readCachedFreeOptionsReport,
  refreshFreeOptions,
  verifyFreeOptionsArtifact,
} from '../utils/free-options'
import { resolveBootFreeOptions } from '../utils/free-options-boot'
import { getSystemMessage } from '../utils/message-history'
import {
  resolveContextWindowForModel,
  resolveContextWindowSourceForModel,
} from '../utils/openrouter-models'
import {
  getMissingProviderSetup,
  getProviderSetupGuidance,
} from '../utils/provider-setup'

import type { ChatMessage, FreeOptionsContentBlock } from '../types/chat'
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
    if (shown.current || args.messages.length !== 0) return
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
      if (!repoRoot) return
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
  // Free-options boot panel (FID-2026-1017-005): freshness is resolved BEFORE
  // the panel posts. A cache no older than 12 h is shown with its exact age;
  // an older or absent cache gets one bounded refresh through the existing
  // single-flight (shared with provider notifications). The complete payload
  // lives in the block, collapsed by default. Discovery inbox routing runs on
  // every boot, outside the panel path (deduped by fact value).
  const bootPanelShownRef = useRef(false)
  const discoveryCompletionWatcherRef = useRef<ReturnType<
    typeof startDiscoveryCompletionWatcher
  > | null>(null)
  useEffect(() => {
    if (bootPanelShownRef.current) return
    bootPanelShownRef.current = true
    const repoRoot = tryGetProjectRoot()
    const discovery = repoRoot ? readDiscoveryCounts(repoRoot) : null
    if (discovery && discovery.newHosts.length > 0)
      observeDiscoveryCandidates(discovery)
    // Step 7 (FID-2026-1004-007): the boot harvest is DETACHED and can
    // publish agent-context.txt after these mount effects ran. Watch the
    // artifact for a set-key transition and route its NEW hosts then —
    // event-driven (no polling), dedup by key at the watcher + by fact
    // value at the coordinator. Fail-silent; free-build exempt.
    if (repoRoot)
      discoveryCompletionWatcherRef.current = startDiscoveryCompletionWatcher({
        repoRoot,
        initialSetKey: discovery?.setKey ?? null,
        observe: observeDiscoveryCandidates,
      })
    let cancelled = false
    void resolveBootFreeOptions({
      now: () => Date.now(),
      readCached: readCachedFreeOptionsReport,
      refresh: refreshFreeOptions,
      verify: (report) =>
        verifyFreeOptionsArtifact({
          report,
          path: freeOptionsPaths().markdown,
        }),
    })
      .then((snapshot) => {
        if (cancelled) return
        const hasContent =
          snapshot.report.fetchedAt !== null ||
          snapshot.report.localFree.length > 0 ||
          Boolean(
            discovery && (discovery.newCount > 0 || discovery.changedCount > 0),
          )
        if (!hasContent) return
        const block: FreeOptionsContentBlock = {
          type: 'free-options',
          id: `free-options-${Date.now()}`,
          snapshot,
          discovery: discovery
            ? {
                newCount: discovery.newCount,
                changedCount: discovery.changedCount,
              }
            : null,
          markdownPath: freeOptionsPaths().markdown,
        }
        args.setMessages((prev) => [...prev, getSystemMessage([block])])
      })
      .catch(() => {
        // Fail-silent: a boot panel never breaks the TUI.
      })
    return () => {
      cancelled = true
    }
  }, [args.setMessages])
  useEffect(
    () => () => {
      discoveryCompletionWatcherRef.current?.close()
      discoveryCompletionWatcherRef.current = null
    },
    [],
  )
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
