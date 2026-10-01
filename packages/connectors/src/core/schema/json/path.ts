import { z } from 'zod'

import type { Json } from './type.ts'

/**
 * Restricted JSONPath — the RFC 9535-compatible subset we support:
 * `$` root, dot member access (`.name`), and non-negative numeric indexes (`[0]`).
 * No wildcards, filters, slices, or recursive descent.
 */
export const PATH_PATTERN = /^\$(\.[A-Za-z_][A-Za-z0-9_-]*(\[\d+\])*)*$/

export const zPath = z
  .string()
  .regex(
    PATH_PATTERN,
    'path must match the restricted JSONPath subset: $.a.b[0] (dot member + numeric index only)',
  )

/** Envelope paths (usage.capture) must be rooted at $.input or $.output. */
export const zEnvelopePath = zPath.refine(
  (path) => /^\$\.(input|output)([.[]|$)/.test(path),
  { message: 'envelope paths must start with $.input or $.output' },
)

/**
 * Evaluate a restricted path against a value. Returns undefined on any miss.
 * Shared by `J` (engine) and capture evaluation.
 */
export function getPath(
  value: Json | undefined,
  path: string,
): Json | undefined {
  if (!PATH_PATTERN.test(path)) return undefined
  let current: Json | undefined = value
  const segments =
    path.slice(1).match(/\.[A-Za-z_][A-Za-z0-9_-]*|\[\d+\]/g) ?? []
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined
    if (segment.startsWith('[')) {
      if (!Array.isArray(current)) return undefined
      current = current[Number(segment.slice(1, -1))]
    } else {
      if (typeof current !== 'object' || Array.isArray(current)) {
        return undefined
      }
      current = (current as Record<string, Json>)[segment.slice(1)]
    }
  }
  return current
}
