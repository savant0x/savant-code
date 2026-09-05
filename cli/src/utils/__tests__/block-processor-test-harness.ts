// Shared fixtures for the block-processor test family.
// Sibling of the Loop-342 decomposition (suite files all import these).
import type {
  TextContentBlock,
  ToolContentBlock,
  AgentContentBlock,
  ImageContentBlock,
} from '../../types/chat'
import type { BlockProcessorHandlers } from '../block-processor'

// ============================================================================
// Test Helpers - Block Factories
// ============================================================================
export function createTextBlock(
  content: string,
  textType?: 'reasoning' | 'text',
): TextContentBlock {
  return {
    type: 'text',
    content,
    textType,
  } as TextContentBlock
}
export function createReasoningBlock(content: string): TextContentBlock {
  return createTextBlock(content, 'reasoning')
}
export function createToolBlock(
  toolName: string,
  toolCallId: string = `tool-${toolName}`,
): ToolContentBlock {
  return {
    type: 'tool',
    toolCallId,
    toolName: toolName as ToolContentBlock['toolName'],
    input: {},
  }
}
export function createImageBlock(
  mediaType: string = 'image/png',
  image: string = 'base64data',
): ImageContentBlock {
  return {
    type: 'image',
    mediaType,
    image,
  } as ImageContentBlock
}
export function createImplementorAgent(
  agentId: string,
  agentType: string = 'editor-implementor',
): AgentContentBlock {
  return {
    type: 'agent',
    agentId,
    agentName: `Implementor ${agentId}`,
    agentType,
    content: '',
    status: 'complete',
    blocks: [],
  } as AgentContentBlock
}
export function createNonImplementorAgent(
  agentId: string,
  agentType: string = 'scout',
): AgentContentBlock {
  return {
    type: 'agent',
    agentId,
    agentName: agentType,
    agentType,
    content: '',
    status: 'complete',
    blocks: [],
  } as AgentContentBlock
}
// ============================================================================
// Test Helpers - Mock Handlers
// ============================================================================
export interface MockCallRecord {
  handler: string
  args: unknown[]
}
export function createMockHandlers(): {
  handlers: BlockProcessorHandlers
  calls: MockCallRecord[]
} {
  const calls: MockCallRecord[] = []
  const handlers: BlockProcessorHandlers = {
    onReasoningGroup: (blocks, startIndex) => {
      calls.push({ handler: 'onReasoningGroup', args: [blocks, startIndex] })
      return `reasoning-${startIndex}`
    },
    onImageBlock: (block, index) => {
      calls.push({ handler: 'onImageBlock', args: [block, index] })
      return `image-${index}`
    },
    onToolGroup: (blocks, startIndex, nextIndex) => {
      calls.push({
        handler: 'onToolGroup',
        args: [blocks, startIndex, nextIndex],
      })
      return `tools-${startIndex}-${nextIndex}`
    },
    onImplementorGroup: (blocks, startIndex, nextIndex) => {
      calls.push({
        handler: 'onImplementorGroup',
        args: [blocks, startIndex, nextIndex],
      })
      return `implementors-${startIndex}-${nextIndex}`
    },
    onAgentGroup: (blocks, startIndex, nextIndex) => {
      calls.push({
        handler: 'onAgentGroup',
        args: [blocks, startIndex, nextIndex],
      })
      return `agents-${startIndex}-${nextIndex}`
    },
    onSingleBlock: (block, index) => {
      calls.push({ handler: 'onSingleBlock', args: [block, index] })
      return `single-${index}`
    },
  }
  return { handlers, calls }
}
