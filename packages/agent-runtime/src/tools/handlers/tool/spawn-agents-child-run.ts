import {
  buildRecorderRetryPrompt,
  checkRecorderOutcome,
  RECORDER_STALL_RETRY_LIMIT,
} from './recorder-stall-check'
import { applyVerdictReceipts } from './spawn-agent-inline-verdict'
import {
  validateAndGetAgentTemplate,
  validateAgentInput,
  createAgentState,
  executeSubagent,
  extractSubagentContextParams,
  resolveChildOutputBudget,
  withParentModel,
} from './spawn-agent-utils'
import { batchSpawnRejectionMessage } from './spawn-inline-only'
import { loadRawEvidenceForSpawn } from '../../../evidence/spawn-evidence'
import { filterToolSet } from '../../../tools/filter-tool-set'
import { setActivity } from '../../../util/activity-tracking'

import type {
  ExecuteSubagentResult,
  RunSingleSubagentDeps,
} from './spawn-agents-child-types'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * Orchestrate one child-agent spawn: template validation + model inheritance,
 * child state creation, activity surfacing, the streaming chunk router, the
 * recorder-stall corrective retry ladder (FID-2026-0823-012 ISSUE-D), and
 * ZTAP verdict binding (FID-2026-0813-004). Extracted verbatim from the
 * per-agent map callback in handleSpawnAgents.
 */
export async function runSingleSubagent({
  params,
  parentAgentState,
  parentAgentTemplate,
  fingerprintId,
  parentSystemPrompt,
  parentTools,
  userInputId,
  sendSubagentChunk,
  writeToClient,
  isOnlyChild,
  agentTypeStr,
  prompt,
  spawnParams,
}: RunSingleSubagentDeps): Promise<
  ExecuteSubagentResult & { agentType: string; agentName: string }
> {
  const { agentTemplate: childTemplate, agentType } =
    await validateAndGetAgentTemplate({
      ...params,
      agentTypeStr,
      parentAgentTemplate,
    })

  // FID-2026-0919-027: harness-owned inline agents must not be batch-spawned.
  // The batch path skips the wiring that makes their effect land, so the call
  // would succeed, bill its run, and change nothing (see spawn-inline-only.ts).
  // The executor's pre-validation rejects this earlier for model calls; this is
  // the boundary check for every other caller.
  const inlineOnlyRejection = batchSpawnRejectionMessage(agentType)
  if (inlineOnlyRejection !== null) {
    throw new Error(inlineOnlyRejection)
  }

  // Inherit the parent's model so subagents respect the user's selected model.
  const agentTemplate = withParentModel(childTemplate, parentAgentTemplate)

  // FID-2026-0909-008 Step 4: propagate the run's resolved output budget to
  // the child loop, but only when the child actually runs the model the
  // budget was resolved for (shared guard — see resolveChildOutputBudget).
  const childOutputBudget = resolveChildOutputBudget(
    agentTemplate,
    parentAgentTemplate,
    params.maxOutputTokens,
  )

  validateAgentInput(agentTemplate, agentType, prompt, spawnParams)

  // FID-2026-0824-026 / FID-2026-0919-027: preload raw evidence for audit
  // agents so the spawn-time splice can restore sentinel-compacted results
  // verbatim. The loader unions the run chain, so a NESTED spawn restores too
  // (the previous `!parentAgentState.parentId` guard silently skipped it).
  const rawEvidenceRecords = await loadRawEvidenceForSpawn({
    agentTemplate,
    spawningAgentState: parentAgentState,
    projectRoot: params.fileContext?.projectRoot,
  })

  const subAgentState = createAgentState(
    agentType,
    agentTemplate,
    parentAgentState,
    {},
    params.fileContext?.projectRoot,
    rawEvidenceRecords,
  )

  // FID-2026-0718-009 M3: surface sub-agent activity on parent.
  setActivity(
    parentAgentState,
    {
      kind: 'subagent',
      agentType,
      startedAt: Date.now(),
      ...(prompt ? { prompt: prompt.slice(0, 30) } : {}),
    },
    writeToClient,
  )

  // Sub-agent work begins alongside parent work. Parent's activity may
  // still be 'thinking' so we keep it; the M3 line above ensures the
  // parent UI starts showing 'subagent' once the agent hits tool calls.

  // Extract common context params to avoid bugs from spreading all params
  const contextParams = extractSubagentContextParams({
    ...params,
    agentState: parentAgentState,
  })
  const propagation = contextParams.propagation
  if (!propagation) {
    throw new Error('Subagent propagation context is missing.')
  }

  // FID-2026-0823-012 ISSUE-D: the child-run invocation is parameterized
  // by (state, prompt) so a stalled recorder can be retried on a FRESH
  // state with a corrective failure-naming suffix instead of forcing
  // the parent into an identical blind re-spawn (identical prompts
  // reproduce identical stalls).
  const runChild = (childState: AgentState, effectivePrompt: string) =>
    executeSubagent({
      propagation,
      ...contextParams,

      // Spawn-specific params
      ancestorRunIds: parentAgentState.ancestorRunIds,
      userInputId: `${userInputId}-${agentType}${childState.agentId}`,
      prompt: effectivePrompt,
      spawnParams,
      agentTemplate,
      parentAgentState,
      agentState: childState,
      fingerprintId,
      maxOutputTokens: childOutputBudget,
      isOnlyChild,
      excludeToolFromMessageHistory: false,
      parentSystemPrompt,
      // FID-2026-0802-005 L12: filterToolSet only when the child actually
      // inherits the parent's system prompt (avoid redundant computation
      // per spawn). The runtime boundary in run-agent-step.ts applies the
      // same subset filter again for defense in depth — both boundaries
      // are intentional per FID-005.
      parentTools: agentTemplate.inheritParentSystemPrompt
        ? filterToolSet(parentTools, agentTemplate.toolNames)
        : undefined,
      onResponseChunk: (chunk: string | PrintModeEvent) => {
        if (typeof chunk === 'string') {
          sendSubagentChunk({
            userInputId,
            agentId: childState.agentId,
            agentType,
            chunk,
            prompt,
          })
          return
        }

        if (chunk.type === 'text') {
          if (chunk.text) {
            writeToClient({
              type: 'text' as const,
              agentId: childState.agentId,
              text: chunk.text,
            })
          }
          return
        }

        // Add parentAgentId for proper nesting in UI
        const ensureParentAgentId = () => {
          if (
            chunk.type === 'subagent_start' ||
            chunk.type === 'subagent_finish'
          ) {
            return (
              chunk.parentAgentId ??
              childState.parentId ??
              parentAgentState?.agentId
            )
          }
          if (chunk.type === 'tool_call' || chunk.type === 'tool_result') {
            const printableEvent = chunk as unknown as {
              parentAgentId?: string
            }
            return printableEvent.parentAgentId ?? childState.agentId
          }
          return undefined
        }

        const parentAgentId = ensureParentAgentId()
        if (
          parentAgentId !== undefined &&
          (chunk.type === 'subagent_start' ||
            chunk.type === 'subagent_finish' ||
            chunk.type === 'tool_call' ||
            chunk.type === 'tool_result')
        ) {
          writeToClient({ ...chunk, parentAgentId })
          return
        }

        const eventWithAgent = {
          ...chunk,
          agentId: childState.agentId,
        }
        writeToClient(eventWithAgent)
      },
    })

  let result = await runChild(subAgentState, prompt || '')

  // FID-2026-0823-012 ISSUE-D: -008-guard-aware corrective retry
  // ladder. A stalled recorder (no successful write_file/set_output)
  // is retried on a fresh state with a corrective suffix naming the
  // exact relay-guard reason. Bounded by RECORDER_STALL_RETRY_LIMIT —
  // the ladder's only bound, so constant and behavior cannot drift;
  // the post-run relay guard below stays the single outcome authority —
  // an exhausted ladder still relays errorMessage.
  if (agentType === 'recorder') {
    let stalledCredits = 0
    for (let attempt = 0; attempt < RECORDER_STALL_RETRY_LIMIT; attempt += 1) {
      const outcome = checkRecorderOutcome(result.agentState.messageHistory)
      if (outcome.ok) break
      // Preserve each stalled attempt's spend so parent-side cost
      // aggregation stays exact (aggregation below sees only the
      // final attempt's state).
      stalledCredits += result.agentState.creditsUsed || 0
      const retryState = createAgentState(
        agentType,
        agentTemplate,
        parentAgentState,
        {},
        params.fileContext?.projectRoot,
      )
      result = await runChild(
        retryState,
        buildRecorderRetryPrompt(prompt || '', outcome.reason),
      )
    }
    if (stalledCredits > 0) {
      result = {
        ...result,
        agentState: {
          ...result.agentState,
          creditsUsed: (result.agentState.creditsUsed || 0) + stalledCredits,
        },
      }
    }
  }

  // FID-2026-0813-004: ZTAP verdict binding — the Verifier (AUDIT) and
  // Adversary (ADVERSARIAL) verdicts are their final outputs. Bound to
  // every open receipt of the session as signed verbatim payloads (D7).
  //
  // FID-2026-0919-027: both spawn sites now route through the ONE extracted
  // authority (`applyVerdictReceipts`) instead of the inline path using the
  // helper and this path carrying its own copy — two implementations of the
  // same binding is how the boundary drifts. `childAgentId` stays
  // `subAgentState.agentId` (the child the loop ran as); only the recorder has
  // a retry ladder that rebuilds the state, and the recorder is never bound.
  if (agentType === 'verifier' || agentType === 'adversary') {
    applyVerdictReceipts({
      agentType,
      childAgentId: subAgentState.agentId,
      resultAgentState: result.agentState,
      parentAgentState,
      projectRoot: params.fileContext?.projectRoot ?? '.',
      writeToClient,
    })
  }

  return { ...result, agentType, agentName: agentTemplate.displayName }
}
