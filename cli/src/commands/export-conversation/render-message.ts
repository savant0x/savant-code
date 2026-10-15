/**
 * Per-message row renderer for the exported report.
 */

import { LOGO_DATA_URI } from './branding'
import { buildMessageCopyText } from './copy-text'
import { ico } from './export-icons'
import { escapeHtml } from './format'
import { renderBlockHtml } from './render-blocks'
import { renderMarkdownLikeHtml } from './render-text'

import type { ChatMessage } from '../../types/chat'

export function renderMessageHtml(message: ChatMessage, index: number): string {
  const roleClass =
    message.variant === 'user'
      ? 'row-user'
      : message.variant === 'error'
        ? 'row-error'
        : 'row-assistant'

  const roleLabel =
    message.variant === 'user'
      ? 'User'
      : message.variant === 'error'
        ? 'Error'
        : 'Savant'

  // Copy-button payload: the plain text of this message (with sender label),
  // JSON-encoded so it round-trips through the HTML attribute (quotes/entities
  // decode correctly).
  const copyPayload = JSON.stringify(buildMessageCopyText(message, roleLabel))

  let contentHtml = ''
  if (message.blocks?.length) {
    contentHtml = message.blocks.map((b) => renderBlockHtml(b)).join('\n')
  } else if (message.content?.trim()) {
    contentHtml = renderMarkdownLikeHtml(message.content.trim())
  }

  // Attachments
  const attachments: string[] = []
  if (message.fileAttachments?.length) {
    attachments.push(
      `Attached files: ${message.fileAttachments.map((f) => escapeHtml(f.filename)).join(', ')}`,
    )
  }
  if (message.attachments?.length) {
    attachments.push(
      `Attached images: ${message.attachments.map((a) => escapeHtml(a.filename)).join(', ')}`,
    )
  }
  if (message.textAttachments?.length) {
    attachments.push(
      `Attached ${message.textAttachments.length} pasted text snippet(s)`,
    )
  }
  const attachmentHtml =
    attachments.length > 0
      ? `<div class="attachments muted">${ico('attachmentNotice')} ${attachments.map((a) => `<span>${a}</span>`).join('<br/>')}</div>`
      : ''

  const contentWrapper = contentHtml
    ? `<div class="assistant-prose">${contentHtml}</div>`
    : ''

  const markerHtml =
    message.variant === 'user'
      ? ico('userMarker')
      : message.variant === 'error'
        ? ico('warningMarker')
        : `<img class="row-logo" src="${LOGO_DATA_URI}" alt="Savant"/>`

  return `<div class="row ${roleClass}" id="msg-${index}">
  <button type="button" class="copy-btn" title="Copy message" aria-label="Copy message" data-copy="${escapeHtml(copyPayload)}" onclick="copyMessage(this)">${ico('copyButton')}<span>Copy</span></button>
  <div class="row-head">
    <span class="row-marker">${markerHtml}</span>
    <span class="row-role">${roleLabel}</span>
  </div>
  <div class="row-content">
    ${contentWrapper}
    ${attachmentHtml}
  </div>
</div>`
}
