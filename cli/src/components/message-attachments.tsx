import { memo } from 'react'

import { FileAttachmentCard } from './file-attachment-card'
import { ImageCard } from './image-card'
import { TextAttachmentCard } from './text-attachment-card'

import type {
  FileAttachment,
  ImageAttachment,
  TextAttachment,
} from '../types/chat'

interface MessageAttachmentsProps {
  imageAttachments: ImageAttachment[]
  textAttachments: TextAttachment[]
  fileAttachments: FileAttachment[]
}

/**
 * Attachment row for user messages: image + text + file cards rendered in a
 * wrapping flex row. Returns null when every list is empty.
 */
export const MessageAttachments = memo(
  ({
    imageAttachments,
    textAttachments,
    fileAttachments,
  }: MessageAttachmentsProps) => {
    if (
      imageAttachments.length === 0 &&
      textAttachments.length === 0 &&
      fileAttachments.length === 0
    ) {
      return null
    }

    return (
      <box
        style={{
          flexDirection: 'row',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        {imageAttachments.map((attachment) => (
          <ImageCard
            key={attachment.path}
            image={attachment}
            showRemoveButton={false}
          />
        ))}
        {textAttachments.map((attachment) => (
          <TextAttachmentCard
            key={attachment.id}
            attachment={attachment}
            showRemoveButton={false}
          />
        ))}
        {fileAttachments.map((attachment) => (
          <FileAttachmentCard
            key={attachment.path}
            attachment={attachment}
            showRemoveButton={false}
          />
        ))}
      </box>
    )
  },
)
