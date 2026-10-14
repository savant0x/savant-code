import { BOOT_LEARNINGS_PATH } from '@savant-code/common/constants/learnings-boot'

import { captureToolResultEvidence } from './evidence-capture'
import { completeGroundingReads } from './grounding-read'
import {
  isRedispatchable,
  markToolOutcomeReady,
  resetToolOutcomes,
  toolOutcomeState,
} from './tool-outcome-state'
import {
  hasCommandFailure,
  hasToolResultError,
  inspectToolResultFailure,
} from './tool-result-errors'
import { extractFailingPathsFromContent } from './verification-failure-paths'
import { isWriteToolName, resolveFidIdForWrite } from './write-bookkeeping'
import { appendGroundingRefresh } from '../../echo/grounding'
import { buildHookInput, getHookEngine } from '../../hooks/engine'
import { getOrCreateProvenance } from '../../provenance'
import { setActivity } from '../../util/activity-tracking'
import { getSuccessfulFileContent } from '../handlers/tool/write-file'

import type { ResultLifecycleDeps } from './result-rejection-lifecycle'
import type { ToolOutcomeState } from './tool-outcome-state'
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
 *
 * FID-2026-1006-002 WP3: both branches record the tool call's outcome state
 * (`outcome_ready`) at the point the outcome is materialized —
 * `docs/tool-outcome-durability.md`. The state model lives in
 * `./tool-outcome-state` and is re-exported here, where the FID places it.
 */
export {
  isRedispatchable,
  markToolOutcomeReady,
  resetToolOutcomes,
  toolOutcomeState,
}
export type { ToolOutcomeState }
export { runRejectionLifecycle } from './result-rejection-lifecycle'
export type { ResultLifecycleDeps } from './result-rejection-lifecycle'

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

  // FID-2026-0824-026 / FID-2026-1007-004: this is the seam where retention is
  // DECIDED — it is already async, and it is ordered before every compaction
  // layer. `./evidence-capture` owns the capture, the verdict transport and the
  // ceiling report; the boundary only calls it. Never blocks tool execution.
  captureToolResultEvidence({
    logger: params.logger,
    projectRoot: params.fileContext?.projectRoot,
    runId: agentState.runId,
    agentId: agentState.agentId,
    toolCallId: toolCall.toolCallId,
    toolName,
    output,
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

  // FID-2026-1006-002 WP3: the outcome is materialized. Everything below is
  // auxiliary progress, and auxiliary progress never proves completion.
  markToolOutcomeReady(toolCall.toolCallId)

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
    const reads = completeGroundingReads({
      output: toolResult.content,
      hasWindow: 'offset' in toolCall.input || 'limit' in toolCall.input,
    })
    enforcement.recordSuccessfulGroundingRead(reads.map((read) => read.path))
    for (const read of reads)
      if (read.path.replaceAll('\\', '/').toLowerCase() === BOOT_LEARNINGS_PATH)
        params.logger.debug(
          {
            bootLearningCharacters: read.characters,
            bootLearningBytes: read.bytes,
          },
          'Boot learning payload measured',
        )
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
  const commandSucceeded = !hasCommandFailure(toolResult.content)
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
    commandSucceeded,
    // FID-2026-0927-003 F2: which files the failure named (see the module).
    verificationFailurePaths: commandSucceeded
      ? undefined
      : extractFailingPathsFromContent(toolResult.content),
  })

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
    // FID-2026-1012-023: one traversal yields the failure line AND the
    // identity of the value that produced it, so the record can name the tool
    // that was executed and not only the one the message mentions.
    const inspection = inspectToolResultFailure(toolResult.content)
    const failed = inspection.failed
    getHookEngine(hookProjectRoot).fireAndForgetTrigger(
      buildHookInput({
        event: failed ? 'PostToolUseFailure' : 'PostToolUse',
        sessionId: agentState.runId ?? agentState.agentId,
        cwd: hookProjectRoot,
        toolName,
        toolInput: toolCall.input as Record<string, JSONValue>,
        toolResult: toolResult.content as unknown as JSONValue,
        // FID-2026-0909-005: surface the real error text so the ledger's
        // dedup key groups by error class; generic = shape-drift fallback.
        ...(failed ? { errorMessage: inspection.line } : {}),
        ...(failed && inspection.commandExecution
          ? { commandExecution: inspection.commandExecution }
          : {}),
        // FID-2026-1012-024 Loop 12: the harness's own classification of the
        // outcome travels with the failure, so a deliberate steering refusal is
        // recorded as an expected outcome instead of ranking as a defect. It is
        // set by the walker's refusal branch only, never inferred here.
        ...(failed && inspection.expectedness
          ? { expectedness: inspection.expectedness }
          : {}),
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
