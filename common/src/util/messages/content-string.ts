import type { ModelMessage } from 'ai'

export function toContentString(msg: ModelMessage): string {
  const { content } = msg
  if (typeof content === 'string') return content
  return content
    .map((item) =>
      item && 'text' in item && typeof item.text === 'string' ? item.text : '',
    )
    .join('\n')
}
