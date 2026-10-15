import type { JSONValue } from '@savant-code/common/types/json'

export function formatValueForError(
  value: JSONValue | undefined,
  maxLength = 500,
  redact?: (text: string) => string,
): string {
  const serialized = JSON.stringify(value, null, 2) ?? 'undefined'
  const jsonStr = redact ? redact(serialized) : serialized
  const truncated =
    jsonStr.length > maxLength
      ? jsonStr.slice(0, maxLength) + '...(truncated)'
      : jsonStr
  if (value === null || value === undefined || typeof value !== 'object') {
    return `${truncated} (type: ${value === null ? 'null' : typeof value})`
  }
  return truncated
}
