import type { Message } from '../../types/messages/savant-code-message'

/** Internal harness guidance tags that must not appear as ordinary user output. */
export const INTERNAL_ECHO_MESSAGE_TAGS = [
  'ECHO_COMPLIANCE',
  'ECHO_REFRESH',
  'ECHO_STEERING',
] as const

export type InternalEchoMessageTag = (typeof INTERNAL_ECHO_MESSAGE_TAGS)[number]

export function isInternalEchoMessage(message: Message): boolean {
  return Boolean(
    message.tags?.some((tag) =>
      (INTERNAL_ECHO_MESSAGE_TAGS as readonly string[]).includes(tag),
    ),
  )
}

/** Remove internal ECHO messages from a host-visible message projection. */
export function filterInternalEchoMessages(messages: Message[]): Message[] {
  return messages.filter((message) => !isInternalEchoMessage(message))
}
