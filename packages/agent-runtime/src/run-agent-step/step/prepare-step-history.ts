// FID-2026-0819-005 Loop 274: step-prompt resolution and initial message
// assembly for one agent step, extracted verbatim from step.ts. Mutates
// `agentState.messageHistory` on the shared reference exactly as the
// original inline block did.
import { supportsAssistantPrefill } from '@savant-code/common/old-constants'
import { userMessage } from '@savant-code/common/util/messages'

import { getAgentPrompt } from '../../templates/strings'
import { withSystemTags, expireMessages } from '../../util/messages'

import type { RunAgentStepParams } from '../types'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * Resolve the step prompt (with the computed fallback for direct callers),
 * assemble the step's starting message history (expired tail + step prompt
 * + one-shot relay digest), and guard against unsupported assistant prefill.
 */
export async function prepareStepHistory(
  params: RunAgentStepParams,
  agentState: AgentState,
): Promise<void> {
  const {
    fileContext,
    agentTemplate,
    localAgentTemplates,
    logger,
    additionalToolDefinitions,
  } = params

  // FID-2026-0802-005 L15: the step prompt is computed ONCE per step in
  // loopAgentSteps (which needs it for token counting) and passed down —
  // previously runAgentStep recomputed it for identical inputs. Callers that
  // invoke runAgentStep directly (tests) still get the computed fallback.
  const stepPrompt =
    params.stepPrompt ??
    (await getAgentPrompt({
      ...params,
      agentTemplate,
      promptType: { type: 'stepPrompt' },
      fileContext,
      agentState,
      agentTemplates: localAgentTemplates,
      logger,
      additionalToolDefinitions,
    }))

  // FID-2026-0815-004 (F-03): replace the buildArray(…spread…, falsey-filter)
  // construction with a conditional append. buildArray only ever removed the
  // `false` from `stepPrompt && …` when stepPrompt was absent; the ternary
  // below covers that case exactly, and expireMessages' fast-path avoids the
  // allocation when nothing expires (4 allocations/step → 2, or 1 when there
  // is no stepPrompt).
  const filtered = expireMessages(agentState.messageHistory, 'agentStep')
  const stepPromptMessage = stepPrompt
    ? userMessage({
        content: stepPrompt,
        tags: ['STEP_PROMPT'],

        // James: Deprecate the below, only use tags, which are not prescriptive.
        timeToLive: 'agentStep' as const,
        keepDuringTruncation: true,
      })
    : undefined

  agentState.messageHistory = stepPromptMessage
    ? [...filtered, stepPromptMessage]
    : filtered

  // FID-2026-0821-005 A10: one-shot relay digest. A programmatic handleSteps
  // (basher) parks a truncated terminal-output excerpt on agentState so the
  // summarizer STEP keeps ground truth even when the full json ToolMessage
  // fails to render downstream. Consume-once: cleared after this assembly.
  if (
    typeof agentState.relayDigest === 'string' &&
    agentState.relayDigest.length > 0
  ) {
    agentState.messageHistory = [
      ...agentState.messageHistory,
      userMessage({
        content: withSystemTags(
          `Terminal output excerpt (relay safeguard): ${agentState.relayDigest}`,
        ),
        tags: ['STEP_RELAY_DIGEST'],
        timeToLive: 'agentStep' as const,
        keepDuringTruncation: true,
      }),
    ]
    delete agentState.relayDigest
  }

  // A step can start with the history ending on an assistant message — e.g. a
  // continuation after a think-only response for an agent with no stepPrompt.
  // Claude 4.6+ rejects such requests as unsupported assistant prefill, so end
  // the conversation with a user message instead.
  const { model } = agentTemplate
  const lastMessage =
    agentState.messageHistory[agentState.messageHistory.length - 1]
  if (lastMessage?.role === 'assistant' && !supportsAssistantPrefill(model)) {
    agentState.messageHistory = [
      ...agentState.messageHistory,
      userMessage({
        content: withSystemTags('Continue from where you left off.'),
        timeToLive: 'agentStep' as const,
        keepDuringTruncation: true,
      }),
    ]
  }
}
