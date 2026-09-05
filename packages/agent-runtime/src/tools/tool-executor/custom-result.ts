// FID-2026-0819-005 Loop 245: custom/MCP tool result resolution, extracted
// verbatim from custom.ts (the previousToolCallFinished.then chain: client
// round-trip, tool_result emission, afterToolCall, PostToolUse hooks, and
// the rejection path driving hadToolCallError).

import { buildHookInput, getHookEngine } from '../../hooks/engine'
import { MCP_TOOL_SEPARATOR } from '../../mcp-constants'

import type { getOrCreateEnforcement } from '../../echo/enforcement'
import type { CustomToolCall } from '../tool-call-parse'
import type { ExecuteToolCallParams } from './types'
import type { JSONValue } from '@savant-code/common/types/json'
import type { ToolResultOutput } from '@savant-code/common/types/messages/content-part'
import type { ToolMessage } from '@savant-code/common/types/messages/savant-code-message'

function resolveMcpToolName(toolName: string): string {
  return toolName.includes(MCP_TOOL_SEPARATOR)
    ? toolName.split(MCP_TOOL_SEPARATOR).slice(1).join(MCP_TOOL_SEPARATOR)
    : toolName
}

export async function resolveCustomToolResult({
  previousToolCallFinished,
  params,
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
}: {
  previousToolCallFinished: ExecuteToolCallParams<string>['previousToolCallFinished']
  params: { signal: AbortSignal }
  toolCall: CustomToolCall
  enforcement: Awaited<ReturnType<typeof getOrCreateEnforcement>>
  hookProjectRoot: string
  toolName: string
  input: unknown
  logger: ExecuteToolCallParams<string>['logger']
  onResponseChunk: ExecuteToolCallParams<string>['onResponseChunk']
  agentState: ExecuteToolCallParams<string>['agentState']
  agentTemplate: ExecuteToolCallParams<string>['agentTemplate']
  userInputId: ExecuteToolCallParams<string>['userInputId']
  excludeToolFromMessageHistory: boolean
  toolCalls: ExecuteToolCallParams<string>['toolCalls']
  toolResults: ExecuteToolCallParams<string>['toolResults']
  toolCallsToAddToMessageHistory: ExecuteToolCallParams<string>['toolCallsToAddToMessageHistory']
  toolResultsToAddToMessageHistory: ExecuteToolCallParams<string>['toolResultsToAddToMessageHistory']
  requestToolCall: ExecuteToolCallParams<string>['requestToolCall']
  recordToolEvent: (
    event: 'tool_started' | 'tool_finished',
    status?: 'completed' | 'failed' | 'cancelled',
  ) => void
  finishToolEvent: (status: 'completed' | 'failed' | 'cancelled') => void
}): Promise<void> {
  return await previousToolCallFinished
    .then(async () => {
      if (params.signal.aborted) {
        recordToolEvent('tool_finished', 'cancelled')
        return null
      }

      const resolvedToolName = resolveMcpToolName(toolCall.toolName)
      const clientToolResult = await requestToolCall({
        userInputId,
        toolName: resolvedToolName,
        input: toolCall.input,
        mcpConfig: toolCall.toolName.includes(MCP_TOOL_SEPARATOR)
          ? agentTemplate.mcpServers[
              toolCall.toolName.split(MCP_TOOL_SEPARATOR)[0]
            ]
          : undefined,
      })
      return clientToolResult.output satisfies ToolResultOutput[]
    })
    .then(
      (result) => {
        if (!result) {
          return
        }
        const toolResult = {
          role: 'tool',
          toolName: resolveMcpToolName(toolName),
          toolCallId: toolCall.toolCallId,
          content: result,
        } satisfies ToolMessage
        logger.debug(
          { input, toolResult },
          `${toolName} custom tool call & result (${toolResult.toolCallId})`,
        )
        onResponseChunk({
          type: 'tool_result',
          toolName: toolResult.toolName,
          toolCallId: toolResult.toolCallId,
          output: toolResult.content,
        })

        toolResults.push(toolResult)

        if (!excludeToolFromMessageHistory) {
          toolResultsToAddToMessageHistory.push(toolResult)
        }

        enforcement.afterToolCall({
          toolName,
          input: toolCall.input as Record<string, unknown>,
          result: {
            text:
              typeof toolResult.content === 'string'
                ? toolResult.content
                : undefined,
          },
          // Custom tools are explicitly restricted to non-local read/network
          // effects above; they cannot claim a local write lifecycle without a
          // dedicated audited snapshot adapter.
          writeSucceeded: false,
        })

        finishToolEvent('completed')

        // FID-2026-0814-003: PostToolUse — observation only.
        if (hookProjectRoot) {
          getHookEngine(hookProjectRoot).fireAndForgetTrigger(
            buildHookInput({
              event: 'PostToolUse',
              sessionId: agentState?.runId ?? agentState?.agentId ?? toolName,
              cwd: hookProjectRoot,
              toolName,
              toolInput: toolCall.input as Record<string, JSONValue>,
              toolResult: result as unknown as JSONValue,
            }),
          )
        }
        return
      },
      async (error) => {
        // FID-2026-0802-005 C2 (custom-tool parity): a rejected custom/MCP
        // tool request must surface as a tool error (driving the
        // hadToolCallError retry flow) instead of rejecting
        // previousToolCallFinished and failing the whole run — the same
        // failure mode C2 fixed for native handlers.
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        onResponseChunk({
          type: 'error',
          message: `Tool \`${toolName}\` failed: ${errorMessage}`,
        })
        logger.error(
          { toolName, errorMessage },
          `Tool \`${toolName}\` failed: ${errorMessage}`,
        )
        finishToolEvent('failed')
        // FID-2026-0814-003: PostToolUseFailure from the rejection path.
        if (hookProjectRoot) {
          getHookEngine(hookProjectRoot).fireAndForgetTrigger(
            buildHookInput({
              event: 'PostToolUseFailure',
              sessionId: agentState?.runId ?? agentState?.agentId ?? toolName,
              cwd: hookProjectRoot,
              toolName,
              toolInput: toolCall.input as Record<string, JSONValue>,
              errorMessage,
            }),
          )
        }
      },
    )
    .catch((error) => {
      finishToolEvent(params.signal.aborted ? 'cancelled' : 'failed')
      throw error
    })
}
