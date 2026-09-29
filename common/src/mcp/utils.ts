// Hard cap — user-configured timeout is clamped to this ceiling.
const MAX_TIMEOUT_MS = 300_000

/**
 * Races a promise against a timeout — re-exported from the canonical home
 * (FID-2026-0928-009: one body in `util/promise`; the local copy here was
 * the second truth the shared-primitive rule now forbids). The canonical
 * signature's optional message defaults to a timeout error.
 */
export { withTimeout } from '../util/promise'

/**
 * Clamps a user-supplied timeout to [1, MAX_TIMEOUT_MS].
 * Returns the default if the input is undefined.
 */
export function clampTimeout(
  value: number | undefined,
  defaultValue: number,
): number {
  if (value === undefined) return defaultValue
  return Math.min(Math.max(Math.round(value), 1), MAX_TIMEOUT_MS)
}

/**
 * Substitutes environment variable references ($VAR_NAME) in a string with their values.
 * Supports both simple replacement ("$VAR_NAME") and interpolation ("Bearer $VAR_NAME").
 */
export function substituteEnvInValue(value: string): string {
  return value.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
    const envValue = process.env[varName]
    if (envValue === undefined) {
      // Return original if env var not found
      return match
    }
    return envValue
  })
}

/**
 * Substitutes environment variable references in all values of a record.
 */
export function substituteEnvInRecord(
  record: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(record)) {
    result[key] = substituteEnvInValue(value)
  }
  return result
}
