import { resolveExecutionPolicy } from './execution-policy'
import { checkSandboxPolicy } from './sandbox-gate'
import { runWriteGate } from './write-gate'

import type { GateContext, GateHalt, GateStage } from './gate-context'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

/**
 * Pre-dispatch gate stages (extracted verbatim from
 * `tool-executor/native.ts` — FID-2026-0905-001). ORDER IS LOAD-BEARING:
 *
 *   1. parse-error (C1, FID-2026-0802-005) — precedes ANY input dereference
 *   2. capability allowlist — undeclared tools are rejected before side effects
 *   3. write/containment gate + FSM phase gate (FID-2026-0718-013 v3 F3)
 *   4. sandbox policy (FID-2026-07-27-001)
 *
 * Reordering any of these can silently bypass a law. The characterization
 * suite (`src/__tests__/tool-executor-gate-order.test.ts`) pins the order.
 */

export function createParseErrorGate<T extends ToolName>(deps: {
  logger: Logger
  onResponseChunk: (chunk: string | PrintModeEvent) => void
  formatValueForError: (input: unknown) => string
}): GateStage<T> {
  return (ctx: GateContext<T>): GateHalt => {
    if ('error' in ctx.toolCall) {
      const toolCall = ctx.toolCall as { error: string }
      const formattedInput = deps.formatValueForError(ctx.params.input)
      deps.onResponseChunk({
        type: 'error',
        message: `${toolCall.error}\n\nOriginal tool call input:\n${formattedInput}`,
      })
      deps.logger.debug(
        { toolCall: ctx.toolCall, error: toolCall.error },
        `${String(ctx.toolName)} error: ${toolCall.error}`,
      )
      return { halt: true, status: 'failed' }
    }
    return { halt: false }
  }
}

export function createCapabilityGate<T extends ToolName>(deps: {
  onResponseChunk: (chunk: string | PrintModeEvent) => void
  isCapabilityOverride: () => boolean
  declaredToolNames: () => readonly string[]
}): GateStage<T> {
  return (ctx: GateContext<T>): GateHalt => {
    if (
      !deps.isCapabilityOverride() &&
      ctx.toolCall.toolName &&
      !deps.declaredToolNames().includes(ctx.toolCall.toolName)
    ) {
      // Emit an error event instead of tool call/result pair
      // The stream parser will convert this to a user message for proper API compliance
      deps.onResponseChunk({
        type: 'error',
        message: `Tool \`${String(ctx.toolName)}\` is not currently available [agent: ${ctx.params.agentTemplate.id}]. Make sure to only use tools provided at the start of the conversation AND that you most recently have permission to use.`,
      })
      return { halt: true, status: 'failed' }
    }
    return { halt: false }
  }
}

export function createWriteAndFsmGate<T extends ToolName>(deps: {
  logger: Logger
  onResponseChunk: (chunk: string | PrintModeEvent) => void
  isFsmOverride: () => boolean
}): GateStage<T> {
  return async (ctx: GateContext<T>): Promise<GateHalt> => {
    // FID-2026-0718-013 v3 F3: containment check runs for every write, regardless
    // of development mode (see runWriteGate). The FSM phase check below remains
    // gated by the typed execution policy's FSM override.
    const writeGate = await runWriteGate({
      toolName: ctx.toolName,
      toolCall: ctx.toolCall,
      fileContext: ctx.params.fileContext,
      agentState: ctx.params.agentState,
      agentTemplate: ctx.params.agentTemplate,
      isDevOverride: deps.isFsmOverride(),
      checkpointDir: ctx.params.checkpointDir,
      checkpointTurnId: ctx.params.checkpointTurnId,
      clientSessionId: ctx.params.clientSessionId,
      onResponseChunk: deps.onResponseChunk,
    })
    if (writeGate.rejected) {
      return { halt: true, status: 'failed' }
    }
    // FID-2026-0804-009: stash the resolved path for the post-sandbox Law 1
    // record (sandbox-denied writes must not count toward the footprint).
    ctx.resolvedWritePath = writeGate.resolvedWritePath

    // ECHO FSM tool gating: block bash/terminal commands unless phase is
    // 'audit', 'green', or 'self_correct'.
    // run_readonly_command is intentionally NOT gated here; it is allowed in
    // every FSM phase and enforces read-only safety in its own handler.
    // FID-2026-0725-085 BUG-004: FSM phase check runs FIRST (more actionable error).
    // FID-2026-0806-016: 'self_correct' added so audit/adversarial findings can be
    // fixed AND verified inline (Law 3 dirty-file gate) without deadlocking —
    // matches the documented phase table (common/src/constants/agents.ts) which
    // grants run_terminal_command to self_correct. Previously self_correct could
    // not run terminal commands and could not reach 'audit' (VALID_TRANSITIONS),
    // and 'green' is FID-gated — a hard deadlock for read-only audits.
    if (
      !deps.isFsmOverride() &&
      ctx.toolCall.toolName === 'run_terminal_command' &&
      !['audit', 'green', 'self_correct'].includes(
        ctx.params.agentState.fsmPhase ?? 'idle',
      )
    ) {
      deps.onResponseChunk({
        type: 'error',
        message: `Tool \`${String(ctx.toolName)}\` is only available during AUDIT, GREEN, or SELF-CORRECT phases. Current phase: ${ctx.params.agentState.fsmPhase}. Call transition_phase to enter AUDIT, GREEN, or SELF-CORRECT first.`,
      })
      return { halt: true, status: 'failed' }
    }

    // FID-2026-0725-085 BUG-006: Log warning when devMode bypasses safety restrictions.
    if (
      deps.isFsmOverride() &&
      (ctx.toolCall.toolName === 'write_file' ||
        ctx.toolCall.toolName === 'str_replace' ||
        ctx.toolCall.toolName === 'apply_patch' ||
        ctx.toolCall.toolName === 'run_terminal_command')
    ) {
      deps.logger.debug(
        { toolName: ctx.toolName, fsmPhase: ctx.params.agentState.fsmPhase },
        `DEV MODE: ${String(ctx.toolName)} bypassing FSM phase gating`,
      )
    }
    return { halt: false }
  }
}

export function createSandboxGate<T extends ToolName>(deps: {
  logger: Logger
  onResponseChunk: (chunk: string | PrintModeEvent) => void
  isSandboxOverride: () => boolean
}): GateStage<T> {
  return (ctx: GateContext<T>): GateHalt => {
    // FID-2026-07-27-001: Evaluate tool call against the sandbox policy after
    // FSM and agent-restriction gating, but before streaming the tool_call event
    // or invoking the handler. The typed execution policy controls the sandbox
    // override independently from capability and FSM overrides.
    const sandboxRejected = checkSandboxPolicy({
      isDevOverride: deps.isSandboxOverride(),
      toolName: ctx.toolName,
      toolCallToolName: ctx.toolCall.toolName,
      toolCallInput: ctx.toolCall.input as Record<string, JSONValue>,
      projectRoot: ctx.params.fileContext?.projectRoot,
      permissionMode: ctx.params.fileContext.permissionMode,
      logger: deps.logger,
      onResponseChunk: deps.onResponseChunk,
    })
    if (sandboxRejected) {
      return { halt: true, status: 'failed' }
    }
    return { halt: false }
  }
}

/** Resolve the typed execution policy once per call (native.ts:137). */
export function resolvePolicyForContext<T extends ToolName>(
  params: GateContext<T>['params'],
): GateContext<T>['executionPolicy'] {
  const policy = resolveExecutionPolicy({
    fileContext: params.fileContext,
    agentState: params.agentState,
  })
  return {
    allowCapabilityOverride: policy.allowCapabilityOverride,
    allowFsmOverride: policy.allowFsmOverride,
    allowSandboxOverride: policy.allowSandboxOverride,
  }
}
