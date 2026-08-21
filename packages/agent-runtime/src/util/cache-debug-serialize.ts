import { createHash } from 'crypto'

import type { JSONValue } from '@savant-code/common/types/json'

export type SerializableValue = JSONValue

export function normalizeForJson(
  value: JSONValue | undefined,
): SerializableValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (value instanceof URL) {
    return value.toString() as SerializableValue
  }

  if (value instanceof Uint8Array) {
    return {
      type: 'Uint8Array',
      byteLength: value.byteLength,
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForJson(item))
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, JSONValue>).map(
        ([key, entryValue]) => [key, normalizeForJson(entryValue)],
      ),
    )
  }

  return String(value)
}

export function summarizeDataUrl(value: string): SerializableValue {
  const firstComma = value.indexOf(',')
  const header = firstComma >= 0 ? value.slice(0, firstComma) : value
  const payload = firstComma >= 0 ? value.slice(firstComma + 1) : ''
  return {
    type: 'data-url',
    mediaType: header.slice(5).split(';')[0] || 'unknown',
    payloadLength: payload.length,
    preview: payload.slice(0, 32),
  }
}

export function summarizeLargeValue(
  value: SerializableValue,
): SerializableValue {
  if (Array.isArray(value)) {
    return value.map((item) => summarizeLargeValue(item))
  }

  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && value.startsWith('data:')) {
      return summarizeDataUrl(value)
    }
    return value
  }

  if (
    'url' in value &&
    typeof value.url === 'string' &&
    value.url.startsWith('data:')
  ) {
    return {
      ...value,
      url: summarizeDataUrl(value.url),
    }
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      if (
        key === 'file_data' &&
        typeof entryValue === 'string' &&
        entryValue.startsWith('data:')
      ) {
        return [key, summarizeDataUrl(entryValue)]
      }
      if (key === 'arguments' && typeof entryValue === 'string') {
        return [key, entryValue]
      }
      return [key, summarizeLargeValue(entryValue)]
    }),
  )
}

export function stableHash(value: JSONValue): string {
  return createHash('sha256')
    .update(JSON.stringify(normalizeForJson(value)))
    .digest('hex')
    .slice(0, 8)
}
