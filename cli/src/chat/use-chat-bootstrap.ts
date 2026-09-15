/**
 * One-time bootstrap effects for the chat screen (FID-2026-0805-003).
 * Extracted from chat.tsx verbatim: provider-setup guidance, sidebar
 * context-token cap sync, and the CLI-flag initial mode/permission wiring.
 * FID-2026-0914-003 (Loop 5): discovery boot-check (MQ4) + the sanitized
 * agent-context announce block (MQ5/Layer 2).
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  isDiscoveryRepo,
  shouldRunBootCheck,
} from '@savant-code/common/providers/discovery-boot'
import { useEffect, useRef } from 'react'

import { tryGetProjectRoot } from '../project-files'
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

/**
 * FID-2026-0914-003 (MQ4/Layer 1): inside the savant-code repo, run the
 * daily discovery harvest in the background when the last report is >24h
 * old. Fail-silent by construction: every step is guarded, nothing throws
 * into the TUI, and ordinary users (outside this repo) never fetch.
 */
function maybeSpawnDailyHarvest(): void {
  try {
    const repoRoot = tryGetProjectRoot()
    if (!repoRoot || IS_SAVANT_FREE) return
    if (!isDiscoveryRepo(repoRoot)) return
    const harvester = join(
      repoRoot,
      'scripts',
      'providers',
      'harvest-freeairouter.ts',
    )
    if (!existsSync(harvester)) return
    const reportPath = join(repoRoot, 'dev', 'provider-candidates', 'report.md')
    let reportExists = false
    let reportAgeMs: number | null = null
    if (existsSync(reportPath)) {
      reportExists = true
      reportAgeMs = Date.now() - statSync(reportPath).mtimeMs
    }
    if (!shouldRunBootCheck({ reportExists, reportAgeMs })) return
    // Detached, discarded-output background run; the CLI never waits on it.
    const child = Bun.spawn({
      cmd: ['bun', harvester, '--probe'],
      cwd: repoRoot,
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'ignore',
    })
    child.unref()
  } catch {
    // Fail-silent (MQ4): the boot path never surfaces discovery errors.
  }
}

/**
 * FID-2026-0914-003 (MQ5/Layer 2): surface the sanitized discovery block as
 * a system message, once per candidate set (`.announced-key` sidecar). The
 * block is built by the harvester from structured facts only — never feed
 * prose — so nothing injectable enters model context.
 */
function announceDiscoveryBlock(
  setMessages: UseChatBootstrapArgs['setMessages'],
): void {
  try {
    const repoRoot = tryGetProjectRoot()
    if (!repoRoot || IS_SAVANT_FREE) return
    const contextPath = join(
      repoRoot,
      'dev',
      'provider-candidates',
      'agent-context.txt',
    )
    if (!existsSync(contextPath)) return
    const raw = readFileSync(contextPath, 'utf8')
    const newlineIndex = raw.indexOf('\n')
    if (newlineIndex === -1) return
    const setKey = raw.slice(0, newlineIndex)
    const block = raw.slice(newlineIndex + 1).trim()
    if (!block) return
    const announcedPath = join(
      repoRoot,
      'dev',
      'provider-candidates',
      '.announced-key',
    )
    const lastAnnounced = existsSync(announcedPath)
      ? readFileSync(announcedPath, 'utf8').trim()
      : ''
    if (lastAnnounced === setKey) return
    setMessages((prev) => [...prev, getSystemMessage(block)])
    writeFileSync(announcedPath, setKey, 'utf8')
  } catch {
    // Fail-silent (MQ5): announce failures never break the TUI.
  }
}

export interface UseChatBootstrapArgs {
  messages: ChatMessage[]
  setMessages: (
    value: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void
  sidebarModel: string | null | undefined
  updateContextTokensMax: (maxTokens: number) => void
  /** FID-2026-0914-002 (MQ4): sidebar window provenance setter. */
  updateContextWindowSource: (
    source: 'catalog' | 'fallback-table' | 'default',
  ) => void
  initialMode?: AgentMode
  setAgentMode: (mode: AgentMode) => void
  initialPermissionMode?: PermissionMode
}

export function useChatBootstrap({
  messages,
  setMessages,
  sidebarModel,
  updateContextTokensMax,
  updateContextWindowSource,
  initialMode,
  setAgentMode,
  initialPermissionMode,
}: UseChatBootstrapArgs): void {
  const providerGuidanceShownRef = useRef(false)
  useEffect(() => {
    // FID-007 U1: provider guidance is non-free builds only — SavantFree
    // reaches inference via its own gateway, `/provider` is not registered
    // there, and instructing free users to run it would produce
    // "Command not found".
    if (IS_SAVANT_FREE) return
    if (providerGuidanceShownRef.current || messages.length !== 0) return

    const missingProvider = getMissingProviderSetup()
    if (!missingProvider) return

    providerGuidanceShownRef.current = true
    setMessages((prev) => [
      ...prev,
      getSystemMessage(getProviderSetupGuidance(missingProvider)),
    ])
  }, [messages.length, setMessages])

  // FID-2026-0723-062: keep the sidebar context-token cap in sync with the
  // active model. This fires on initial render (restored preference), when the
  // model changes, and when the gateway catalog finishes loading asynchronously.
  const gatewayCatalogLoadedAt = useGatewayCatalogStore((s) => s.lastLoadedAt)
  useEffect(() => {
    if (sidebarModel) {
      const maxTokens = resolveContextWindowForModel(sidebarModel)
      updateContextTokensMax(maxTokens)
      // FID-2026-0914-002 (MQ4): window provenance for the sidebar badge.
      updateContextWindowSource(
        resolveContextWindowSourceForModel(sidebarModel),
      )
    }
  }, [sidebarModel, updateContextTokensMax, gatewayCatalogLoadedAt])

  // FID-2026-0914-003 (Loop 5): background daily harvest (MQ4) + the
  // sanitized agent-context announce (MQ5). One deferred effect, so neither
  // contends with TUI init; both bodies are fail-silent and repo-gated.
  const discoveryAnnouncedRef = useRef(false)
  useEffect(() => {
    if (messages.length !== 0) return
    if (discoveryAnnouncedRef.current) return
    discoveryAnnouncedRef.current = true
    const timer = setTimeout(() => {
      maybeSpawnDailyHarvest()
      announceDiscoveryBlock(setMessages)
    }, 1_500)
    return () => clearTimeout(timer)
  }, [messages.length])

  // Set initial mode from CLI flag on mount
  useEffect(() => {
    if (initialMode) {
      setAgentMode(initialMode)
    }
  }, [initialMode, setAgentMode])

  // Set initial permission mode from CLI flag on mount (CLI takes precedence
  // over saved setting because it is an explicit per-launch override).
  useEffect(() => {
    if (initialPermissionMode) {
      useChatStore.getState().setPermissionMode(initialPermissionMode)
    }
  }, [initialPermissionMode])
}
