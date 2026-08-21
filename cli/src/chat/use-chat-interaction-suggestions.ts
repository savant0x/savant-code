import { useChatSuggestions } from './use-chat-suggestions'

import type { UseChatSuggestionsArgs } from './use-chat-suggestions'

/** Suggestion-engine boundary used by the chat interaction compositor. */
export function useChatInteractionSuggestions(args: UseChatSuggestionsArgs) {
  return useChatSuggestions(args)
}
