/** Stable marker used when a durable object points back to an active ancestor. */
export const CIRCULAR_REFERENCE_MARKER = '[circular reference omitted]'

export interface SafeJsonStringifyOptions {
  omitKeys?: ReadonlySet<string>
}

/**
 * Encode a JSON-shaped value without allowing runtime-only cycles to abort a
 * durable write. The active ancestor chain, rather than a global visited set,
 * distinguishes a real cycle from an acyclic object referenced twice.
 */
export function safeJsonStringify(
  value: unknown,
  options: SafeJsonStringifyOptions = {},
): string | undefined {
  const ancestors: object[] = []
  return JSON.stringify(
    value,
    function replacer(this: unknown, key: string, current: unknown): unknown {
      if (options.omitKeys?.has(key) || typeof current === 'function') {
        return undefined
      }
      if (current === null || typeof current !== 'object') return current

      while (ancestors.at(-1) !== this && ancestors.length > 0) {
        ancestors.pop()
      }
      if (ancestors.includes(current)) return CIRCULAR_REFERENCE_MARKER
      ancestors.push(current)
      return current
    },
  )
}
