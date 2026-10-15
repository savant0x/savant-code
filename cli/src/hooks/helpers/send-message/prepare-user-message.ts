import { getProjectRoot } from '../../../project-files'
import { useChatStore } from '../../../state/chat-store'
import { processBashContext } from '../../../utils/bash-context-processor'
import { processImagesForMessage } from '../../../utils/image-processor'
import { getUserMessage } from '../../../utils/message-history'
import { createModeDividerMessage } from '../../../utils/send-message-helpers'
import { yieldToEventLoop } from '../../../utils/yield-to-event-loop'

import type { ChatMessage } from '../../../types/chat'
import type {
  PendingAttachment,
  PendingFileAttachment,
  PendingImageAttachment,
  PendingTextAttachment,
} from '../../../types/store'
import type { AgentMode } from '../../../utils/constants'
import type { MessageContent } from '@savant-code/sdk'
import type { SetStateAction } from 'react'

export type PrepareUserMessageDeps = {
  setMessages: (update: SetStateAction<ChatMessage[]>) => void
  lastMessageMode: AgentMode | null
  setLastMessageMode: (mode: AgentMode | null) => void
  scrollToLatest: () => void
  setHasReceivedPlanResponse: (value: boolean) => void
}

export const prepareUserMessage = async (params: {
  content: string
  agentMode: AgentMode
  postUserMessage?: (prev: ChatMessage[]) => ChatMessage[]
  attachments?: PendingAttachment[]
  deps: PrepareUserMessageDeps
}): Promise<{
  userMessageId: string
  messageContent: MessageContent[] | undefined
  bashContextForPrompt: string
  finalContent: string
}> => {
  const { content, agentMode, postUserMessage, attachments, deps } = params
  const { setMessages, lastMessageMode, setLastMessageMode, scrollToLatest } =
    deps
  const { pendingBashMessages, clearPendingBashMessages } =
    useChatStore.getState()
  const { bashMessages, bashContextForPrompt } =
    processBashContext(pendingBashMessages)
  if (bashMessages.length > 0) {
    setMessages((prev) => [...prev, ...bashMessages])
  }
  clearPendingBashMessages()
  // Split attachments by kind
  const allAttachments =
    attachments ?? useChatStore.getState().pendingAttachments
  if (!attachments && allAttachments.length > 0) {
    useChatStore.getState().clearPendingAttachments()
  }
  const pendingImages = allAttachments.filter(
    (a): a is PendingImageAttachment => a.kind === 'image',
  )
  const pendingTextAttachments = allAttachments.filter(
    (a): a is PendingTextAttachment => a.kind === 'text',
  )
  const pendingFileAttachments = allAttachments.filter(
    (a): a is PendingFileAttachment => a.kind === 'file',
  )
  // Append text attachments to the content
  let finalContent = content
  if (pendingTextAttachments.length > 0) {
    const textAttachmentContent = pendingTextAttachments
      .map((att) => `[Pasted Text]\n${att.content}`)
      .join('\n\n')
    finalContent = content
      ? `${content}\n\n${textAttachmentContent}`
      : textAttachmentContent
  }
  // Append file/folder attachments to the content
  if (pendingFileAttachments.length > 0) {
    const fileAttachmentContent = pendingFileAttachments
      .filter((att) => att.status === 'ready')
      .map((att) =>
        att.isDirectory
          ? `[Directory: ${att.path}]\n${att.content}`
          : `[File: ${att.path}]\n${att.content}`,
      )
      .join('\n\n')
    if (fileAttachmentContent) {
      finalContent = finalContent
        ? `${finalContent}\n\n${fileAttachmentContent}`
        : fileAttachmentContent
    }
  }
  const { attachments: imageAttachments, messageContent } =
    await processImagesForMessage({
      content: finalContent,
      pendingImages,
      projectRoot: getProjectRoot(),
    })
  const shouldInsertDivider =
    lastMessageMode === null || lastMessageMode !== agentMode
  // Convert pending text attachments to stored text attachments for display
  const textAttachmentsForMessage = pendingTextAttachments.map((att) => ({
    id: att.id,
    content: att.content,
    preview: att.preview,
    charCount: att.charCount,
  }))
  // Convert pending file attachments to stored file attachments for display
  const fileAttachmentsForMessage = pendingFileAttachments
    .filter((att) => att.status === 'ready')
    .map((att) => ({
      path: att.path,
      filename: att.filename,
      isDirectory: att.isDirectory,
      note: att.note,
    }))
  // Pass original content (not finalContent) for display, but finalContent goes to agent
  const userMessage = getUserMessage(
    content,
    imageAttachments,
    textAttachmentsForMessage,
    fileAttachmentsForMessage,
  )
  const userMessageId = userMessage.id
  if (imageAttachments.length > 0) {
    userMessage.attachments = imageAttachments
  }
  setMessages((prev) => {
    let next = [...prev]
    if (shouldInsertDivider) {
      next.push(createModeDividerMessage(agentMode))
    }
    next.push(userMessage)
    if (postUserMessage) {
      next = postUserMessage(next)
    }
    // Keep the full transcript: this array is what saveChatState persists to
    // chat-messages.json, so trimming here would permanently lose history.
    // Rendering stays cheap because useChatMessages paginates what's shown.
    return next
  })
  setLastMessageMode(agentMode)
  await yieldToEventLoop()
  setTimeout(() => scrollToLatest(), 0)
  return {
    userMessageId,
    messageContent,
    bashContextForPrompt,
    finalContent,
  }
}
