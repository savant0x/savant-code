import { generateCompactId } from '@savant-code/common/util/string'
import { cloneDeep } from 'lodash'

import { resolveCustomToolResult } from './custom-result'
import { resolveExecutionPolicy } from './execution-policy'
import { checkSandboxPolicy } from './sandbox-gate'
import { isTrustedCustomToolDefinitions } from './trusted-custom-tool-definitions'
import { getOrCreateEnforcement } from '../../echo/enforcement'
import {
  buildComplianceWarningChunks,
  formatBlockingError,
} from '../../echo/violation-handler'
import { resolveYagniEnforced } from '../../echo/yagni-pre-write-gate'
import { buildHookInput, getHookEngine } from '../../hooks/engine'
import { getMCPToolData } from '../../mcp'
import { formatValueForError } from '../../util/format-value'
import { parseRawCustomToolCall } from '../tool-call-parse'

import type { CustomToolCall, ToolCallError } from '../tool-call-parse'
import type { ExecuteToolCallParams } from './types'
import type { JSONValue } from '@savant-code/common/types/json'
import type { CustomToolDefinitions } from '@savant-code/common/util/file'

export async function executeCustomToolCall(
  params: ExecuteToolCallParams<string>,
): Promise<void> {
  const {
    toolName,
    input,
    autoInsertEndStepParam = false,
    excludeToolFromMessageHistory = false,
    agentState,
    agentTemplate,
    fileContext,
    logger,
    onResponseChunk,
    previousToolCallFinished,
    requestToolCall,
    toolCallId,
    toolCalls,
    toolCallsToAddToMessageHistory,
    toolResults,
    toolResultsToAddToMessageHistory,
    userInputId,
  } = params
  const toolStartedAt = Date.now()
  const hookProjectRoot = fileContext?.projectRoot ?? fileContext?.cwd ?? ''
  let toolFinished = false
  const recordToolEvent = (
    event: 'tool_started' | 'tool_finished',
    status?: 'completed' | 'failed' | 'cancelled',
  ): void => {
    try {
      params.traceWriter?.recordEvent?.({
        event,
        runId: params.runId,
        agentId: agentState.agentId,
        agentType: agentTemplate.id,
        phase: 'tool',
        status,
        toolName: toolName.slice(0, 80),
        durationMs:
          event === 'tool_finished' ? Date.now() - toolStartedAt : undefined,
      })
    } catch {
      // Runtime tracing is observational and must never affect execution.
    }
  }
  const finishToolEvent = (
    status: 'completed' | 'failed' | 'cancelled',
  ): void => {
    if (toolFinished) return
    toolFinished = true
    recordToolEvent('tool_finished', status)
  }
  recordToolEvent('tool_started')

  const trustedDefinitions: CustomToolDefinitions =
    isTrustedCustomToolDefinitions(params.customToolDefinitions)
      ? params.customToolDefinitions
      : await getMCPToolData({
          toolNames: agentTemplate.toolNames,
          mcpServers: agentTemplate.mcpServers,
          writeTo: cloneDeep(fileContext.customToolDefinitions),
          requestMcpToolData: params.requestMcpToolData,
          logger: params.logger,
        })

  let toolCall: CustomToolCall | ToolCallError
  try {
    toolCall = parseRawCustomToolCall({
      // FID-2026-0802-005 H8: use the step-built definitions only when they
      // carry the runtime trust marker. Untrusted caller-supplied definitions
      // are rebuilt from the host file context and discovered MCP tools so a
      // caller cannot downgrade a tool's effect or permission metadata.
      customToolDefs: trustedDefinitions,
      rawToolCall: {
        toolName,
        toolCallId: toolCallId ?? generateCompactId(),
        input: input as JSONValue,
      },
      autoInsertEndStepParam,
    })
  } catch (error) {
    finishToolEvent(params.signal.aborted ? 'cancelled' : 'failed')
    throw error
  }

  if ('error' in toolCall) {
    const formattedInput = formatValueForError(input)
    onResponseChunk({
      type: 'error',
      message: `${toolCall.error}\n\nOriginal tool call input:\n${formattedInput}`,
    })
    logger.debug(
      { toolCall, error: toolCall.error },
      `${toolName} error: ${toolCall.error}`,
    )
    finishToolEvent('failed')
    return previousToolCallFinished
  }

  const executionPolicy = resolveExecutionPolicy({
    fileContext,
    agentState,
  })

  // Custom tools participate in the same protocol, sandbox, and capability
  // gates as native tools. The definition set used here is runtime-trusted:
  // it was either built for this step or rebuilt from host context plus
  // discovered MCP tools. Caller-supplied metadata cannot downgrade it.
  const declaredSafety = trustedDefinitions[toolCall.toolName]
  const declaredEffect = declaredSafety?.effect ?? 'mixed'
  if (!declaredSafety?.effect || !declaredSafety.permission) {
    onResponseChunk({
      type: 'error',
      message: `Tool \`${toolName}\` is missing an explicit host safety contract.`,
    })
    finishToolEvent('failed')
    return previousToolCallFinished
  }
  if (!['read', 'network'].includes(declaredEffect)) {
    onResponseChunk({
      type: 'error',
      message: `Tool \`${toolName}\` declares unsupported local side effects. Custom extension tools must declare read or network effects until an audited write adapter exists.`,
    })
    finishToolEvent('failed')
    return previousToolCallFinished
  }

  const sandboxRejected = checkSandboxPolicy({
    isDevOverride: executionPolicy.allowSandboxOverride,
    toolName,
    toolCallToolName: toolCall.toolName,
    toolCallInput: toolCall.input,
    projectRoot: fileContext.projectRoot,
    permissionMode: fileContext.permissionMode,
    safetyOverride:
      declaredSafety?.effect && declaredSafety.permission
        ? {
            effect: declaredSafety.effect,
            permission: declaredSafety.permission,
            reason:
              declaredSafety.description ??
              'Host-declared extension-tool policy.',
          }
        : undefined,
    logger,
    onResponseChunk,
  })
  if (sandboxRejected) {
    finishToolEvent('failed')
    return previousToolCallFinished
  }

  const enforcement = getOrCreateEnforcement(agentState)
  const enforceResult = enforcement.beforeToolCall({
    toolName,
    input: toolCall.input as Record<string, unknown>,
    agentId: agentState.agentId,
    // FID-2026-0822-004: yagni gate text channel + config-respect. Custom
    // tools are read/network-only so the gate is inert here, but the thread
    // keeps the enforcement surface consistent.
    assistantText: params.fullResponse,
    yagniEnforced: resolveYagniEnforced(params.fileContext?.projectRoot),
  })
  for (const chunk of buildComplianceWarningChunks(enforceResult.warnings)) {
    onResponseChunk(chunk)
  }
  if (enforceResult.blocked) {
    // FID-2026-0901-002: silent blocks (self-healing gates) get steering
    // only — no visible BLOCKED error chunk in the transcript.
    if (!enforceResult.silent) {
      onResponseChunk({
        type: 'error',
        message: formatBlockingError(enforceResult.reason ?? 'ECHO violation'),
      })
    }
    finishToolEvent('failed')
    return previousToolCallFinished
  }

  // FID-2026-0814-003: PreToolUse hooks — the parallel gate for custom/MCP
  // tools (omitting it would create a bypass for custom tool implementations).
  // EHEL already blocked above → the hook is skipped (EHEL wins). Fail-open.
  if (hookProjectRoot) {
    const hookGate = await getHookEngine(hookProjectRoot).triggerBlock(
      buildHookInput({
        event: 'PreToolUse',
        sessionId: agentState?.runId ?? agentState?.agentId ?? toolName,
        cwd: hookProjectRoot,
        toolName,
        toolInput: toolCall.input as Record<string, JSONValue>,
      }),
    )
    if (hookGate.blocked) {
      onResponseChunk({
        type: 'error',
        message: formatBlockingError(
          `Hook blocked ${toolName}: ${hookGate.reasons.join('; ') || 'project policy denied this action'}`,
        ),
      })
      finishToolEvent('failed')
      return previousToolCallFinished
    }
  }

  // Filter out restricted tools - emit error instead of tool call/result.
  // This prevents the CLI from showing calls that the agent cannot use.
  if (
    !executionPolicy.allowCapabilityOverride &&
    !agentTemplate.toolNames.includes(toolCall.toolName)
  ) {
    // Emit an error event instead of tool call/result pair
    // The stream parser will convert this to a user message for proper API compliance
    onResponseChunk({
      type: 'error',
      message: `Tool \`${toolName}\` is not currently available. Make sure to only use tools listed in the system instructions.`,
    })
    finishToolEvent('failed')
    return previousToolCallFinished
  }

  // Only emit tool_call event after permission check passes
  onResponseChunk({
    type: 'tool_call',
    toolCallId: toolCall.toolCallId,
    toolName,
    input: toolCall.input,
    // Only include agentId for subagents (agents with a parent)
    ...(agentState?.parentId && { agentId: agentState.agentId }),
    // Include includeToolCall flag if explicitly set to false
    ...(excludeToolFromMessageHistory && { includeToolCall: false }),
  })

  toolCalls.push(toolCall)
  if (!excludeToolFromMessageHistory) {
    toolCallsToAddToMessageHistory.push(toolCall)
  }

  return await resolveCustomToolResult({
    previousToolCallFinished,
    params: { signal: params.signal },
    toolCall,
    enforcement,
    hookProjectRoot,
    toolName,
    input,
    logger,
    onResponseChunk,
    agentState,
    agentTemplate,
    userInputId,
    excludeToolFromMessageHistory,
    toolCalls,
    toolResults,
    toolCallsToAddToMessageHistory,
    toolResultsToAddToMessageHistory,
    requestToolCall,
    recordToolEvent,
    finishToolEvent,
  })
}
