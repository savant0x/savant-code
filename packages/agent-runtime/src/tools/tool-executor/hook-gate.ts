import { isWriteToolName } from './write-bookkeeping'
import { formatBlockingError } from '../../echo/violation-handler'
import { buildHookInput, getHookEngine } from '../../hooks/engine'
import { getOrCreateProvenance } from '../../provenance'

import type { GateContext, GateHalt, GateStage } from './gate-context'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

/**
 * PreToolUse hook gate (extracted verbatim from `tool-executor/native.ts`
 * :372 context — FID-2026-0905-001).
 *
 * FID-2026-0814-003: PreToolUse hooks — an ADDITIONAL project gate at the
 * EHEL enforcement point, never a bypass. EHEL already blocked above → the
 * hook is skipped (EHEL wins). A hook block surfaces through the same
 * blocking-error path as EHEL advisories; any hook failure fails open.
 */
export function createHookGate<T extends ToolName>(deps: {
  logger: Logger
  onResponseChunk: (chunk: string | PrintModeEvent) => void
  hookProjectRoot: () => string
}): GateStage<T> {
  return async (ctx: GateContext<T>): Promise<GateHalt> => {
    const hookProjectRoot = deps.hookProjectRoot()
    if (!hookProjectRoot) {
      return { halt: false }
    }
    const hookGate = await getHookEngine(hookProjectRoot).triggerBlock(
      buildHookInput({
        event: 'PreToolUse',
        sessionId: ctx.params.agentState.runId ?? ctx.params.agentState.agentId,
        cwd: hookProjectRoot,
        toolName: ctx.toolCall.toolName,
        toolInput: ctx.toolCall.input as Record<string, JSONValue>,
      }),
    )
    if (hookGate.blocked) {
      deps.onResponseChunk({
        type: 'error',
        message: formatBlockingError(
          `Hook blocked ${ctx.toolCall.toolName}: ${hookGate.reasons.join('; ') || 'project policy denied this action'}`,
        ),
      })
      return { halt: true, status: 'failed' }
    }
    return { halt: false }
  }
}

/**
 * FID-2026-0813-004: ZTAP `enforce` mode fails closed BEFORE dispatch.
 * If the writer's role key cannot be derived (crypto unavailable), the
 * write is blocked with a visible reason — no unsigned write is ever
 * allowed in enforce mode. Record/off modes never block here.
 * (Extracted verbatim from `tool-executor/native.ts` — FID-2026-0905-001.)
 */
export function createProvenanceGate<T extends ToolName>(deps: {
  logger: Logger
  onResponseChunk: (chunk: string | PrintModeEvent) => void
}): GateStage<T> {
  return async (ctx: GateContext<T>): Promise<GateHalt> => {
    if (!isWriteToolName(ctx.toolCall.toolName)) {
      return { halt: false }
    }
    const provenance = getOrCreateProvenance(ctx.params.agentState, {
      projectRoot: ctx.params.fileContext.projectRoot,
    })
    if (provenance.mode === 'enforce') {
      try {
        await provenance.getRoleKey(ctx.params.agentTemplate.id)
      } catch (error) {
        deps.onResponseChunk({
          type: 'error',
          message: `ZTAP enforce mode: cannot sign this write (${String(error)}). Blocking to fail closed — set provenance.mode to record or off to allow unsigned writes.`,
        })
        return { halt: true, status: 'failed' }
      }
    }
    return { halt: false }
  }
}
