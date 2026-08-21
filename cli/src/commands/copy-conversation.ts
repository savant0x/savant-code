/**
 * `/copy` command — serialize the entire conversation (user + assistant text,
 * reasoning, tool calls with their inputs and outputs, sub-agents) into clean
 * Markdown and write it to the system clipboard.
 *
 * Over SSH the clipboard path is OSC 52, which caps the base64 payload at 32 KB
 * (see clipboard.ts). A real back-and-forth easily exceeds that, so when we're on
 * a remote session and the transcript is too large, we progressively drop the
 * largest tool results (then, if still needed, large tool inputs) — replacing each
 * with a short omission note — until it fits. Local sessions use pbcopy/xclip,
 * which have no such limit, so they always copy the full transcript.
 */

import {
  isDroppable,
  keepTailBytes,
  renderMessage,
  type Droppable,
  type Segment,
} from './copy-conversation-render'
import { useChatStore } from '../state/chat-store'
import {
  copyTextToClipboard,
  isRemoteSession,
  showClipboardMessage,
} from '../utils/clipboard'
import { IS_SAVANT_FREE } from '../utils/constants'

import type { RouterParams } from './command-registry'
import type { ChatMessage } from '../types/chat'

// OSC 52 caps its base64 payload at 32 KB (clipboard.ts OSC52_MAX_PAYLOAD).
// base64 is ~4/3 of the raw byte count, so the raw-text ceiling is ~24 KB. Leave
// headroom for tmux/screen passthrough wrapping and the message framing.
const OSC52_TEXT_BUDGET_BYTES = 22_000

const byteLen = (text: string): number => Buffer.byteLength(text, 'utf8')

export interface SerializedConversation {
  text: string
  /** Number of droppable tool bodies omitted to fit the clipboard budget. */
  omittedCount: number
  /** True if the transcript was hard-truncated as a last resort. */
  truncated: boolean
}

const TRUNCATION_MARKER =
  '_[…earlier conversation truncated to fit clipboard…]_'

/**
 * Serialize the conversation to Markdown. When `maxBytes` is provided and the
 * full transcript exceeds it, the largest tool results (then large tool inputs)
 * are replaced with a short omission note. If that still isn't enough (e.g. a
 * single huge text block), the oldest content is hard-truncated so the copy
 * always fits.
 */
export function serializeConversation(
  messages: ChatMessage[],
  options: { maxBytes?: number } = {},
): SerializedConversation {
  const segments: Segment[] = []
  for (const message of messages) {
    renderMessage(message, segments)
  }

  const product = IS_SAVANT_FREE ? 'SavantFree' : 'SavantCode'
  const header = `# ${product} conversation\n_${messages.length} message${messages.length === 1 ? '' : 's'}_`
  const prefix = `${header}\n\n---\n\n`

  const assembleBody = (dropped: Set<Droppable>): string =>
    segments
      .map((seg) =>
        isDroppable(seg) ? (dropped.has(seg) ? seg.note : seg.full) : seg,
      )
      .join('\n\n')

  const dropped = new Set<Droppable>()
  let body = assembleBody(dropped)
  let truncated = false

  const { maxBytes } = options
  if (maxBytes) {
    // The body must fit in maxBytes minus the prefix and the trailing newline.
    const bodyBudget = maxBytes - byteLen(prefix) - 1

    if (byteLen(body) > bodyBudget) {
      // Tier 1: drop tool outputs first (the bulk of the noise), then inputs.
      // Within each tier, largest first so we drop as few blocks as possible.
      // Pre-measure savings once rather than recomputing inside the comparator.
      const candidates = segments
        .filter(isDroppable)
        .map((d) => ({ d, save: byteLen(d.full) - byteLen(d.note) }))
        .filter((c) => c.save > 0)
        .sort((a, b) => {
          if (a.d.kind !== b.d.kind) return a.d.kind === 'output' ? -1 : 1
          return b.save - a.save
        })

      const needed = byteLen(body) - bodyBudget
      let saved = 0
      for (const { d, save } of candidates) {
        if (saved >= needed) break
        dropped.add(d)
        saved += save
      }
      body = assembleBody(dropped)
    }

    if (byteLen(body) > bodyBudget) {
      // Tier 2: nothing droppable left to cut (e.g. a giant text block). Keep
      // the most recent content and mark the truncation so the copy never fails.
      const marker = `${TRUNCATION_MARKER}\n\n`
      body = marker + keepTailBytes(body, bodyBudget - byteLen(marker))
      truncated = true
    }
  }

  return { text: `${prefix}${body}\n`, omittedCount: dropped.size, truncated }
}

export async function handleCopyConversationCommand(
  params: RouterParams,
): Promise<void> {
  const messages = useChatStore.getState().messages

  params.saveToHistory(params.inputValue.trim())
  params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })

  if (messages.length === 0) {
    showClipboardMessage('Nothing to copy — the conversation is empty.', {
      durationMs: 3000,
    })
    return
  }

  // Only remote sessions are subject to the OSC 52 size cap; local clipboard
  // tools (pbcopy/xclip/clip) handle arbitrarily large transcripts.
  const { text, omittedCount, truncated } = serializeConversation(messages, {
    maxBytes: isRemoteSession() ? OSC52_TEXT_BUDGET_BYTES : undefined,
  })

  const count = `${messages.length} message${messages.length === 1 ? '' : 's'}`
  // omittedCount covers dropped tool outputs and/or inputs, so phrase it as
  // "tool call(s)" rather than specifically "results".
  const trimNotes: string[] = []
  if (omittedCount > 0) {
    trimNotes.push(
      `${omittedCount} large tool call${omittedCount === 1 ? '' : 's'} trimmed`,
    )
  }
  if (truncated) trimNotes.push('older messages truncated')
  const successMessage =
    trimNotes.length > 0
      ? `Copied conversation · ${count} (${trimNotes.join(', ')} to fit clipboard)`
      : `Copied conversation · ${count}`

  try {
    await copyTextToClipboard(text, { successMessage, durationMs: 4000 })
  } catch {
    // copyTextToClipboard already surfaces a failure/guidance message.
  }
}
