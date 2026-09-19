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
 * Output-carrying fields (FID-2026-0919-011): the keys whose string values
 * carry command output, file contents, or shell commands — the exact places
 * secret VALUES ride when a credential leaks into a tool result (e.g. via
 * env inheritance). Key-name redaction alone never inspects these.
 */
const OUTPUT_FIELD_KEYS = new Set([
  'stdout',
  'stderr',
  'message',
  'content',
  'command',
  'input',
  'value',
])

/**
 * Known credential token prefixes (FID-2026-0919-011): masked regardless of
 * entropy. Mirrors the credential surface documented in sdk/src/env.ts plus
 * common provider token formats.
 */
const SECRET_PREFIX_REGEX =
  /(?:sk-ant-|sk-|ghp_|github_pat_|xoxb-|xoxp-|AKIA|Bearer\s+)[A-Za-z0-9_\-]{8,}/g

/**
 * KEY=value / key: value shapes where the KEY names a credential
 * (FID-2026-0919-011): catches env-dump style leaks (`SAVANT_CODE_API_KEY=…`)
 * regardless of the value's shape.
 */
const CREDENTIAL_ASSIGNMENT_REGEX =
  /((?:[A-Za-z0-9_]*(?:api[_-]?key|token|secret|password|authorization|credential)[A-Za-z0-9_]*)\s*[=:]\s*)("?[!-~]{8,}"?)/gi

/**
 * High-entropy token heuristic: ≥20 chars of token charset containing at
 * least one digit, one lowercase, and one uppercase letter. Deliberately
 * misses lowercase-hex shapes (sha256 fingerprints, UUIDs) to keep false
 * positives low; the assignment regex above covers named credentials.
 */
const HIGH_ENTROPY_TOKEN_REGEX = /[A-Za-z0-9_\-]{20,}/g

function isHighEntropy(candidate: string): boolean {
  return (
    /[0-9]/.test(candidate) &&
    /[a-z]/.test(candidate) &&
    /[A-Z]/.test(candidate)
  )
}

/**
 * Mask secret-shaped values inside an output string (FID-2026-0919-011).
 * Three layers: known credential prefixes; credential KEY=value assignments;
 * high-entropy tokens. Over-redaction of a legitimate long mixed-case token
 * inside an output field is accepted (same tradeoff documented for key-name
 * redaction); the summary path is unaffected and local console output is
 * not routed through the remote fan-out that consumes this.
 */
export function maskSecretValues(text: string): string {
  let masked = text.replace(SECRET_PREFIX_REGEX, '[REDACTED]')
  masked = masked.replace(
    CREDENTIAL_ASSIGNMENT_REGEX,
    (_full, prefix: string) => `${prefix}[REDACTED]`,
  )
  masked = masked.replace(HIGH_ENTROPY_TOKEN_REGEX, (candidate) =>
    isHighEntropy(candidate) ? '[REDACTED]' : candidate,
  )
  return masked
}

/**
 * Recursively redact string values whose keys look like secrets/tokens.
 *
 * Matching is case-insensitive and matches any key that *contains* a sensitive
 * substring (e.g. `myApiKey`, `auth_token`, `userToken`). This means keys like
 * `tokenCount` will also be redacted; we accept that over-redaction to avoid
 * leaking credentials in logs, analytics, or error reports.
 *
 * FID-2026-0919-011: string values under the output-carrying fields
 * (`stdout`, `stderr`, `message`, `content`, `command`, `input`, `value`)
 * additionally get a VALUE-shape pass (`maskSecretValues`), because secret
 * values ride in output fields under innocent key names and raw payloads
 * ship to remote sinks at error/fatal level.
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
    } else if (
      typeof val === 'string' &&
      OUTPUT_FIELD_KEYS.has(key.toLowerCase())
    ) {
      result[key] = maskSecretValues(val)
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
