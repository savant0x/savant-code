import {
  appendTextWithThinkParsingToBlocks,
  finalizeThinkingBlocks,
} from '../block-operations/think-parsing'

import type { ContentBlock, TextContentBlock } from '../../types/chat'

function isVisibleText(block: ContentBlock): block is TextContentBlock {
  return block.type === 'text' && block.textType !== 'reasoning'
}

function visibleText(blocks: ContentBlock[]): string {
  return blocks
    .filter(isVisibleText)
    .map((block) => block.content)
    .join('')
}

/** Keep streamed reasoning identities and fold controls on result replay. */
function missingReasoning(
  existing: ContentBlock[],
  final: ContentBlock[],
): ContentBlock[] {
  const remaining = existing.filter(
    (block) => block.type === 'text' && block.textType === 'reasoning',
  )
  return final.filter((block) => {
    if (block.type !== 'text' || block.textType !== 'reasoning') return false
    const index = remaining.findIndex(
      (entry) =>
        entry.type === 'text' &&
        (entry.content === block.content ||
          (entry.content.length > 0 &&
            block.content.startsWith(entry.content))),
    )
    if (index < 0) return true
    const matched = remaining.splice(index, 1)[0]
    if (matched.type === 'text') {
      existing[existing.indexOf(matched)] = {
        ...matched,
        content: block.content,
      }
    }
    return false
  })
}

function extendPreview(blocks: ContentBlock[], suffix: string): ContentBlock[] {
  const index = blocks.findLastIndex(isVisibleText)
  const last = blocks[index]
  if (last?.type !== 'text') return blocks
  return blocks.map((block, i) =>
    i === index ? { ...last, content: last.content + suffix } : block,
  )
}

function replaceAuditPreview(
  blocks: ContentBlock[],
  replacement: ContentBlock[],
): ContentBlock[] {
  const index = blocks.findIndex(isVisibleText)
  if (index < 0) return [...blocks, ...replacement]
  return blocks.flatMap((block, i) => {
    if (i === index) return replacement
    return isVisibleText(block) ? [] : [block]
  })
}

/** Final text is authoritative for auditors; source history stays untouched. */
export function reconcileSpawnResult(
  blocks: ContentBlock[],
  content: string,
  agentType: string,
): ContentBlock[] {
  const existing = finalizeThinkingBlocks(blocks)
  if (!content) return existing
  const final = finalizeThinkingBlocks(
    appendTextWithThinkParsingToBlocks([], content),
  )
  const streamedText = visibleText(existing)
  const finalText = visibleText(final)
  const reasoning = missingReasoning(existing, final)
  if (finalText === streamedText) return [...existing, ...reasoning]
  if (existing.filter(isVisibleText).at(-1)?.content === finalText) {
    return [...existing, ...reasoning]
  }
  if (streamedText && finalText.startsWith(streamedText)) {
    return [
      ...extendPreview(existing, finalText.slice(streamedText.length)),
      ...reasoning,
    ]
  }
  const replacement: ContentBlock[] = [
    ...reasoning,
    ...final.filter(isVisibleText),
  ]
  if (agentType === 'verifier' || agentType === 'adversary') {
    return replaceAuditPreview(existing, replacement)
  }
  return [...existing, ...replacement]
}
