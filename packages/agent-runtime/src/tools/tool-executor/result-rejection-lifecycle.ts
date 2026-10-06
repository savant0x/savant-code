import { markToolOutcomeReady } from './tool-outcome-state'
import { buildHookInput, getHookEngine } from '../../hooks/engine'

import type { GateContext } from './gate-context'
import type { ToolTrace } from './trace'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { JSONValue } from '@savant-code/common/types/json'

/**
 * Rejection branch of the two-branch result lifecycle, extracted from
 * `result-lifecycle.ts` so both files stay under the repo's per-file size
 * ceiling (FID-2026-1006-002 WP3; the extraction is verbatim).
 *
 * FID-2026-0802-005 C2: rejections are converted into the retryable tool-error
 * flow instead of failing the run.
 */

/** Deps shared by both lifecycle branches. */
export type ResultLifecycleDeps<T extends ToolName> = {
  ctx: GateContext<T>
  trace: ToolTrace
  hookProjectRoot: string
}

export async function runRejectionLifecycle<T extends ToolName>(
  deps: ResultLifecycleDeps<T>,
  error: unknown,
): Promise<void> {
  const { ctx, trace, hookProjectRoot } = deps
  const { params, toolCall, toolName } = ctx
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
  // FID-2026-1006-002 WP3: a rejection is a settled outcome, not pending work.
  markToolOutcomeReady(toolCall.toolCallId)
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
