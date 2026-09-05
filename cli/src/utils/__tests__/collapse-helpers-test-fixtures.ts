// Shared fixtures for the collapse-helpers test family (see
// collapse-helpers.test.ts for the family header): minimal ChatMessage and
// ContentBlock builders for every collapsible block type.

import {
  setAllBlocksCollapsedState,
  hasAnyExpandedBlocks,
} from '../collapse-helpers'

import type {
  ChatMessage,
  ContentBlock,
  ToolContentBlock,
  AgentContentBlock,
  TextContentBlock,
  AgentListContentBlock,
  ThinkingCollapseState,
} from '../../types/chat'

export { setAllBlocksCollapsedState, hasAnyExpandedBlocks }

// Type helper for accessing isCollapsed/userOpened on any block type
export type CollapsibleBlock =
  | ToolContentBlock
  | AgentContentBlock
  | TextContentBlock
  | AgentListContentBlock

// Helper to create minimal test messages
export const createMessage = (
  id: string,
  variant: 'ai' | 'user' | 'agent' | 'error' = 'ai',
  blocks?: ContentBlock[],
  metadata?: { isCollapsed?: boolean; userOpened?: boolean },
): ChatMessage => ({
  id,
  variant,
  content: '',
  timestamp: new Date().toISOString(),
  blocks,
  metadata,
})

// Helper to create tool blocks
export const createToolBlock = (
  toolCallId: string,
  isCollapsed?: boolean,
  userOpened?: boolean,
): ContentBlock => ({
  type: 'tool',
  toolCallId,
  toolName: 'read_files',
  input: {},
  isCollapsed,
  userOpened,
})

// Helper to create agent blocks
export const createAgentBlock = (
  agentId: string,
  isCollapsed?: boolean,
  userOpened?: boolean,
  nestedBlocks?: ContentBlock[],
): ContentBlock => ({
  type: 'agent',
  agentId,
  agentName: 'Test Agent',
  agentType: 'test-agent',
  content: '',
  status: 'complete',
  isCollapsed,
  userOpened,
  blocks: nestedBlocks,
})

// Helper to create thinking/text blocks with thinkingId
export const createThinkingBlock = (
  thinkingId: string,
  thinkingCollapseState?: ThinkingCollapseState,
  userOpened?: boolean,
): ContentBlock => ({
  type: 'text',
  content: 'thinking content',
  thinkingId,
  ...(thinkingCollapseState !== undefined && { thinkingCollapseState }),
  userOpened,
})

// Helper to create agent-list blocks
export const createAgentListBlock = (
  id: string,
  isCollapsed?: boolean,
  userOpened?: boolean,
): ContentBlock => ({
  type: 'agent-list',
  id,
  agents: [],
  agentsDir: '/test',
  isCollapsed,
  userOpened,
})

// Helper to create plain text blocks (not collapsible)
export const createTextBlock = (content: string): ContentBlock => ({
  type: 'text',
  content,
})
