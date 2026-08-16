import { callMainPrompt } from '@savant-code/agent-runtime/main-prompt'
import { MAX_AGENT_STEPS_DEFAULT } from '@savant-code/common/constants/agents'
import { cloneDeep } from 'lodash'

import { getUserInfoFromApiKey } from '../impl/database'
import { deserializeRunState } from '../run-state'
import { buildAgentRuntimeImpl } from './agent-runtime-impl'
import {
  createCancelledStateHelpers,
  createErrorRunStateFrom,
} from './cancelled-state'
import { resolveSessionState } from './execution/session-state'
import { startStateSnapshotting } from './execution/snapshot'
import { buildMainPromptErrorRunState, handlePromptResponse } from './response'
import { createStreamChunkHandlers } from './stream-handlers'
import {
  createAbortError,
  wrapContentForUserMessage,
  type RunExecutionOptions,
  type RunReturnType,
} from './types'

import type { RunState } from '../run-state'
import type { ServerAction } from '@savant-code/common/actions'
import type { SessionState } from '@savant-code/common/types/session-state'
import type { SavantCodeSpawn } from '@savant-code/common/types/spawn'

export async function run(options: RunExecutionOptions): Promise<RunState> {
  const { signal } = options

  if (signal?.aborted) {
    const abortError = createAbortError(signal)
    return {
      schemaVersion: 1,
      // FID-2026-0802-008 D2: omit sessionState when there is no previous
      // run — callers must not assume a session exists on pre-abort.
      ...(options.previousRun?.sessionState
        ? { sessionState: options.previousRun.sessionState }
        : {}),
      traceSessionId:
        options.previousRun?.traceSessionId ?? crypto.randomUUID(),
      output: {
        type: 'error',
        message: abortError.message,
      },
    }
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

  const fsSourceValue = typeof fsSource === 'function' ? fsSource() : fsSource
  const fs = await fsSourceValue
  let spawn: SavantCodeSpawn
  if (spawnSource) {
    const spawnSourceValue = await spawnSource
    spawn = spawnSourceValue as SavantCodeSpawn
  } else {
    spawn = require('child_process').spawn as SavantCodeSpawn
  }
  const preparedContent = wrapContentForUserMessage(content)
  let activeCustomToolDefinitions = customToolDefinitions ?? []

  // Init session state
  let agentId
  if (typeof agent !== 'string') {
    const clonedDefs = agentDefinitions ? cloneDeep(agentDefinitions) : []
    agentDefinitions = [...clonedDefs, agent]
    agentId = agent.id
  } else {
    agentId = agent
  }
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

  let resolvePromise: (
    value: RunReturnType | PromiseLike<RunReturnType>,
  ) => void = () => {}
  let _reject: (error: Error) => void = () => {}
  const promise = new Promise<RunReturnType>((res, rej) => {
    resolvePromise = res
    _reject = rej
  })

  // Snapshot support: stop emitting the moment the run settles so a late
  // snapshot can never overwrite the final state persisted by the host.
  let settled = false
  let stopSnapshotting: (() => void) | null = null
  const resolve = (value: RunReturnType) => {
    settled = true
    stopSnapshotting?.()
    stopSnapshotting = null
    resolvePromise(value)
  }

  // FID-2026-0802-008 E1: event/stream handlers are dispatched fire-and-forget
  // from sendAction, so a throwing handler (the default client handleEvent
  // throws to force error visibility) would otherwise become an unhandled
  // promise rejection — a process-crash risk. Route handler errors into the
  // run promise instead; once the run has settled, rejections are dropped.
  const rejectRunWithHandlerError = (error: unknown) => {
    if (settled) return
    _reject(error instanceof Error ? error : new Error(String(error)))
  }
  const safeDispatch = async (fn: () => void | Promise<void>) => {
    try {
      await fn()
    } catch (error) {
      logger?.debug?.(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Event/stream handler threw; rejecting run',
      )
      rejectRunWithHandlerError(error)
    }
  }

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

  const { onResponseChunk, onSubagentResponseChunk } =
    createStreamChunkHandlers({
      signal,
      handleEvent,
      handleStreamChunk,
      safeDispatch,
    })

  const handlePromptResponseAction = (
    action: ServerAction<'prompt-response'> | ServerAction<'prompt-error'>,
  ) => {
    handlePromptResponse({
      action,
      resolve,
      onError,
      initialSessionState: sessionState,
      traceSessionId,
    })
  }

  const agentRuntimeImpl = buildAgentRuntimeImpl({
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
    onResponseChunk,
    onSubagentResponseChunk,
    handlePromptResponseAction,
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
