import * as fs from 'node:fs'

import { userMessage } from '@savant-code/common/util/messages'
import { generateCompactId } from '@savant-code/common/util/string'

import { recordEchoComplianceActivity } from './echo-record'
import { resolveExecutionPolicy } from './execution-policy'
import { checkSandboxPolicy } from './sandbox-gate'
import { validateSpawnAgentsInput } from './spawn-validation'
import { hasToolResultError } from './tool-result-errors'
import { runWriteGate } from './write-gate'
import { getOrCreateEnforcement } from '../../echo/enforcement'
import { appendGroundingRefresh } from '../../echo/grounding'
import {
  buildComplianceWarningChunks,
  formatBlockingError,
} from '../../echo/violation-handler'
import { resolveYagniEnforced } from '../../echo/yagni-pre-write-gate'
import { recordEvidence } from '../../evidence/spill'
import { buildHookInput, getHookEngine } from '../../hooks/engine'
import { getOrCreateProvenance } from '../../provenance'
import { toolActivity, setActivity } from '../../util/activity-tracking'
import { isSecuritySensitivePath } from '../../util/echo-compliance'
import { formatValueForError } from '../../util/format-value'
import { buildUserMessageContent } from '../../util/messages'
import { stripYagniCheckBlocksFromWritePayload } from '../../util/think-tags'
import { savantCodeToolHandlers } from '../handlers/list'
import { getSuccessfulFileContent } from '../handlers/tool/write-file'
import { countWriteLines, parseRawToolCall } from '../tool-call-parse'

import type { ExecuteToolCallParams } from './types'
import type { EchoEnforcement } from '../../echo/enforcement'
import type { SavantCodeToolHandlerFunction } from '../handlers/handler-function-type'
import type { ToolCallError } from '../tool-call-parse'
import type { ToolName } from '@savant-code/common/tools/constants'
import type {
  ClientToolCall,
  ClientToolName,
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { JSONValue } from '@savant-code/common/types/json'
import type { ToolMessage } from '@savant-code/common/types/messages/savant-code-message'
import type { WriteToolName } from '@savant-code/common/types/provenance'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * Inject EHEL corrective steering into the agent's message history (mirrors
 * the tracker's ECHO_COMPLIANCE injection in loop-iteration): budgeted
 * corrective text the running agent sees on its next model step, tagged so
 * it is recognizably harness guidance rather than user dialogue.
 *
 * ECHO_STEERING is intentionally NOT in the context-pruner's tag exclusion
 * list (unlike GRAPH_EVIDENCE): the corrective guidance is genuine
 * conversation content the agent should retain, consistent with how the
 * tracker's ECHO_COMPLIANCE steering is summarized. Do not exclude it.
 */
function injectEhelSteering(
  agentState: AgentState,
  enforcement: EchoEnforcement,
): void {
  const steering = enforcement.takeSteeringMessages()
  if (steering.length === 0) return
  agentState.messageHistory = [
    ...agentState.messageHistory,
    ...steering.map((text) =>
      userMessage({
        content: buildUserMessageContent(text, undefined, undefined),
        tags: ['ECHO_STEERING'],
        keepDuringTruncation: true,
      }),
    ),
  ]
}

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
    toolResults,
    toolResultsToAddToMessageHistory,
    userInputId,

    onCostCalculated,
    onResponseChunk,
    requestToolCall,
  } = params
  const toolCallId = params.toolCallId ?? generateCompactId()
  const toolStartedAt = Date.now()
  const hookProjectRoot =
    params.fileContext?.projectRoot ?? params.fileContext?.cwd ?? ''
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
        toolName: String(toolName).slice(0, 80),
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

  try {
    const toolCall: SavantCodeToolCall<T> | ToolCallError = parseRawToolCall<T>(
      {
        rawToolCall: {
          toolName,
          toolCallId,
          input,
        },
      },
    )

    const executionPolicy = resolveExecutionPolicy({
      fileContext: params.fileContext,
      agentState,
    })
    const isCapabilityOverride = executionPolicy.allowCapabilityOverride
    const isFsmOverride = executionPolicy.allowFsmOverride
    const isSandboxOverride = executionPolicy.allowSandboxOverride

    // FID-2026-0804-009: resolved path of the current write tool call, if any.
    // Set by the write gate; consumed by the Law 1 record AFTER the sandbox gate
    // (code-review finding — sandbox-denied writes must not count toward the
    // change footprint). Undefined for non-write tools.
    let resolvedWritePath: string | undefined

    // FID-2026-0802-005 C1: the parse-error branch MUST run before any
    // `toolCall.input` dereference. On parse failure `toolCall.input` is the raw
    // (unvalidated) input — null or a bare string would crash the write gate
    // below (`TypeError: Cannot read properties of null` / strict-mode
    // `Cannot create property 'path' on string`). This gate ordering is the
    // runtime's most important robustness invariant.
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

    // Filter out restricted tools - emit error instead of tool call/result.
    // Programmatic calls may use only the exact tool-scoped capability issued
    // after executeSingleToolCall validated the template declaration.
    if (
      !isCapabilityOverride &&
      toolCall.toolName &&
      !agentTemplate.toolNames.includes(toolCall.toolName)
    ) {
      // Emit an error event instead of tool call/result pair
      // The stream parser will convert this to a user message for proper API compliance
      onResponseChunk({
        type: 'error',
        message: `Tool \`${toolName}\` is not currently available [agent: ${agentTemplate.id}]. Make sure to only use tools provided at the start of the conversation AND that you most recently have permission to use.`,
      })
      finishToolEvent('failed')
      return previousToolCallFinished
    }

    // FID-2026-0718-013 v3 F3: containment check runs for every write, regardless
    // of development mode (see runWriteGate). The FSM phase check below remains
    // gated by the typed execution policy's FSM override.
    const writeGate = await runWriteGate({
      toolName,
      toolCall,
      fileContext: params.fileContext,
      agentState,
      agentTemplate,
      isDevOverride: isFsmOverride,
      checkpointDir: params.checkpointDir,
      checkpointTurnId: params.checkpointTurnId,
      clientSessionId: params.clientSessionId,
      onResponseChunk,
    })
    if (writeGate.rejected) {
      finishToolEvent('failed')
      return previousToolCallFinished
    }
    resolvedWritePath = writeGate.resolvedWritePath

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
      !isFsmOverride &&
      toolCall.toolName === 'run_terminal_command' &&
      !['audit', 'green', 'self_correct'].includes(
        agentState.fsmPhase ?? 'idle',
      )
    ) {
      onResponseChunk({
        type: 'error',
        message: `Tool \`${toolName}\` is only available during AUDIT, GREEN, or SELF-CORRECT phases. Current phase: ${agentState.fsmPhase}. Call transition_phase to enter AUDIT, GREEN, or SELF-CORRECT first.`,
      })
      finishToolEvent('failed')
      return previousToolCallFinished
    }

    // FID-2026-0725-085 BUG-006: Log warning when devMode bypasses safety restrictions.
    if (
      isFsmOverride &&
      (toolCall.toolName === 'write_file' ||
        toolCall.toolName === 'str_replace' ||
        toolCall.toolName === 'apply_patch' ||
        toolCall.toolName === 'run_terminal_command')
    ) {
      logger.debug(
        { toolName, fsmPhase: agentState.fsmPhase },
        `DEV MODE: ${toolName} bypassing FSM phase gating`,
      )
    }

    // FID-2026-0802-005 L11: `sequentialthinking` authorization derives from the
    // toolNames allowlist gate above (only the Thinker declares it) instead of
    // an `id.startsWith('thinker')` naming-convention check — capability is no
    // longer coupled to an agent ID string (FID-005 "identical by construction").

    // EHEL: shared enforcement factory (FID-2026-0810-002 Change 4). The
    // main-agent instance is created EAGERLY at loop start; this reuses it
    // when present and lazily creates for subagents (pre-seeded via
    // parentId) that enter tool execution without a loop-level creation.
    // Mode is read from agent session config (agentMode from UI toggle).
    const enforcement = getOrCreateEnforcement(agentState)

    // FID-2026-07-27-001: Evaluate tool call against the sandbox policy after
    // FSM and agent-restriction gating, but before streaming the tool_call event
    // or invoking the handler. The typed execution policy controls the sandbox
    // override independently from capability and FSM overrides.
    const sandboxRejected = checkSandboxPolicy({
      isDevOverride: isSandboxOverride,
      toolName,
      toolCallToolName: toolCall.toolName,
      toolCallInput: toolCall.input as Record<string, JSONValue>,
      projectRoot: params.fileContext?.projectRoot,
      permissionMode: params.fileContext.permissionMode,
      logger,
      onResponseChunk,
    })
    if (sandboxRejected) {
      finishToolEvent('failed')
      return previousToolCallFinished
    }

    // EHEL: Pre-write enforcement gate (after sandbox, before Law 1 tracking)
    // Blocks writes that violate Laws 1, 3, 7, 8, or FID Recorder gate.
    // This call is unconditional: development policy cannot bypass EHEL.
    // FID-2026-0813-002: the gate outcomes are captured into the write record
    // (and later the ZTAP receipt's lawChecks field) so law enforcement is
    // persisted, not just enforced.
    let writeLawChecks: { law: number; outcome: 'advisory' }[] = []
    {
      const enforceResult = enforcement.beforeToolCall({
        toolName: toolCall.toolName,
        input: toolCall.input as Record<string, unknown>,
        agentId: agentState.agentId,
        // FID-2026-0822-004: the yagni gate also consumes the assistant TEXT
        // channel (the Forge emits the block at the top of its response) and
        // honors `yagni.enforced` from protocol.config.yaml.
        assistantText: params.fullResponse,
        yagniEnforced: resolveYagniEnforced(params.fileContext?.projectRoot),
      })
      if (!enforceResult.blocked && enforceResult.warnings.length > 0) {
        writeLawChecks = enforceResult.warnings.map((warning) => ({
          law: warning.law,
          outcome: 'advisory' as const,
        }))
      }
      if (enforceResult.blocked) {
        // EHEL blocking results carry their advisory warnings (strict-mode
        // Law 7/8 attach the advisory to the blocked result). Surface them as
        // compliance_warning receipts first — with their ACTUAL law — then the
        // blocking error that drives the retry flow.
        for (const chunk of buildComplianceWarningChunks(
          enforceResult.warnings,
        )) {
          onResponseChunk(chunk)
        }
        onResponseChunk({
          type: 'error',
          message: formatBlockingError(
            enforceResult.reason ?? 'ECHO violation',
            enforceResult.classification,
          ),
        })
        // Steer the running agent: inject budgeted corrective text ("search
        // first" / "log intent first") so it self-corrects instead of seeing
        // only a block error.
        injectEhelSteering(agentState, enforcement)
        finishToolEvent('failed')
        return previousToolCallFinished
      }
      // EHEL advisories carry their ACTUAL law (law7 / law8 — never a
      // hardcoded law1). The tracker's receipts and the EHEL advisories emit
      // disjoint law sets, so this can never double-report a violation.
      if (enforceResult.warnings.length > 0) {
        for (const chunk of buildComplianceWarningChunks(
          enforceResult.warnings,
        )) {
          onResponseChunk(chunk)
        }
        injectEhelSteering(agentState, enforcement)
      }
    }

    // FID-2026-0822-004: sanitize write payloads AFTER the gate parsed the
    // <yagni_check> block (the gate's regex extraction is read-only) but
    // BEFORE execution, so a payload-embedded block never pollutes the
    // written file — or the tool-call display/history/Z TAP receipt, which all
    // derive from the same input object below. Covers write_file `content`,
    // str_replace `newString`/`replacements[].newString`, and apply_patch
    // `operation.diff`.
    if (isWriteToolName(toolCall.toolName)) {
      stripYagniCheckBlocksFromWritePayload(
        toolCall.input as Record<string, unknown>,
      )
    }

    // FID-2026-0814-003: PreToolUse hooks — an ADDITIONAL project gate at the
    // EHEL enforcement point, never a bypass. EHEL already blocked above → the
    // hook is skipped (EHEL wins). A hook block surfaces through the same
    // blocking-error path as EHEL advisories; any hook failure fails open.
    if (hookProjectRoot) {
      const hookGate = await getHookEngine(hookProjectRoot).triggerBlock(
        buildHookInput({
          event: 'PreToolUse',
          sessionId: agentState.runId ?? agentState.agentId,
          cwd: hookProjectRoot,
          toolName: toolCall.toolName,
          toolInput: toolCall.input as Record<string, JSONValue>,
        }),
      )
      if (hookGate.blocked) {
        onResponseChunk({
          type: 'error',
          message: formatBlockingError(
            `Hook blocked ${toolCall.toolName}: ${hookGate.reasons.join('; ') || 'project policy denied this action'}`,
          ),
        })
        finishToolEvent('failed')
        return previousToolCallFinished
      }
    }

    // FID-2026-0813-004: ZTAP `enforce` mode fails closed BEFORE dispatch.
    // If the writer's role key cannot be derived (crypto unavailable), the
    // write is blocked with a visible reason — no unsigned write is ever
    // allowed in enforce mode. Record/off modes never block here.
    if (isWriteToolName(toolCall.toolName)) {
      const provenance = getOrCreateProvenance(agentState, {
        projectRoot: params.fileContext.projectRoot,
      })
      if (provenance.mode === 'enforce') {
        try {
          await provenance.getRoleKey(agentTemplate.id)
        } catch (error) {
          onResponseChunk({
            type: 'error',
            message: `ZTAP enforce mode: cannot sign this write (${String(error)}). Blocking to fail closed — set provenance.mode to record or off to allow unsigned writes.`,
          })
          finishToolEvent('failed')
          return previousToolCallFinished
        }
      }
    }

    // FID-2026-0804-009: Law 1 (read-before-write) — evaluated AFTER the sandbox
    // gate so sandbox-denied writes are never counted toward the change footprint
    // (code-review finding). Only writes that actually dispatch reach this point;
    // the write gate above stashed the resolved path. New files and
    // content-knowledge writes (str_replace with exact oldString, apply_patch)
    // are exempt. existsSync detects brand-new files; failure degrades to "not
    // new" (worst case an info receipt).
    if (resolvedWritePath !== undefined) {
      const echoCompliance = agentState.echoCompliance
      if (echoCompliance && echoCompliance.mode !== 'off') {
        const writeInput = toolCall.input as Record<string, JSONValue>
        // FID-2026-0815-005 (F-05): awaited fs.promises.access replaces the
        // synchronous existsSync. ENOENT = genuinely absent → new file; any
        // other failure degrades to "not new" (the existing try/catch contract).
        const isNewFile = await (async () => {
          try {
            await fs.promises.access(resolvedWritePath)
            return false
          } catch (error) {
            const code =
              error instanceof Error &&
              'code' in error &&
              typeof error.code === 'string'
                ? error.code
                : undefined
            return code === 'ENOENT'
          }
        })()
        const contentKnowledge =
          toolCall.toolName === 'str_replace' ||
          toolCall.toolName === 'apply_patch'
        const content =
          typeof writeInput.content === 'string'
            ? writeInput.content
            : undefined
        const lineDelta = countWriteLines(toolCall.toolName, writeInput)
        const violation = echoCompliance.recordWrite({
          path: resolvedWritePath,
          lineDelta,
          contentKnowledge,
          isNewFile,
          content,
          securitySensitive: isSecuritySensitivePath(resolvedWritePath),
          // FID-2026-0813-002: provenance-ready identity + phase + gate outcomes.
          agentId: agentState.agentId,
          agentType: agentTemplate.id,
          fsmPhase: agentState.fsmPhase ?? 'idle',
          lawChecks: writeLawChecks,
        })
        if (violation) {
          onResponseChunk({ type: 'compliance_warning', ...violation })
        }
      }
    }

    // NOTE: Future improvement: allow tools to provide a validation function and move this logic into the spawn_agents validation function.
    // Pre-validate spawn_agents to filter out non-existent agents before streaming
    let effectiveInput: Record<string, JSONValue> = toolCall.input
    if (toolName === 'spawn_agents') {
      const spawnValidation = await validateSpawnAgentsInput({
        toolName,
        effectiveInput,
        agentTemplate,
        localAgentTemplates: params.localAgentTemplates,
        fetchAgentFromDatabase: params.fetchAgentFromDatabase,
        databaseAgentCache: params.databaseAgentCache,
        apiKey: params.apiKey,
        logger,
        onResponseChunk,
      })
      if (spawnValidation.rejected) {
        finishToolEvent('failed')
        return previousToolCallFinished
      }
      effectiveInput = spawnValidation.input
    }

    // FID-2026-0802-005 H7: abort gate — never stream/push a tool call or
    // invoke a handler after the run has been aborted. Prevents orphaned
    // tool_calls (no matching tool_result) from entering message history,
    // which providers reject. The spawn_agents pre-validation above awaits, so
    // an abort can land inside this window.
    if (params.signal.aborted) {
      finishToolEvent('cancelled')
      return previousToolCallFinished
    }

    // FID-2026-0804-009: record read / spawn / verification activity on the
    // run's ECHO compliance tracker so Law 1 bookkeeping and the mechanical
    // Verifier criteria see the full run picture.
    const echoCompliance = agentState.echoCompliance
    if (echoCompliance && echoCompliance.mode !== 'off') {
      recordEchoComplianceActivity({
        echoCompliance,
        toolName,
        effectiveInput,
      })
    }

    // Only emit tool_call event after permission check passes
    // FID-2026-0718-009: emit activity indicator (M1 tool_call, M6 research tools).
    // toolActivity mutates agentState.activity + emits a chunk via onResponseChunk.
    toolActivity(agentState, toolName, effectiveInput, onResponseChunk)

    onResponseChunk({
      type: 'tool_call',
      toolCallId,
      toolName,
      input: effectiveInput,
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
        ? { ...toolCall, input: effectiveInput }
        : toolCall

    toolCalls.push(finalToolCall)
    if (!excludeToolFromMessageHistory) {
      toolCallsToAddToMessageHistory.push(finalToolCall)
    }

    // FID-2026-0802-005 C2: the handler is a trust boundary — a thrown or
    // rejected exception must surface as a tool error (driving the existing
    // hadToolCallError retry flow via the error chunk below), never propagate
    // past the executor and fail the entire run (Law 14).
    let toolResultPromise: ReturnType<SavantCodeToolHandlerFunction<T>>
    try {
      toolResultPromise = handler({
        ...params,
        toolCall: finalToolCall,
        previousToolCallFinished,
        writeToClient: onResponseChunk,
        // FID-029: `as SavantCodeToolOutput<...>` casts are accepted pre-existing
        // tech debt (tracking FID-2026-0719-029 archived; rationale inlined).
        // The runtime SDK returns the raw client-tool result shape; bridging
        // to SavantCodeToolOutput<...> at the conditional closure slot requires
        // this cast. On abort, we return a graceful JSON-tool-result matching
        // composio's missing-runtime fallback pattern (rather than `[]`,
        // which propagated a wrong-shape never[] downstream). The cast uses
        // `T extends ClientToolName ? T : never` to align with the slot's
        // exact conditional type so it satisfies ECHO distribution cleanly.
        requestClientToolCall: async (
          clientToolCall: ClientToolCall<T extends ClientToolName ? T : never>,
        ) => {
          if (params.signal.aborted) {
            return [
              {
                type: 'json',
                value: {
                  errorMessage: `Tool call aborted: ${clientToolCall.toolName}`,
                },
              },
            ] as SavantCodeToolOutput<T extends ClientToolName ? T : never>
          }

          const clientToolResult = await requestToolCall({
            userInputId,
            toolName: clientToolCall.toolName,
            input: clientToolCall.input,
          })
          return clientToolResult.output as SavantCodeToolOutput<
            T extends ClientToolName ? T : never
          >
        },
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
      finishToolEvent('failed')
      return previousToolCallFinished
    }

    return await toolResultPromise.then(
      async ({ output, creditsUsed }) => {
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
        setActivity(
          agentState,
          { kind: 'thinking', startedAt: Date.now() },
          onResponseChunk,
        )

        onResponseChunk({
          type: 'tool_result',
          toolCallId: toolResult.toolCallId,
          toolName: toolResult.toolName,
          output: toolResult.content,
        })

        toolResults.push(toolResult)

        if (!excludeToolFromMessageHistory) {
          toolResultsToAddToMessageHistory.push(toolResult)
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
        if (
          toolName === 'read_files' &&
          !hasToolResultError(toolResult.content)
        ) {
          const successfulGroundingPaths = toolResult.content.flatMap(
            (part) => {
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
            },
          )
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
          writtenPath &&
          (toolName === 'write_file' || toolName === 'str_replace')
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
              typeof toolResult.content === 'string'
                ? toolResult.content
                : undefined,
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
              lawChecks: writeLawChecks,
            })
            .then((receipt) => {
              if (!receipt) return
              // FID-2026-0813-009: the CLI matrix consumes only this signed
              // receipt event. It is observational; it cannot dispatch tools.
              params.onResponseChunk({
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
              logger.warn(
                { toolName, path: writtenPath, error: String(error) },
                'ZTAP receipt creation failed',
              )
            })
        }

        // After tool completes, resolve any pending creditsUsed promise
        finishToolEvent('completed')

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
              ...(failed
                ? { errorMessage: 'tool result contains an error' }
                : {}),
            }),
          )
        }

        if (creditsUsed) {
          onCostCalculated(creditsUsed)
          logger.debug(
            { credits: creditsUsed, totalCredits: agentState.creditsUsed },
            `Added ${creditsUsed} credits from ${toolName} to agent state`,
          )
        }
      },
      async (error) => {
        // FID-2026-0802-005 C2: rejections are caught here and converted into
        // the same retryable tool-error flow instead of failing the run.
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
              sessionId: agentState.runId ?? agentState.agentId,
              cwd: hookProjectRoot,
              toolName,
              toolInput: toolCall.input as Record<string, JSONValue>,
              errorMessage,
            }),
          )
        }
      },
    )
  } catch (error) {
    finishToolEvent(params.signal.aborted ? 'cancelled' : 'failed')
    throw error
  }
}

/** Write tools that produce ZTAP receipts (FID-2026-0813-004). Type
 *  predicate so `toolName` narrows to WriteToolName for receipt typing. */
function isWriteToolName(toolName: string): toolName is WriteToolName {
  return (
    toolName === 'write_file' ||
    toolName === 'str_replace' ||
    toolName === 'apply_patch'
  )
}

/**
 * FID-2026-0813-002/004: resolve the structured FID id for a write from the
 * compliance tracker's exact-resolution write record (active-FID path set).
 * Falls back to null when the tracker is unavailable — the receipt carries
 * the resolved id when one exists, never a heuristic.
 */
function resolveFidIdForWrite(
  writtenPath: string,
  agentState: AgentState,
): string | null {
  const tracker = agentState.echoCompliance
  const records = tracker?.getWriteRecords?.()
  if (!records || records.length === 0) return null
  const normalizedTarget = writtenPath.replace(/\\/g, '/').toLowerCase()
  for (let i = records.length - 1; i >= 0; i--) {
    const record = records[i]
    if (record.path.replace(/\\/g, '/').toLowerCase() === normalizedTarget) {
      return record.fidId ?? null
    }
  }
  return null
}
