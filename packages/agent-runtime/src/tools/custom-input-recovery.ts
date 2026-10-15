import { jsonValueSchema } from '@savant-code/common/types/json'

import type { JSONValue } from '@savant-code/common/types/json'
import type z from 'zod/v4'

const REPAIRABLE_TYPES = new Set([
  'number',
  'int',
  'boolean',
  'array',
  'object',
])

function replaceAtPath(
  value: JSONValue,
  path: PropertyKey[],
  replacement: JSONValue,
): JSONValue {
  if (path.length === 0) return replacement
  const [head, ...tail] = path
  if (Array.isArray(value)) {
    return value.map((child, index) =>
      index === head ? replaceAtPath(child, tail, replacement) : child,
    )
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        key === head ? replaceAtPath(child, tail, replacement) : child,
      ]),
    )
  }
  return value
}

function atPath(value: JSONValue, path: PropertyKey[]): JSONValue | undefined {
  let current: JSONValue | undefined = value
  for (const key of path) {
    if (Array.isArray(current) && typeof key === 'number') {
      current = current[key]
    } else if (
      current !== null &&
      typeof current === 'object' &&
      !Array.isArray(current) &&
      typeof key === 'string' &&
      Object.hasOwn(current, key)
    ) {
      current = current[key]
    } else return undefined
  }
  return current
}

/** One decode only at a schema type-error path. Caller must revalidate fully. */
export function repairEncodedCustomInput(
  input: Record<string, JSONValue>,
  issues: z.core.$ZodIssue[],
): Record<string, JSONValue> {
  let repaired: JSONValue = input
  for (const issue of issues) {
    if (
      issue.code !== 'invalid_type' ||
      !REPAIRABLE_TYPES.has(issue.expected)
    ) {
      continue
    }
    const value = atPath(repaired, issue.path)
    if (typeof value !== 'string') continue
    try {
      const decoded = jsonValueSchema.safeParse(JSON.parse(value))
      if (decoded.success && typeof decoded.data !== 'string') {
        repaired = replaceAtPath(repaired, issue.path, decoded.data)
      }
    } catch {
      // Invalid JSON retains the original value and its validation failure.
    }
  }
  return repaired !== null &&
    typeof repaired === 'object' &&
    !Array.isArray(repaired)
    ? repaired
    : input
}
