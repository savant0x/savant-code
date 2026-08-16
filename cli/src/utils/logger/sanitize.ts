import type { LogValue } from '@savant-code/common/types/contracts/logger'

/**
 * Secret redaction for log/analytics payloads.
 * (FID-2026-0809-016: extracted from `cli/src/utils/logger.ts`.)
 */

const SENSITIVE_KEYS = new Set([
  'authToken',
  'apiKey',
  'api_key',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'password',
  'authorization',
])

/**
 * Lowercased sensitive-key substrings, hoisted so the per-key check never
 * re-lowercases or re-allocates on the log hot path (FID-2026-0815-012 G-03).
 * `Array.from` preserves the Set's insertion order, so match semantics are
 * identical to the previous `Array.from(SENSITIVE_KEYS).some(...)` scan.
 */
const SENSITIVE_KEY_SUBSTRINGS = Array.from(SENSITIVE_KEYS, (key) =>
  key.toLowerCase(),
)

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  return SENSITIVE_KEY_SUBSTRINGS.some((sensitive) => lower.includes(sensitive))
}

/**
 * Recursively redact string values whose keys look like secrets/tokens.
 *
 * Matching is case-insensitive and matches any key that *contains* a sensitive
 * substring (e.g. `myApiKey`, `auth_token`, `userToken`). This means keys like
 * `tokenCount` will also be redacted; we accept that over-redaction to avoid
 * leaking credentials in logs, analytics, or error reports.
 */
export function sanitizeSecrets(value: LogValue): LogValue {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return value
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSecrets(item as LogValue)) as LogValue
  }
  const result: Record<string, LogValue> = {}
  for (const [key, val] of Object.entries(value)) {
    if (isSensitiveKey(key) && typeof val === 'string') {
      result[key] = '[REDACTED]'
    } else {
      result[key] = sanitizeSecrets(val as LogValue)
    }
  }
  return result
}

export function safeStringify(obj: LogValue): string {
  const seen = new WeakSet()
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]'
      }
      seen.add(value)
    }
    return value
  })
}
