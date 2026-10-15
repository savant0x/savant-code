/**
 * FID-2026-0806-012 — cyclic-safe JSON serialization for chat-state
 * persistence. A run state (or its error objects) can carry circular
 * references; a plain JSON.stringify on the save path would throw and the
 * whole checkpoint — including the transcript — would be lost, breaking
 * `--continue`/resume. This uses the WeakSet replacer pattern already proven
 * in evals/v2/src/reports.ts (createJsonSafeReplacer) and
 * cli/src/utils/logger.ts (safeStringify):
 *
 *   - circular references → the string "[Circular]"
 *   - Error instances → { name, message, statusCode? }
 *   - BigInt → decimal string (JSON.stringify would throw)
 *
 * Never throws for any object graph; the only remaining JSON.stringify failure
 * (a Symbol-keyed value at the root) falls back to String(value).
 */
export function safeStringify(value: unknown, space?: number): string {
  const seen = new WeakSet<object>()
  let serialized: string | undefined
  try {
    serialized = JSON.stringify(
      value,
      (_key, val: unknown) => {
        if (val instanceof Error) {
          return {
            name: val.name,
            message: val.message,
            ...('statusCode' in val &&
            typeof (val as { statusCode?: unknown }).statusCode === 'number'
              ? { statusCode: (val as { statusCode: number }).statusCode }
              : {}),
          }
        }
        if (typeof val === 'bigint') {
          return String(val)
        }
        if (val !== null && typeof val === 'object') {
          if (seen.has(val)) {
            return '[Circular]'
          }
          seen.add(val)
        }
        return val
      },
      space,
    )
  } catch {
    return '[Unserializable]'
  }
  if (serialized !== undefined) {
    return serialized
  }
  return String(value)
}
