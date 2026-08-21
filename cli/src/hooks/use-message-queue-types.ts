import type { PendingAttachment } from '../types/store'

export type StreamStatus = 'idle' | 'waiting' | 'streaming'

export type QueuedMessage = {
  content: string
  attachments: PendingAttachment[]
}
