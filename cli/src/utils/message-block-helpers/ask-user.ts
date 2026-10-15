import { askUserResponseSchema } from '@savant-code/common/tools/params/tool/ask-user'

import type { ContentBlock } from '../../types/chat'
import type { AskUserQuestion } from '@savant-code/common/tools/params/tool/ask-user'

/**
 * Options for transforming ask_user tool blocks to ask-user content blocks.
 */
export interface TransformAskUserOptions {
  toolCallId: string
  resultValue: unknown
}

/**
 * Transforms ask_user tool blocks into ask-user content blocks when tool results arrive.
 * Recursively processes nested agent blocks.
 */
export const transformAskUserBlocks = (
  blocks: ContentBlock[],
  options: TransformAskUserOptions,
): ContentBlock[] => {
  const { toolCallId, resultValue } = options

  return blocks.map((block) => {
    if (
      block.type === 'tool' &&
      block.toolCallId === toolCallId &&
      block.toolName === 'ask_user'
    ) {
      const responseParse = askUserResponseSchema.safeParse(resultValue)
      if (!responseParse.success) {
        // Trust-boundary guard: if the tool result does not match the expected
        // schema, keep the original tool block instead of creating malformed UI.
        return block
      }
      // `block.input` was already validated when the ask_user tool was invoked,
      // so a cast is safe here; `questions` is used for display only.
      const questions = block.input.questions as AskUserQuestion[]
      const { skipped, answers } = responseParse.data

      if (!answers && !skipped) {
        // If no result data, keep as tool block (fallback)
        return block
      }

      return {
        type: 'ask-user',
        toolCallId,
        questions,
        answers,
        skipped,
      }
    }

    if (block.type === 'agent' && block.blocks) {
      const updatedBlocks = transformAskUserBlocks(block.blocks, options)
      if (updatedBlocks !== block.blocks) {
        return { ...block, blocks: updatedBlocks }
      }
    }
    return block
  })
}
