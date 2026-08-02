import type { JSONValue } from '@savant-code/common/types/json'

export function formatValueForError(
  value: JSONValue | undefined,
  maxLength = 500,
): string {
  const jsonStr = JSON.stringify(value, null, 2) ?? 'undefined'
  const truncated =
    jsonStr.length > maxLength
      ? jsonStr.slice(0, maxLength) + '...(truncated)'
      : jsonStr
  if (value === null || value === undefined || typeof value !== 'object') {
    return `${truncated} (type: ${value === null ? 'null' : typeof value})`
  }
  return truncated
}
