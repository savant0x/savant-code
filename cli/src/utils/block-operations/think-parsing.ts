import {
  getPartialTagLength,
  THINK_OPEN_TAG,
  THINK_CLOSE_TAG,
} from '../think-tag-parser'
import {
  createReasoningBlock,
  createTextBlock,
  isNativeReasoningBlock,
  isOpenThinkingBlock,
} from './primitive-blocks'
import { generateThinkingId } from './thinking-id'

import type { ContentBlock } from '../../types/chat'

/** Append to the current channel without creating a paragraph per chunk. */
function appendContent(blocks: ContentBlock[], content: string): void {
  if (!content) return
  const last = blocks.at(-1)
  if (
    last?.type === 'text' &&
    (last.textType !== 'reasoning' || isOpenThinkingBlock(last))
  ) {
    blocks[blocks.length - 1] = { ...last, content: last.content + content }
  } else {
    blocks.push(createTextBlock(content))
  }
}

function closeTaggedReasoning(blocks: ContentBlock[]): void {
  const last = blocks.at(-1)
  if (!last || !isOpenThinkingBlock(last) || last.type !== 'text') return
  if (!last.content) blocks.pop()
  else blocks[blocks.length - 1] = { ...last, thinkingOpen: false }
}

function holdPartialTag(blocks: ContentBlock[], tag: string): void {
  if (!tag) return
  if (blocks.at(-1)?.type !== 'text') blocks.push(createTextBlock(''))
  const last = blocks.at(-1)
  if (last?.type === 'text') {
    blocks[blocks.length - 1] = { ...last, pendingThinkTag: tag }
  }
}

function openTaggedReasoning(blocks: ContentBlock[]): void {
  const previous = blocks.at(-1)
  if (
    previous?.type === 'text' &&
    previous.textType !== 'reasoning' &&
    !previous.content
  )
    blocks.pop()
  blocks.push(createReasoningBlock('', true, generateThinkingId()))
}

/** Shared stateful parser for root, subagent and final-result display. */
export function appendTextWithThinkParsingToBlocks(
  blocks: ContentBlock[],
  text: string,
): ContentBlock[] {
  if (!text) return blocks
  const next = [...blocks]
  const last = next.at(-1)
  let remaining = text
  if (last?.type === 'text' && last.pendingThinkTag) {
    remaining = last.pendingThinkTag + remaining
    const { pendingThinkTag: _, ...rest } = last
    next[next.length - 1] = rest
  }
  while (remaining) {
    const inside = isOpenThinkingBlock(next.at(-1))
    const closeIndex = remaining.indexOf(THINK_CLOSE_TAG)
    const openIndex = inside ? -1 : remaining.indexOf(THINK_OPEN_TAG)
    const index =
      openIndex >= 0 && (closeIndex < 0 || openIndex < closeIndex)
        ? openIndex
        : closeIndex
    if (index < 0) {
      const partialLength = getPartialTagLength(remaining)
      appendContent(next, remaining.slice(0, remaining.length - partialLength))
      holdPartialTag(next, remaining.slice(remaining.length - partialLength))
      break
    }
    appendContent(next, remaining.slice(0, index))
    if (index === openIndex) {
      openTaggedReasoning(next)
      remaining = remaining.slice(index + THINK_OPEN_TAG.length)
    } else {
      closeTaggedReasoning(next)
      remaining = remaining.slice(index + THINK_CLOSE_TAG.length)
    }
  }
  return next
}

/** Close all reasoning and discard unfinished scaffold delimiters at EOF. */
export function finalizeThinkingBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.flatMap((block): ContentBlock[] => {
    if (block.type !== 'text') return [block]
    const { pendingThinkTag, ...rest } = block
    const literal =
      pendingThinkTag === '<' || pendingThinkTag === '</' ? pendingThinkTag : ''
    const content = rest.content + literal
    if (!content && pendingThinkTag) return []
    return [
      {
        ...rest,
        content,
        ...(rest.textType === 'reasoning' && { thinkingOpen: false }),
      },
    ]
  })
}

export function appendNativeReasoningToBlocks(
  blocks: ContentBlock[],
  text: string,
): ContentBlock[] {
  if (!text) return blocks
  const last = blocks.at(-1)
  if (last && isNativeReasoningBlock(last) && last.type === 'text') {
    return [...blocks.slice(0, -1), { ...last, content: last.content + text }]
  }
  return [
    ...blocks,
    {
      type: 'text',
      content: text,
      textType: 'reasoning',
      thinkingCollapseState: 'preview',
      thinkingId: generateThinkingId(),
    },
  ]
}

/** Native reasoning ends when the provider starts text or a tool call. */
export function closeNativeReasoningBlock(
  blocks: ContentBlock[],
): ContentBlock[] {
  const index = blocks.findLastIndex(isNativeReasoningBlock)
  if (index < 0) return blocks
  const block = blocks[index]
  if (block.type !== 'text') return blocks
  return blocks.map((entry, i) =>
    i === index ? { ...block, thinkingOpen: false } : entry,
  )
}
