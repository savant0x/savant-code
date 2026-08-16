import { readProtocolConfig } from '@savant-code/common/util/protocol-config'

import {
  applySavantCodeModelOverride,
  buildPromptWithContext,
  resolveAgent,
} from './send-message-agent'
import { getProjectRoot } from '../../project-files'
import { useChatStore } from '../../state/chat-store'
import { IS_SAVANT_FREE } from '../../utils/constants'
import { createEventHandlerState } from '../../utils/create-event-handler-state'
import { createRunConfig } from '../../utils/create-run-config'
import { isFidPath, saveFidDocumentToDb } from '../../utils/db-storage'
import { getActiveDesignContract } from '../../utils/design-system-service'
import {
  findGatewayModel,
  formatModelInfo,
  resolveContextWindowForModel,
} from '../../utils/openrouter-models'
import { getSavantFreeInstanceId } from '../use-savant-free-session'

import type { AgentMode } from '../../utils/constants'
import type { CreateEventHandlerStateParams } from '../../utils/create-event-handler-state'
import type { CreateRunConfigParams } from '../../utils/create-run-config'
import type { MessageUpdater } from '../../utils/message-updater'
import type { SetStreamingAgentsFn } from '../../utils/sdk-event-handlers'
import type { StreamController } from '../stream-state'
import type { StreamStatus } from '../use-message-queue'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type {
  AgentDefinition,
  MessageContent,
  RunState,
} from '@savant-code/sdk'
import type { MutableRefObject } from 'react'

export type SidebarEventCallbacks = Pick<
  CreateEventHandlerStateParams,
  'onTotalCost' | 'onToolCall' | 'onSubagentStart' | 'onSubagentFinish'
>

export type BuildSendRunConfigParams = {
  logger: Logger
  agentMode: AgentMode
  agentId: string | undefined
  agentDefinitions: AgentDefinition[]
  bashContextForPrompt: string | undefined
  finalContent: string
  messageContent: MessageContent[] | undefined
  previousRunState: RunState | null
  signal: AbortSignal
  checkpointDir: string
  checkpointTurnId: string
  devMode: boolean
  permissionMode: CreateRunConfigParams['permissionMode']
  streamRefs: StreamController
  setStreamingAgents: SetStreamingAgentsFn
  setStreamStatus: (status: StreamStatus) => void
  aiMessageId: string
  updater: MessageUpdater
  hasReceivedContentRef: MutableRefObject<boolean>
  addActiveSubagent: (id: string) => void
  removeActiveSubagent: (id: string) => void
  setHasReceivedPlanResponse: (value: boolean) => void
  setIsRetrying: (value: boolean) => void
  sidebarCallbacks: SidebarEventCallbacks
  onStateSnapshot: (runState: RunState) => void
}

/**
 * Builds the SDK run config for a send: resolves the agent (explicit id or
 * mode fallback) + model override, composes the effective prompt, wires the
 * event-handler state (including sidebar callbacks and snapshot/file-write
 * hooks), and delegates to createRunConfig. Extracted from use-send-message.ts
 * (FID-2026-0805-003). Returns the pieces the caller needs for completion
 * metadata and run monitoring.
 */
export const buildSendRunConfig = (params: BuildSendRunConfigParams) => {
  const {
    logger,
    agentMode,
    agentId,
    agentDefinitions,
    bashContextForPrompt,
    finalContent,
    messageContent,
    previousRunState,
    signal,
    checkpointDir,
    checkpointTurnId,
    devMode,
    permissionMode,
    streamRefs,
    setStreamingAgents,
    setStreamStatus,
    aiMessageId,
    updater,
    hasReceivedContentRef,
    addActiveSubagent,
    removeActiveSubagent,
    setHasReceivedPlanResponse,
    setIsRetrying,
    sidebarCallbacks,
    onStateSnapshot,
  } = params

  const resolvedAgent = resolveAgent(agentMode, agentId, agentDefinitions)
  const agentWithModelOverride = applySavantCodeModelOverride(
    resolvedAgent,
    agentDefinitions,
  )

  const promptWithBashContext = bashContextForPrompt
    ? bashContextForPrompt + finalContent
    : finalContent
  const effectivePrompt = buildPromptWithContext(
    promptWithBashContext,
    messageContent,
  )

  const eventHandlerState = createEventHandlerState({
    streamRefs,
    setStreamingAgents,
    setStreamStatus,
    aiMessageId,
    updater,
    hasReceivedContentRef,
    addActiveSubagent,
    removeActiveSubagent,
    agentMode,
    setHasReceivedPlanResponse,
    logger,
    setIsRetrying,
    ...sidebarCallbacks,
  })

  const instanceId = getSavantFreeInstanceId()
  const effectiveModelId =
    typeof agentWithModelOverride === 'string'
      ? undefined
      : agentWithModelOverride.model

  // FID-2026-0725-085 CTX-007 + FID-2026-0813-023: Resolve context window
  // BEFORE createRunConfig for BOTH agent shapes so it flows through to the
  // agent runtime for accurate compaction thresholds. A bare string agent
  // resolves its definition's default model; an object agent resolves its
  // (possibly overridden) model. Only an unresolvable model yields undefined.
  const windowModelId =
    effectiveModelId ??
    (typeof agentWithModelOverride === 'string'
      ? agentDefinitions.find((def) => def.id === agentWithModelOverride)?.model
      : undefined)
  const resolvedContextWindow = windowModelId
    ? resolveContextWindowForModel(windowModelId)
    : undefined

  const cachedModel = effectiveModelId
    ? findGatewayModel(effectiveModelId)
    : undefined
  const modelInfoText = effectiveModelId
    ? formatModelInfo(effectiveModelId, cachedModel, resolvedContextWindow)
    : undefined

  const runConfig = createRunConfig({
    logger,
    agent: agentWithModelOverride,
    prompt: effectivePrompt,
    content: messageContent,
    previousRunState,
    agentDefinitions,
    eventHandlerState,
    signal,
    extraSavantCodeMetadata:
      IS_SAVANT_FREE && instanceId
        ? { savant_free_instance_id: instanceId }
        : undefined,
    modelInfoText,
    contextWindow: resolvedContextWindow,
    checkpointDir,
    checkpointTurnId,
    onStateSnapshot,
    onFileWritten: (fileParams) => {
      // Save FID documents to database when written to disk
      if (isFidPath(fileParams.path)) {
        saveFidDocumentToDb(fileParams.path, fileParams.content)
      }
      // Wire sidebar: track file changes
      useChatStore
        .getState()
        .incrementFilesChanged(
          fileParams.type === 'modified' ? 'modified' : 'created',
        )
    },
    devMode,
    permissionMode,
    enforcementMode: agentMode === 'STRICT' ? 'strict' : 'hybrid',
    // FID-2026-0813-004: ZTAP provenance mode from protocol.config.yaml
    // `provenance.mode` (defaults to `record`). Read per send — the config is
    // a small cached fs read and the operator may flip the mode mid-session.
    provenanceMode: readProtocolConfig(getProjectRoot() ?? process.cwd())
      .provenance.mode,
    // FID-2026-0814-004 H-05/H-06/H-07: compression config from
    // protocol.config.yaml `compression` — the runtime honors `microCompact`
    // (off-switch), `keepRecentTokens` / `autoCompactRatio` /
    // `forceCompactOffset` (pruner trigger + fold floor), and
    // `microCompactMaxKeepRecent` (pressure-gate keep count).
    compression: readProtocolConfig(getProjectRoot() ?? process.cwd())
      .compression,
    // The harness product boots under the harness contract (ECHO.md). The
    // single-agent variant is an SDK opt-in for outside agents working on
    // the harness — never the CLI's default (operator directive 2026-08-10).
    protocolVariant: 'harness',
    designContract: getActiveDesignContract(),
  })

  const mainAgentName =
    typeof agentWithModelOverride === 'string'
      ? agentWithModelOverride
      : agentWithModelOverride.id

  return { runConfig, mainAgentName, resolvedContextWindow, effectivePrompt }
}
