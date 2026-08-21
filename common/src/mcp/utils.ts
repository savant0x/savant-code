// Hard cap — user-configured timeout is clamped to this ceiling.
const MAX_TIMEOUT_MS = 300_000

/**
 * Races a promise against a timeout. Rejects with a timeout Error if the
 * promise does not settle within `ms` milliseconds. The timer is always
 * cleared (via .finally) to avoid leaks when the promise wins the race.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMessage)), ms)
  })
  return Promise.race([promise, timeoutPromise]).finally(() =>
    clearTimeout(timer),
  )
}

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
