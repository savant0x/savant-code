import { callMainPrompt } from '@savant-code/agent-runtime/main-prompt'
import { MAX_AGENT_STEPS_DEFAULT } from '@savant-code/common/constants/agents'

import { getUserInfoFromApiKey } from '../impl/database'
import { deserializeRunState } from '../run-state'
import {
  buildPreAbortRunState,
  createCancelledStateHelpers,
  createErrorRunStateFrom,
} from './cancelled-state'
import { buildWiredAgentRuntime } from './execution/runtime-assembly'
import {
  resolveAgentIdentity,
  resolveSessionState,
} from './execution/session-state'
import { createRunSettlement } from './execution/settlement'
import { startStateSnapshotting } from './execution/snapshot'
import { resolveFsAndSpawn } from './execution/sources'
import { buildMainPromptErrorRunState } from './response'
import {
  createAbortError,
  wrapContentForUserMessage,
  type RunExecutionOptions,
} from './types'

import type { RunState } from '../run-state'
import type { SessionState } from '@savant-code/common/types/session-state'

export async function run(options: RunExecutionOptions): Promise<RunState> {
  const { signal } = options

  if (signal?.aborted) {
    return buildPreAbortRunState({
      previousRun: options.previousRun,
      abortError: createAbortError(signal),
    })
  }

  return runOnce(options)
}

async function runOnce({
  apiKey,
  fingerprintId,

  cwd,
  skillsDir,
  projectFiles,
  knowledgeFiles,
  agentDefinitions,
  maxAgentSteps = MAX_AGENT_STEPS_DEFAULT,
  env,

  handleEvent,
  handleStreamChunk,

  fileFilter,
  overrideTools,
  customToolDefinitions,

  fsSource = () => require('fs').promises,
  spawnSource,
  logger,
  traceWriter,

  agent,
  prompt,
  content,
  params,
  previousRun,
  extraToolResults,
  signal,
  drainSteeringMessages,
  extraSavantCodeMetadata,
  onStateSnapshot,
  onFileWritten,
  devMode,
  permissionMode,
  designContract,
  modelInfoText,
  checkpointDir,
  checkpointTurnId,
  echoCompliance,
  provenanceMode,
  contextWindow,
  compression,
  protocolVariant,
}: RunExecutionOptions): Promise<RunState> {
  // Transport payloads may be supplied as serialized JSON at this boundary,
  // but live in-process RunState objects must bypass deserialization so resume
  // can preserve function-valued agent handlers.
  const normalizedPreviousRun =
    typeof (previousRun as unknown) === 'string'
      ? deserializeRunState(previousRun as unknown)
      : previousRun
  previousRun = normalizedPreviousRun

  const { fs, spawn } = await resolveFsAndSpawn({ fsSource, spawnSource })
  const preparedContent = wrapContentForUserMessage(content)
  let activeCustomToolDefinitions = customToolDefinitions ?? []

  // Init session state
  const identity = resolveAgentIdentity({ agent, agentDefinitions })
  agentDefinitions = identity.agentDefinitions
  const agentId = identity.agentId
  const traceSessionId = previousRun?.traceSessionId ?? crypto.randomUUID()

  // FID-2026-0802-008 E2: setup failures resolve an error RunState instead of
  // rejecting — the runtime error path already resolves output.error, so run()
  // has a single error contract.
  const errorRunStateFrom = createErrorRunStateFrom({ traceSessionId })

  let sessionState: SessionState
  try {
    sessionState = await resolveSessionState({
      options: {
        cwd,
        skillsDir,
        projectFiles,
        knowledgeFiles,
        customToolDefinitions,
        maxAgentSteps,
        protocolVariant,
        devMode,
        permissionMode,
        designContract,
        echoCompliance,
        provenanceMode,
        prompt,
        logger,
      },
      previousRun,
      agentDefinitions,
      fs,
      spawn,
    })
  } catch (error) {
    return errorRunStateFrom(error)
  }

  let stopSnapshotting: (() => void) | null = null
  const settlement = createRunSettlement({
    logger,
    // Snapshot support: stop emitting the moment the run settles so a late
    // snapshot can never overwrite the final state persisted by the host.
    onSettled: () => {
      stopSnapshotting?.()
      stopSnapshotting = null
    },
  })
  const { promise, resolve, dispatch: safeDispatch } = settlement

  async function onError(error: { message: string }) {
    if (handleEvent) {
      await safeDispatch(() =>
        handleEvent({ type: 'error', message: error.message }),
      )
    }
  }

  // The agent runtime mutates sessionState.mainAgentState as it progresses,
  // replacing messageHistory with a new array once it adds the user prompt.
  // Comparing array identity detects progress more robustly than length:
  // context pruning could shrink history below its starting length without
  // meaning the runtime never ran.
  let initialMessageHistory = sessionState.mainAgentState.messageHistory

  const { getCancelledSessionState, getCancelledRunState } =
    createCancelledStateHelpers({
      sessionState,
      initialMessageHistory,
      prompt,
      params,
      preparedContent,
      traceSessionId,
      logger,
    })

  const agentRuntimeImpl = buildWiredAgentRuntime({
    runtimeBase: {
      logger,
      traceWriter,
      apiKey,
      signal,
      fs,
      cwd,
      env,
      fileFilter,
      overrideTools: overrideTools ?? {},
      customToolDefinitions: activeCustomToolDefinitions,
      onFileWritten,
      checkpointDir,
      checkpointTurnId,
      onError,
    },
    handleEvent,
    handleStreamChunk,
    safeDispatch,
    resolve,
    initialSessionState: sessionState,
    traceSessionId,
  })

  // FID-2026-0802-008 D3: crypto-grade id (was Math.random()).
  const promptId = crypto.randomUUID()

  // Send input
  // FID-2026-0802-008 E2: auth failures (401/5xx from getUserInfoFromApiKey)
  // resolve an error RunState rather than rejecting the run() promise.
  let userId: string
  try {
    const userInfo = await getUserInfoFromApiKey({
      ...agentRuntimeImpl,
      apiKey,
      fields: ['id'],
    })
    if (!userInfo) {
      return getCancelledRunState('Invalid API key or user not found')
    }
    userId = userInfo.id
  } catch (error) {
    return errorRunStateFrom(error)
  }

  if (signal?.aborted) {
    // Align with the pre-abort message in run() (FID-2026-0802-008 E2).
    return getCancelledRunState(createAbortError(signal).message)
  }

  if (onStateSnapshot) {
    const snapshotter = startStateSnapshotting({
      sessionState,
      getCancelledRunState,
      onStateSnapshot,
      signal,
      logger,
    })
    stopSnapshotting = snapshotter.stop
  }

  callMainPrompt({
    ...agentRuntimeImpl,
    promptId,
    action: {
      type: 'prompt',
      promptId,
      prompt,
      promptParams: params,
      content: preparedContent,
      fingerprintId: fingerprintId,
      sessionState,
      toolResults: extraToolResults ?? [],
      agentId,
    },
    drainSteeringMessages,
    repoUrl: undefined,
    repoId: undefined,
    clientSessionId: promptId,
    userId,
    modelInfoText,
    extraSavantCodeMetadata: {
      ...(extraSavantCodeMetadata ?? {}),
      trace_session_id: traceSessionId,
    },
    // FID-2026-0725-085 CTX-007 + FID-2026-0814-004 H-05/H-06: the resolved
    // context window and compression config cross the SDK boundary here —
    // previously the CLI's values were silently dropped before reaching the
    // runtime, so ContextCompactor always fell back to 200k.
    contextWindow,
    compression,
    signal: signal ?? new AbortController().signal,
  }).catch((error) => {
    resolve(
      buildMainPromptErrorRunState({
        error,
        getCancelledSessionState,
        traceSessionId,
      }),
    )
  })

  return promise
}
