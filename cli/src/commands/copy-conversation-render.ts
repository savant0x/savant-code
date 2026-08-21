import type { ChatMessage, ContentBlock } from '../types/chat'

/**
 * `/copy` Markdown rendering (FID-2026-0819-005 split): pure segment
 * rendering — text/reasoning/tool/agent/plan/ask-user/image blocks into a
 * flat segment list with droppable tool bodies. The budget/drop logic and the
 * command handler live in copy-conversation.ts.
 */

const byteLen = (text: string): number => Buffer.byteLength(text, 'utf8')

/** Human-friendly tool label, e.g. `read_files` -> `Read Files`. */
function toolDisplayName(toolName: string): string {
  if (toolName === 'list_directory') return 'List Directories'
  return toolName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

/**
 * Return the longest suffix of `s` that fits in `maxBytes`, cut on a UTF-8
 * codepoint boundary (and a line boundary when one is close by) so the result
 * is valid text. Used as the last-resort fallback when dropping tool bodies
 * still can't get the transcript under the clipboard budget.
 */
export function keepTailBytes(s: string, maxBytes: number): string {
  if (maxBytes <= 0) return ''
  const buf = Buffer.from(s, 'utf8')
  if (buf.length <= maxBytes) return s

  let start = buf.length - maxBytes
  // Advance off any UTF-8 continuation byte (0b10xxxxxx) to a codepoint start.
  while (start < buf.length && (buf[start] & 0xc0) === 0x80) start++
  // Prefer cutting at the next line boundary if it's nearby, for cleaner output.
  const nl = buf.indexOf(0x0a, start)
  if (nl !== -1 && nl - start < 200) start = nl + 1
  return buf.toString('utf8', start)
}

/**
 * A segment of the rendered transcript whose body can be dropped to save space.
 * `full` is the normal rendering; `note` is the compact omission replacement.
 */
export interface Droppable {
  kind: 'output' | 'input'
  full: string
  note: string
}

export type Segment = string | Droppable

export const isDroppable = (segment: Segment): segment is Droppable =>
  typeof segment !== 'string'

function fence(content: string, lang = ''): string {
  // Avoid breaking out of the fence if the content itself contains ```.
  const ticks = content.includes('```') ? '````' : '```'
  return `${ticks}${lang}\n${content}\n${ticks}`
}

export function renderToolInput(input: unknown): string {
  if (input == null) return ''
  if (
    (Array.isArray(input) && input.length === 0) ||
    (typeof input === 'object' &&
      !Array.isArray(input) &&
      Object.keys(input as Record<string, unknown>).length === 0)
  ) {
    return ''
  }
  try {
    return JSON.stringify(input, null, 2)
  } catch {
    return String(input)
  }
}

/**
 * Tool results are stored as strings; many are a JSON envelope (e.g. the
 * `[{"type":"json","value":{...}}]` shape from terminal/tool calls). Pretty-print
 * when the string parses as JSON so the transcript is readable; otherwise keep
 * the raw text. Returns the fence language to use alongside the body.
 */
export function renderToolOutput(output: string): {
  body: string
  lang: string
} {
  const trimmed = output.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return {
        body: JSON.stringify(JSON.parse(trimmed), null, 2),
        lang: 'json',
      }
    } catch {
      // Not valid JSON — fall through to raw.
    }
  }
  return { body: output, lang: '' }
}

function roleHeading(message: ChatMessage): string {
  switch (message.variant) {
    case 'user':
      return '## User'
    case 'error':
      return '## Error'
    default:
      return '## Assistant'
  }
}

/**
 * Render a single content block into the segment list. Recurses for sub-agents.
 * Pushes plain strings for fixed text and `Droppable` objects for tool bodies.
 */
export function renderBlock(block: ContentBlock, out: Segment[]): void {
  switch (block.type) {
    case 'text': {
      const text = block.content?.trim()
      if (!text) return
      if (block.textType === 'reasoning') {
        // Reasoning as a blockquote so it reads as model thinking, not output.
        const quoted = text
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n')
        out.push(`> _Reasoning_\n${quoted}`)
      } else {
        out.push(text)
      }
      return
    }

    case 'tool': {
      const name = toolDisplayName(block.toolName)
      const inputText = renderToolInput(block.input)
      const hasInput = inputText.trim().length > 0
      const output = block.output ?? ''
      const hasOutput = output.trim().length > 0

      // A tool call with no input and no output (e.g. still running) gets a
      // compact one-liner rather than a header with nothing beneath it.
      if (!hasInput && !hasOutput) {
        out.push(`**🛠 ${name}** _(no input or output)_`)
        return
      }

      out.push(`**🛠 ${name}**`)
      if (hasInput) {
        out.push({
          kind: 'input',
          full: fence(inputText, 'json'),
          note: `_Input omitted (${formatBytes(byteLen(inputText))}) to fit clipboard._`,
        })
      }
      if (hasOutput) {
        const rendered = renderToolOutput(output)
        out.push({
          kind: 'output',
          full: fence(rendered.body, rendered.lang),
          note: `_Result omitted (${formatBytes(byteLen(rendered.body))}) to fit clipboard._`,
        })
      }
      return
    }

    case 'agent': {
      const label = block.agentName || block.agentType
      out.push(
        `### ⤷ Subagent: ${label}${block.agentName ? ` (${block.agentType})` : ''}`,
      )
      if (block.initialPrompt?.trim()) {
        out.push(`_Prompt:_ ${block.initialPrompt.trim()}`)
      }
      if (block.content?.trim()) {
        out.push(block.content.trim())
      }
      for (const child of block.blocks ?? []) {
        renderBlock(child, out)
      }
      out.push('### ⤶ End subagent')
      return
    }

    case 'plan': {
      if (block.content?.trim()) {
        out.push(`**Plan**\n\n${block.content.trim()}`)
      }
      return
    }

    case 'ask-user': {
      for (const [i, q] of block.questions.entries()) {
        const answer = block.answers?.find((a) => a.questionIndex === i)
        const selected =
          answer?.selectedOptions?.join(', ') ??
          answer?.selectedOption ??
          answer?.otherText ??
          (block.skipped ? '(skipped)' : '(no answer)')
        out.push(`**Question:** ${q.question}\n_Answer:_ ${selected}`)
      }
      return
    }

    case 'image': {
      out.push(`_[image: ${block.filename ?? block.mediaType}]_`)
      return
    }

    case 'agent-list': {
      const names = block.agents.map((a) => a.displayName).join(', ')
      if (names) out.push(`_[available agents: ${names}]_`)
      return
    }

    // mode-divider and html carry no transcript-worthy text.
    default:
      return
  }
}

export function renderMessage(message: ChatMessage, out: Segment[]): void {
  out.push(roleHeading(message))

  if (message.blocks?.length) {
    for (const block of message.blocks) {
      renderBlock(block, out)
    }
  } else if (message.content?.trim()) {
    out.push(message.content.trim())
  }

  // Attachments live on the message, not in blocks — note them for context.
  const fileNames = message.fileAttachments?.map((f) => f.filename) ?? []
  const imageNames = message.attachments?.map((a) => a.filename) ?? []
  const textCount = message.textAttachments?.length ?? 0
  if (fileNames.length) out.push(`> Attached files: ${fileNames.join(', ')}`)
  if (imageNames.length) out.push(`> Attached images: ${imageNames.join(', ')}`)
  if (textCount) out.push(`> Attached ${textCount} pasted text snippet(s)`)
}
