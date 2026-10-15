// Shared harness for the message-with-agents test family.
// Sibling of the Loop 331 decomposition: message factories, store
// initialization, and the beforeEach/afterEach lifecycle. Each suite file
// calls setupMessageWithAgentsTest() at module scope so the lifecycle
// applies file-wide, matching the original monolith semantics.

import { afterEach, beforeEach } from 'bun:test'

import { initializeThemeStore } from '../../hooks/use-theme'
import { useChatStore } from '../../state/chat-store'
import { useMessageBlockStore } from '../../state/message-block-store'
import { chatThemes, createMarkdownPalette } from '../../utils/theme-system'

import type { ChatMessage } from '../../types/chat'
import type { MarkdownPalette } from '../../utils/markdown-renderer'

initializeThemeStore()

export const theme = chatThemes.light
export const basePalette: MarkdownPalette = createMarkdownPalette(theme)

// -----------------------------------------------------------------------------
// Helper factory functions for creating test messages
// -----------------------------------------------------------------------------

export const createUserMessage = (
  id: string,
  content: string,
): ChatMessage => ({
  id,
  variant: 'user',
  content,
  timestamp: new Date().toISOString(),
})

export const createAiMessage = (id: string, content: string): ChatMessage => ({
  id,
  variant: 'ai',
  content,
  timestamp: new Date().toISOString(),
})

export const createAgentMessage = (
  id: string,
  content: string,
  agentName: string,
  options: Partial<ChatMessage> = {},
): ChatMessage => ({
  id,
  variant: 'agent',
  content,
  timestamp: new Date().toISOString(),
  agent: {
    agentName,
    agentType: 'test-agent',
    responseCount: 1,
  },
  ...options,
})

export const createErrorMessage = (
  id: string,
  content: string,
): ChatMessage => ({
  id,
  variant: 'error',
  content,
  timestamp: new Date().toISOString(),
})

// Creates an agent message without the required agent info (for error testing)
export const createMalformedAgentMessage = (
  id: string,
  content: string,
): ChatMessage =>
  ({
    id,
    variant: 'agent',
    content,
    timestamp: new Date().toISOString(),
    // Intentionally missing agent property
  }) as ChatMessage

export const createModeDividerMessage = (
  id: string,
  mode: string,
): ChatMessage => ({
  id,
  variant: 'ai',
  content: 'this content should be ignored',
  timestamp: new Date().toISOString(),
  blocks: [
    {
      type: 'mode-divider',
      mode,
    },
  ],
})

export const defaultCallbacks = {
  onToggleCollapsed: () => {},
  onBuildFast: () => {},
  onBuildMax: () => {},
  onBuildLite: () => {},
  onFeedback: () => {},
  onCloseFeedback: () => {},
  onAdClick: () => {},
  onAdImpression: () => {},
  onResponseAdsNeeded: () => {},
}

export const initializeStore = (
  overrides: {
    messageTree?: Map<string, ChatMessage[]>
    isWaitingForResponse?: boolean
    timerStartTime?: number | null
    availableWidth?: number
  } = {},
) => {
  useMessageBlockStore.setState({
    context: {
      theme,
      markdownPalette: basePalette,
      messageTree: overrides.messageTree ?? new Map<string, ChatMessage[]>(),
      isWaitingForResponse: overrides.isWaitingForResponse ?? false,
      timerStartTime: overrides.timerStartTime ?? null,
      availableWidth: overrides.availableWidth ?? 80,
      responseAds: {},
    },
    callbacks: defaultCallbacks,
  })
}

export const baseMessageWithAgentsProps = {
  depth: 0,
  isLastMessage: false,
  availableWidth: 80,
}

export function setupMessageWithAgentsTest() {
  beforeEach(() => {
    initializeStore()
    useChatStore.setState({ streamingAgents: new Set<string>() })
  })

  afterEach(() => {
    useMessageBlockStore.getState().reset()
    useChatStore.setState({ streamingAgents: new Set<string>() })
  })
}
