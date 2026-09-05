import { hasToolResultError } from './tool-result-errors'
import { isWriteToolName, resolveFidIdForWrite } from './write-bookkeeping'
import { appendGroundingRefresh } from '../../echo/grounding'
import { recordEvidence } from '../../evidence/spill'
import { buildHookInput, getHookEngine } from '../../hooks/engine'
import { getOrCreateProvenance } from '../../provenance'
import { setActivity } from '../../util/activity-tracking'
import { getSuccessfulFileContent } from '../handlers/tool/write-file'

import type { GateContext } from './gate-context'
import type { ToolTrace } from './trace'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { SavantCodeToolOutput } from '@savant-code/common/tools/list'
import type { JSONValue } from '@savant-code/common/types/json'
import type { ToolMessage } from '@savant-code/common/types/messages/savant-code-message'

/**
 * Two-branch result lifecycle (extracted verbatim from
 * `tool-executor/native.ts` :621-.857 — FID-2026-0905-001).
 *
 * Success path: evidence spill → activity → tool_result chunk → history
 * pushes → grounding refresh (set_messages / read_files) → EHEL post-tool
 * tracking → ZTAP write receipt → PostToolUse(+Failure) hooks → credits.
 * Rejection path: error chunk → PostToolUseFailure hook. (FID-2026-0802-005
 * C2: rejections are converted into the retryable tool-error flow instead of
 * failing the run.)
 */
export type ResultLifecycleDeps<T extends ToolName> = {
  ctx: GateContext<T>
  trace: ToolTrace
  hookProjectRoot: string
}

export async function runSuccessLifecycle<T extends ToolName>(
  deps: ResultLifecycleDeps<T>,
  output: SavantCodeToolOutput<T>,
  creditsUsed: number | undefined,
): Promise<void> {
  const { ctx, trace, hookProjectRoot } = deps
  const { params, toolCall, toolName, enforcement } = ctx
  const onResponseChunk = params.onResponseChunk
  const agentState = params.agentState
  const agentTemplate = params.agentTemplate

  const toolResult: ToolMessage = {
    role: 'tool',
    toolName,
    toolCallId: toolCall.toolCallId,
    content: output,
  }

  // FID-2026-0824-026: fail-open evidence capture BEFORE any compaction
  // layer can clear this result. Never blocks tool execution.
  void recordEvidence({
    projectRoot: params.fileContext?.projectRoot ?? '',
    runId: agentState.runId ?? agentState.agentId,
    agentId: agentState.agentId,
    toolCallId: toolCall.toolCallId,
    toolName,
    raw: JSON.stringify(output),
  })

  // FID-2026-0718-009: M2 — on tool completion, model reasoning resumes.
  // P19: carry the effective model id (parity with step.ts thinking emit).
  setActivity(
    agentState,
    {
      kind: 'thinking',
      startedAt: Date.now(),
      model: agentTemplate.model,
    },
    onResponseChunk,
  )

  onResponseChunk({
    type: 'tool_result',
    toolCallId: toolResult.toolCallId,
    toolName: toolResult.toolName,
    output: toolResult.content,
  })

  params.toolResults.push(toolResult)

  if (!params.excludeToolFromMessageHistory) {
    params.toolResultsToAddToMessageHistory.push(toolResult)
  }

  // `set_messages` is the mutation boundary used by context-pruner and
  // other history-replacement flows. Refresh only after the handler has
  // successfully replaced the history, so the refresh cannot be removed
  // by the replacement itself.
  if (
    toolName === 'set_messages' &&
    !hasToolResultError(toolResult.content) &&
    !agentState.parentId
  ) {
    appendGroundingRefresh(
      agentState,
      enforcement.recordHistoryReplacement().refreshText,
    )
  }

  // Grounding-set progress is committed only after the read handler
  // succeeds, never merely because the model requested a path.
  if (toolName === 'read_files' && !hasToolResultError(toolResult.content)) {
    const successfulGroundingPaths = toolResult.content.flatMap((part) => {
      if (part.type !== 'json' || !Array.isArray(part.value)) return []
      return part.value.flatMap((entry) => {
        if (
          typeof entry !== 'object' ||
          entry === null ||
          Array.isArray(entry) ||
          !('path' in entry) ||
          !('content' in entry) ||
          typeof entry.path !== 'string' ||
          typeof entry.content !== 'string'
        ) {
          return []
        }
        return [entry.path]
      })
    })
    enforcement.recordSuccessfulGroundingRead(successfulGroundingPaths)
  }

  // EHEL: Post-tool enforcement tracking
  const writeInput = toolCall.input as Record<string, unknown>
  const operation =
    writeInput.operation && typeof writeInput.operation === 'object'
      ? (writeInput.operation as Record<string, unknown>)
      : undefined
  const writtenPath =
    typeof writeInput.path === 'string'
      ? writeInput.path
      : typeof operation?.path === 'string'
        ? operation.path
        : undefined
  let writtenContent =
    writtenPath && (toolName === 'write_file' || toolName === 'str_replace')
      ? getSuccessfulFileContent({
          state: params.fileProcessingState,
          path: writtenPath,
          toolCallId: toolCall.toolCallId,
        })
      : undefined
  if (
    toolName === 'apply_patch' &&
    writtenPath !== undefined &&
    !hasToolResultError(toolResult.content)
  ) {
    try {
      const postPatchContent = await params.requestOptionalFile({
        filePath: writtenPath,
      })
      writtenContent = postPatchContent ?? undefined
    } catch {
      // Strict turn-end scanning fails closed when the host cannot return
      // a trustworthy post-patch snapshot; do not turn a read failure
      // into a false successful-content claim.
      writtenContent = undefined
    }
  }
  const writeSucceeded =
    writtenPath !== undefined && !hasToolResultError(toolResult.content)
  enforcement.afterToolCall({
    toolName,
    input: toolCall.input as Record<string, unknown>,
    result: {
      text:
        typeof toolResult.content === 'string' ? toolResult.content : undefined,
    },
    writtenContent,
    // A successful handler with an unavailable snapshot must remain in
    // the dirty ledger so strict turn-end scanning fails closed. Only an
    // explicit tool-result error suppresses the write lifecycle.
    writeSucceeded,
  })

  // FID-2026-0813-004: ZTAP write-boundary receipt creation. Runs after
  // the write lifecycle completes; never holds or blocks the write
  // (append-only chain, D1). Best-effort in record mode; enforce mode
  // fails closed at the pre-write gate (below) so an exception here is
  // defense-in-depth only.
  if (
    writtenPath !== undefined &&
    writeSucceeded &&
    writtenContent !== undefined &&
    isWriteToolName(toolName)
  ) {
    const provenance = getOrCreateProvenance(agentState, {
      projectRoot: params.fileContext.projectRoot,
    })
    void provenance
      .recordWriteReceipt({
        path: writtenPath,
        tool: toolName,
        content: writtenContent,
        writerAgentId: agentState.agentId,
        writerAgentType: agentTemplate.id,
        fsmPhase: agentState.fsmPhase ?? 'idle',
        fidId: resolveFidIdForWrite(writtenPath, agentState),
        lawChecks: ctx.writeLawChecks,
      })
      .then((receipt) => {
        if (!receipt) return
        // FID-2026-0813-009: the CLI matrix consumes only this signed
        // receipt event. It is observational; it cannot dispatch tools.
        onResponseChunk({
          type: 'provenance_receipt',
          sessionId: receipt.sessionId,
          seq: receipt.seq,
          phase: 'write',
          status: receipt.status,
          signed: receipt.signatures.length > 0,
          receipt,
        })
      })
      .catch((error) => {
        // Enforce mode fails closed at the gate; record mode surfaces a
        // visible notice and continues (the write already succeeded).
        params.logger.warn(
          { toolName, path: writtenPath, error: String(error) },
          'ZTAP receipt creation failed',
        )
      })
  }

  // After tool completes, resolve any pending creditsUsed promise
  trace.finishToolEvent('completed')

  // FID-2026-0814-003: PostToolUse / PostToolUseFailure — observation
  // only, fire-and-forget. A tool whose result carries an error counts as
  // a PostToolUseFailure so the event has an honest caller.
  if (hookProjectRoot) {
    const failed = hasToolResultError(toolResult.content)
    getHookEngine(hookProjectRoot).fireAndForgetTrigger(
      buildHookInput({
        event: failed ? 'PostToolUseFailure' : 'PostToolUse',
        sessionId: agentState.runId ?? agentState.agentId,
        cwd: hookProjectRoot,
        toolName,
        toolInput: toolCall.input as Record<string, JSONValue>,
        toolResult: toolResult.content as unknown as JSONValue,
        ...(failed ? { errorMessage: 'tool result contains an error' } : {}),
      }),
    )
  }

  if (creditsUsed) {
    void params.onCostCalculated(creditsUsed)
    params.logger.debug(
      { credits: creditsUsed, totalCredits: agentState.creditsUsed },
      `Added ${creditsUsed} credits from ${String(toolName)} to agent state`,
    )
  }
}

export async function runRejectionLifecycle<T extends ToolName>(
  deps: ResultLifecycleDeps<T>,
  error: unknown,
): Promise<void> {
  const { ctx, trace, hookProjectRoot } = deps
  const { params, toolCall, toolName } = ctx
  // FID-2026-0802-005 C2: rejections are caught here and converted into
  // the same retryable tool-error flow instead of failing the run.
  const errorMessage = error instanceof Error ? error.message : String(error)
  params.onResponseChunk({
    type: 'error',
    message: `Tool \`${String(toolName)}\` failed: ${errorMessage}`,
  })
  params.logger.error(
    { toolName, errorMessage },
    `Tool \`${String(toolName)}\` failed: ${errorMessage}`,
  )
  trace.finishToolEvent('failed')
  // FID-2026-0814-003: PostToolUseFailure from the rejection path.
  if (hookProjectRoot) {
    getHookEngine(hookProjectRoot).fireAndForgetTrigger(
      buildHookInput({
        event: 'PostToolUseFailure',
        sessionId: params.agentState.runId ?? params.agentState.agentId,
        cwd: hookProjectRoot,
        toolName,
        toolInput: toolCall.input as Record<string, JSONValue>,
        errorMessage,
      }),
    )
  }
}
