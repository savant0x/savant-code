// Shared fixtures for the message-updater test family.
// Sibling of the Loop-345 decomposition (suite files all import these).
import type { ChatMessage } from '../../types/chat'

// Type for metadata with runState for testing
export interface TestMessageMetadata {
  bashCwd?: string
  runState?: { id: string }
}

export const baseMessages: ChatMessage[] = [
  {
    id: 'ai-1',
    variant: 'ai',
    content: '',
    blocks: [],
    timestamp: 'now',
  },
  {
    id: 'user-1',
    variant: 'user',
    content: 'hi',
    timestamp: 'now',
  },
]
