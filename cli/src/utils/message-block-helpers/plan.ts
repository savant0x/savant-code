import type { ContentBlock } from '../../types/chat'

/**
 * Extracts the base agent name from a potentially scoped/versioned agent type string.
 *
 * @example
 * getAgentBaseName('savant-code/scout@0.0.2') // 'scout'
 * getAgentBaseName('scout@1.0.0') // 'scout'
 * getAgentBaseName('scout') // 'scout'
 * getAgentBaseName('scout') // 'scout'
 */
export const getAgentBaseName = (type: string): string => {
  const segment = type.split('/').pop() ?? type
  return segment.split('@')[0].replace(/_/g, '-')
}

/**
 * Extracts plan content from a buffer containing <PLAN>...</PLAN> tags.
 * Returns the trimmed content between tags, or null if not found.
 */
export const extractPlanFromBuffer = (buffer: string): string | null => {
  const openIdx = buffer.indexOf('<PLAN>')
  const closeIdx = buffer.indexOf('</PLAN>')
  if (openIdx !== -1 && closeIdx !== -1 && closeIdx > openIdx) {
    return buffer.slice(openIdx + '<PLAN>'.length, closeIdx).trim()
  }
  return null
}

export const scrubPlanTags = (s: string): string => {
  // Support both the canonical </PLAN> tag and the legacy </cb_plan> tag.
  const closingTagPattern = '(?:<\\/PLAN>|<\\/cb_plan>)'
  return s
    .replace(new RegExp(`<PLAN>[\\s\\S]*?${closingTagPattern}`, 'g'), '')
    .replace(/<PLAN>[\s\S]*$/g, '')
}

export const scrubPlanTagsInBlocks = (
  blocks: ContentBlock[],
): ContentBlock[] => {
  return blocks
    .map((block) => {
      if (block.type !== 'text') {
        return block
      }
      const newContent = scrubPlanTags(block.content)
      return { ...block, content: newContent }
    })
    .filter((block) => block.type !== 'text' || block.content.trim() !== '')
}

export const insertPlanBlock = (
  blocks: ContentBlock[],
  planContent: string,
): ContentBlock[] => {
  const cleanedBlocks = scrubPlanTagsInBlocks(blocks)
  return [
    ...cleanedBlocks,
    {
      type: 'plan',
      content: planContent,
    },
  ]
}
