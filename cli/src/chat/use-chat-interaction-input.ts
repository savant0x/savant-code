import { useChatInput } from '../hooks/use-chat-input'

import type { UseChatInteractionsArgs } from './use-chat-interactions-types'

type InputSubmitHandler = Parameters<typeof useChatInput>[0]['onSubmitPrompt']

type UseChatInteractionInputArgs = Pick<
  UseChatInteractionsArgs,
  | 'setInputValue'
  | 'agentMode'
  | 'setAgentMode'
  | 'separatorWidth'
  | 'initialPrompt'
>

/** Input sizing and build-mode behavior consumed by the interaction compositor. */
export function useChatInteractionInput(
  args: UseChatInteractionInputArgs,
  onSubmitPrompt: InputSubmitHandler,
  isCompactHeight: boolean,
  isNarrowWidth: boolean,
) {
  return useChatInput({
    ...args,
    onSubmitPrompt,
    isCompactHeight,
    isNarrowWidth,
  })
}
