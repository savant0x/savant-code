// FID-2026-0819-005 Loop 272: initial message-history construction,
// extracted verbatim from loop-context.ts. Seeds the history with the user
// prompt, any prompt-keyed system instruction, and the instructions prompt.
import { buildArray } from '@savant-code/common/util/array'
import { userMessage } from '@savant-code/common/util/messages'

import { additionalSystemPrompts } from '../system-prompt/prompts'
import {
  withSystemInstructionTags,
  buildUserMessageContent,
} from '../util/messages'

import type { LoopAgentStepsParams } from './types'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * Build the initial message history from the run prompt and the resolved
 * instructions prompt (verbatim from createLoopContext). Also returns
 * `hasUserMessage`, which the goal-directive pass reuses as its guard.
 */
export function buildInitialMessages(
  loopParams: LoopAgentStepsParams,
  initialAgentState: AgentState,
  instructionsPrompt: string | undefined,
): { hasUserMessage: boolean; initialMessages: Message[] } {
  const hasUserMessage = Boolean(
    loopParams.prompt ||
    (loopParams.spawnParams &&
      Object.keys(loopParams.spawnParams).length > 0) ||
    (loopParams.content && loopParams.content.length > 0),
  )

  const initialMessages = buildArray<Message>(
    ...initialAgentState.messageHistory,

    hasUserMessage && [
      {
        // Actual user message!
        role: 'user' as const,
        content: buildUserMessageContent(
          loopParams.prompt,
          loopParams.spawnParams,
          loopParams.content,
        ),
        tags: ['USER_PROMPT'],
        sentAt: Date.now(),

        // James: Deprecate the below, only use tags, which are not prescriptive.
        keepDuringTruncation: true,
      },
      loopParams.prompt &&
        loopParams.prompt in additionalSystemPrompts &&
        userMessage(
          withSystemInstructionTags(
            additionalSystemPrompts[
              loopParams.prompt as keyof typeof additionalSystemPrompts
            ],
          ),
        ),
    ],

    instructionsPrompt &&
      userMessage({
        content: instructionsPrompt,
        tags: ['INSTRUCTIONS_PROMPT'],

        // James: Deprecate the below, only use tags, which are not prescriptive.
        keepLastTags: ['INSTRUCTIONS_PROMPT'],
      }),
  )

  return { hasUserMessage, initialMessages }
}
