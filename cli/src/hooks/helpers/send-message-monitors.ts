import { useChatStore } from '../../state/chat-store'
import { markChunkSeen } from '../../utils/finish-logic'
import { logger } from '../../utils/logger'

import type { createRunConfig } from '../../utils/create-run-config'
import type { StalledResetWatcher } from '../../utils/finish-logic'
import type { RunState, MessageContent } from '@savant-code/sdk'
import type { MutableRefObject } from 'react'

export type StartRunMonitorsParams = {
  heartbeatIntervalRef: MutableRefObject<ReturnType<typeof setInterval> | null>
  getLatestRunStateSnapshot: () => RunState
  stalledWatcher: StalledResetWatcher
  runConfig: ReturnType<typeof createRunConfig>
  effectivePrompt: string
  messageContent: MessageContent[] | undefined
  previousMessageCount: number
  agentDefinitionCount: number
  mainAgentName: string
  resolvedContextWindow: number | undefined
}

/**
 * Starts everything that monitors the run: sidebar agent-stack wiring,
 * context-window cap, the run-config log summary, the 2s snapshot heartbeat
 * (FID-2026-0718-010 F3), and the stalled-state watcher (D5). Extracted from
 * use-send-message.ts (FID-2026-0805-003).
 */
export const startRunMonitors = (params: StartRunMonitorsParams): void => {
  const {
    heartbeatIntervalRef,
    getLatestRunStateSnapshot,
    stalledWatcher,
    runConfig,
    effectivePrompt,
    messageContent,
    previousMessageCount,
    agentDefinitionCount,
    mainAgentName,
    resolvedContextWindow,
  } = params

  // Wire sidebar: add main agent to stack at run start
  useChatStore
    .getState()
    .updateAgentStack([{ id: mainAgentName, isActive: true }])

  // Wire sidebar: set context window max from model. Reuse the resolved
  // value computed for createRunConfig (CTX-007 fix).
  // FID-2026-0813-023: use a typeof guard — a truthy guard swallows a
  // legitimate 0 and leaves the cap stale when resolution returns undefined.
  if (typeof resolvedContextWindow === 'number') {
    useChatStore.getState().updateContextTokensMax(resolvedContextWindow)
  }

  // Log a summary only: the full run config contains the entire
  // conversation history and attachments, which bloats log.jsonl.
  logger.info(
    {
      runConfig: {
        agent: mainAgentName,
        promptLength: effectivePrompt.length,
        contentBlockCount: messageContent?.length ?? 0,
        previousMessageCount,
        agentDefinitionCount,
        maxAgentSteps: runConfig.maxAgentSteps,
      },
    },
    '[send-message] Sending message with sdk run config',
  )
  // FID-2026-0718-010 (F3): start heartbeat BEFORE client.run.
  // Polls latestRunStateSnapshot every 2s to keep the sidebar's
  // contextTokensUsed fresh during long sub-agent chains. The
  // snapshot ref is updated by onStateSnapshot.
  heartbeatIntervalRef.current = setInterval(() => {
    const snap = getLatestRunStateSnapshot()
    if (!snap) return
    // FID-2026-0718-010 (F3): poll token count every 2s. Cap is set
    // once at run-start; the heartbeat intentionally does NOT refresh the
    // cap (avoids the cost-flicker problem called out in D4).
    const tokenCount = snap?.sessionState?.mainAgentState?.contextTokenCount
    if (typeof tokenCount === 'number') {
      useChatStore.getState().updateContextTokens(tokenCount)
    }
    // FID-2026-0813-023: mirror the runtime's live compaction status into
    // the read-only sidebar row (idle/compacted/warning).
    const compactionStatus =
      snap?.sessionState?.mainAgentState?.compactionStatus
    if (compactionStatus) {
      useChatStore.getState().setCompactionStatus(compactionStatus)
    }
  }, 2_000)
  // Bump the chunk-seen watermark (FID-2026-0718-010 D5).
  markChunkSeen('send-message-start')
  // Start the stalled-state watcher.
  stalledWatcher.start()
}
