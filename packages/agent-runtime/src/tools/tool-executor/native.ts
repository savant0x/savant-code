import { generateCompactId } from '@savant-code/common/util/string'

import { createClientToolBridge } from './client-tool-bridge'
import { recordEchoComplianceActivity } from './echo-record'
import { buildGateChain } from './gate-chain'
import { resolvePolicyForContext } from './pre-dispatch-gates'
import { runRejectionLifecycle, runSuccessLifecycle } from './result-lifecycle'
import { validateSpawnAgentsInput } from './spawn-validation'
import { createToolTrace } from './trace'
import { recordLaw1Write } from './write-bookkeeping'
import { getOrCreateEnforcement } from '../../echo/enforcement'
import { toolActivity } from '../../util/activity-tracking'
import { savantCodeToolHandlers } from '../handlers/list'
import { parseRawToolCall } from '../tool-call-parse'

import type { GateContext } from './gate-context'
import type { ExecuteToolCallParams } from './types'
import type { SavantCodeToolHandlerFunction } from '../handlers/handler-function-type'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { SavantCodeToolCall } from '@savant-code/common/tools/list'

export async function executeToolCall<T extends ToolName>(
  params: ExecuteToolCallParams<T>,
): Promise<void> {
  const {
    toolName,
    input,
    excludeToolFromMessageHistory = false,
    agentState,
    agentTemplate,
    logger,
    previousToolCallFinished,
    toolCalls,
    toolCallsToAddToMessageHistory,
    userInputId,
    onResponseChunk,
    requestToolCall,
  } = params
  const toolCallId = params.toolCallId ?? generateCompactId()
  const hookProjectRoot =
    params.fileContext?.projectRoot ?? params.fileContext?.cwd ?? ''

  // Runtime tool-event tracing (once-only finish flag lives in the recorder).
  const trace = createToolTrace({
    traceWriter: params.traceWriter,
    runId: params.runId,
    agentId: agentState.agentId,
    agentType: agentTemplate.id,
    toolName: String(toolName),
  })
  trace.recordToolEvent('tool_started')

  try {
    const toolCall: SavantCodeToolCall<T> | { error: string } =
      parseRawToolCall<T>({
        rawToolCall: {
          toolName,
          toolCallId,
          input,
        },
      })

    const ctx: GateContext<T> = {
      params,
      // C1-safe: gates run in order; only post-parse stages dereference input.
      toolCall: toolCall as SavantCodeToolCall<T>,
      toolCallId,
      toolName,
      logger,
      onResponseChunk,
      // Resolved from the typed execution policy (capability / FSM / sandbox
      // overrides) exactly as the monolith did before the gates run.
      executionPolicy: resolvePolicyForContext(params),
      hookProjectRoot,
      enforcement: getOrCreateEnforcement(agentState),
      resolvedWritePath: undefined,
      writeLawChecks: [],
      effectiveInput: (toolCall as SavantCodeToolCall<T>).input,
    }

    // Pre-dispatch gate chain — ORDER IS LOAD-BEARING (see gate-chain.ts).
    // The facade is the ONLY place that maps a halt to finishToolEvent +
    // the previousToolCallFinished return, byte-identical to the monolith.
    const gates = buildGateChain<T>({
      logger,
      onResponseChunk,
      hookProjectRoot,
      declaredToolNames: () => agentTemplate.toolNames,
      fullResponse: () => params.fullResponse ?? '',
      projectRoot: () => params.fileContext?.projectRoot,
      isCapabilityOverride: () => ctx.executionPolicy.allowCapabilityOverride,
      isFsmOverride: () => ctx.executionPolicy.allowFsmOverride,
      isSandboxOverride: () => ctx.executionPolicy.allowSandboxOverride,
    })
    for (const gate of gates) {
      const verdict = await gate(ctx)
      if (verdict.halt) {
        trace.finishToolEvent(verdict.status)
        return previousToolCallFinished
      }
    }

    // FID-2026-0804-009: Law 1 (read-before-write) — evaluated AFTER the
    // sandbox gate so sandbox-denied writes are never counted toward the
    // change footprint (code-review finding). Only writes that actually
    // dispatch reach this point.
    const echoCompliance = agentState.echoCompliance
    if (echoCompliance && echoCompliance.mode !== 'off') {
      await recordLaw1Write({
        toolName,
        toolCallInput: ctx.toolCall.input,
        resolvedWritePath: ctx.resolvedWritePath,
        writeLawChecks: ctx.writeLawChecks,
        agentState,
        agentTemplate,
        echoCompliance: echoCompliance as Parameters<
          typeof recordLaw1Write
        >[0]['echoCompliance'],
        onResponseChunk,
      })
    }

    // NOTE: Future improvement: allow tools to provide a validation function and move this logic into the spawn_agents validation function.
    // Pre-validate spawn_agents to filter out non-existent agents before streaming
    if (toolName === 'spawn_agents') {
      const spawnValidation = await validateSpawnAgentsInput({
        toolName,
        effectiveInput: ctx.effectiveInput,
        agentTemplate,
        localAgentTemplates: params.localAgentTemplates,
        fetchAgentFromDatabase: params.fetchAgentFromDatabase,
        databaseAgentCache: params.databaseAgentCache,
        apiKey: params.apiKey,
        logger,
        onResponseChunk,
      })
      if (spawnValidation.rejected) {
        trace.finishToolEvent('failed')
        return previousToolCallFinished
      }
      ctx.effectiveInput = spawnValidation.input
    }

    // FID-2026-0802-005 H7: abort gate — never stream/push a tool call or
    // invoke a handler after the run has been aborted. Prevents orphaned
    // tool_calls (no matching tool_result) from entering message history,
    // which providers reject. The spawn_agents pre-validation above awaits, so
    // an abort can land inside this window.
    if (params.signal.aborted) {
      trace.finishToolEvent('cancelled')
      return previousToolCallFinished
    }

    // FID-2026-0804-009: record read / spawn / verification activity on the
    // run's ECHO compliance tracker so Law 1 bookkeeping and the mechanical
    // Verifier criteria see the full run picture.
    if (echoCompliance && echoCompliance.mode !== 'off') {
      recordEchoComplianceActivity({
        echoCompliance,
        toolName,
        effectiveInput: ctx.effectiveInput,
      })
    }

    // Only emit tool_call event after permission check passes
    // FID-2026-0718-009: emit activity indicator (M1 tool_call, M6 research tools).
    // toolActivity mutates agentState.activity + emits a chunk via onResponseChunk.
    toolActivity(agentState, toolName, ctx.effectiveInput, onResponseChunk)

    onResponseChunk({
      type: 'tool_call',
      toolCallId,
      toolName,
      input: ctx.effectiveInput,
      agentId: agentState.agentId,
      parentAgentId: agentState.parentId,
      includeToolCall: !excludeToolFromMessageHistory,
    })

    // Cast to any to avoid type errors
    const handler = savantCodeToolHandlers[
      toolName
    ] as unknown as SavantCodeToolHandlerFunction<T>

    // Use effective input for spawn_agents so the handler receives the correct agent types
    const finalToolCall =
      toolName === 'spawn_agents'
        ? { ...ctx.toolCall, input: ctx.effectiveInput }
        : ctx.toolCall

    toolCalls.push(finalToolCall)
    if (!excludeToolFromMessageHistory) {
      toolCallsToAddToMessageHistory.push(finalToolCall)
    }

    // FID-2026-0802-005 C2: the handler is a trust boundary — a thrown or
    // rejected exception must surface as a tool error (driving the existing
    // hadToolCallError retry flow via the error chunk), never propagate
    // past the executor and fail the entire run (Law 14). The client-tool
    // bridge closure preserves the abort-aware graceful JSON-result pattern.
    const bridge = createClientToolBridge<T>({
      signal: params.signal,
      userInputId,
      requestToolCall,
    })
    let toolResultPromise: ReturnType<SavantCodeToolHandlerFunction<T>>
    try {
      toolResultPromise = handler({
        ...params,
        toolCall: finalToolCall,
        previousToolCallFinished,
        writeToClient: onResponseChunk,
        requestClientToolCall: bridge,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      onResponseChunk({
        type: 'error',
        message: `Tool \`${toolName}\` failed: ${errorMessage}`,
      })
      logger.error(
        { toolName, errorMessage },
        `Tool \`${toolName}\` threw synchronously: ${errorMessage}`,
      )
      trace.finishToolEvent('failed')
      return previousToolCallFinished
    }

    return await toolResultPromise.then(
      async ({ output, creditsUsed }) => {
        await runSuccessLifecycle(
          { ctx, trace, hookProjectRoot },
          output,
          creditsUsed,
        )
      },
      async (error) => {
        await runRejectionLifecycle({ ctx, trace, hookProjectRoot }, error)
      },
    )
  } catch (error) {
    trace.finishToolEvent(params.signal.aborted ? 'cancelled' : 'failed')
    throw error
  }
}

export { isWriteToolName, resolveFidIdForWrite } from './write-bookkeeping'
