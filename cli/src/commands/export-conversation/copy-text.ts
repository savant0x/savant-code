/**
 * Plain-text payload builders for the per-message copy buttons. These mirror
 * the rendered HTML content (text/plan content, tool calls, agent blocks,
 * ask-user Q&A, image/attachment notes).
 */
import {
  formatAgentName,
  renderToolInput,
  renderToolOutput,
  toolDisplayName,
} from './format'

import type { ChatMessage, ContentBlock } from '../../types/chat'

/**
 * Plain-text payload for a block. Mirrors the rendered content: text/plan
 * content, tool calls (name + input + output), agent blocks (prompt + content
 * + children), ask-user Q&A, image/attachment notes.
 */
export function blockCopyText(block: ContentBlock): string {
  switch (block.type) {
    case 'text':
      return block.content ?? ''
    case 'tool': {
      const inputText = renderToolInput(block.input)
      // Mirror the rendered output formatting (JSON pretty-printed, raw otherwise).
      const output = renderToolOutput(block.output ?? '').body
      const sections = [toolDisplayName(block.toolName)]
      if (inputText.trim()) sections.push(`Input:\n${inputText}`)
      if (output.trim()) sections.push(`Output:\n${output}`)
      return sections.join('\n\n')
    }
    case 'agent': {
      const parts: string[] = [
        formatAgentName(block.agentName || block.agentType),
      ]
      if (block.initialPrompt?.trim()) {
        parts.push(`Prompt: ${block.initialPrompt.trim()}`)
      }
      if (block.content?.trim()) parts.push(block.content.trim())
      for (const child of block.blocks ?? []) {
        const childText = blockCopyText(child).trim()
        if (childText) parts.push(childText)
      }
      return parts.join('\n\n')
    }
    case 'plan':
      return block.content ?? ''
    case 'ask-user':
      return block.questions
        .map((q, i) => {
          const answer = block.answers?.find((a) => a.questionIndex === i)
          const selected =
            answer?.selectedOptions?.join(', ') ??
            answer?.selectedOption ??
            answer?.otherText ??
            (block.skipped ? '(skipped)' : '(no answer)')
          return `Q: ${q.question}\nA: ${selected}`
        })
        .join('\n\n')
    case 'image':
      return `[Image: ${block.filename ?? block.mediaType ?? 'unknown'}]`
    case 'agent-list':
      return block.agents.map((a) => a.displayName).join(', ')
    default:
      return ''
  }
}

/**
 * Build the plain-text payload for a message's copy button. Mirrors the
 * rendered row exactly (blocks when present, otherwise content — never both),
 * prefixed with who sent it (User / Savant / Error) so a copied section or a
 * full-session paste keeps the speaker attribution.
 */
export function buildMessageCopyText(
  message: ChatMessage,
  roleLabel: string,
): string {
  const parts: string[] = []
  if (message.blocks?.length) {
    for (const block of message.blocks) {
      const text = blockCopyText(block).trim()
      if (text) parts.push(text)
    }
  } else if (message.content?.trim()) {
    parts.push(message.content.trim())
  }
  if (message.fileAttachments?.length) {
    parts.push(
      `Attached files: ${message.fileAttachments.map((f) => f.filename).join(', ')}`,
    )
  }
  if (message.attachments?.length) {
    parts.push(
      `Attached images: ${message.attachments.map((a) => a.filename).join(', ')}`,
    )
  }
  if (message.textAttachments?.length) {
    parts.push(
      `Attached ${message.textAttachments.length} pasted text snippet(s)`,
    )
  }
  const body = parts.join('\n\n')
  return body ? `${roleLabel}\n\n${body}` : roleLabel
}
