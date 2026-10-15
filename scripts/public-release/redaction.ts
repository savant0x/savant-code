// FID-2026-0905-007 — public-release decomposition: secret redaction.
//
// Output redaction with residual credential-shape fail-closed checks, and
// receipt redaction. Verbatim moves from scripts/public-release.ts.

import { createHash } from 'crypto'

import { fail } from './fail'

import type { ReleaseReceipt } from './catalog'

export function redactSecretText(value: string): string {
  const redacted = value
    .replace(
      /((?:OPENROUTER_API_KEY|OR_MASTER_KEY|INFERENCE_API_KEY|GITHUB_TOKEN|GH_TOKEN|NPM_TOKEN|SAVANT_CODE_API_KEY|AWS_SECRET_ACCESS_KEY|API_KEY|TOKEN|PASSWORD|SECRET)\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,}]+)/gi,
      '$1[REDACTED]',
    )
    .replace(
      /(authorization\s*[:=]\s*(?:bearer|basic)\s+)[A-Za-z0-9+/=._~-]+/gi,
      '$1[REDACTED]',
    )
    .replace(/(AUTHORIZATION:\s*basic\s+)[A-Za-z0-9+/=._~-]+/gi, '$1[REDACTED]')
  if (
    /\b(?:bearer|basic)\s+[A-Za-z0-9+/=._~-]{16,}/i.test(redacted) ||
    // Residual unredacted credential shapes. The value must look high-entropy
    // (≥16 chars containing a digit; digits are immune to the /i flag) so
    // legitimate prose like "credential: certificate-holder-name" is never
    // discarded while real credentials (ghs_…, npm_…, mixed-case tokens) are.
    /\b(?:api[_-]?key|token|secret|password|authorization|credential|private[_-]?key|access[_-]?key)\s*[:=]\s*(?!\[REDACTED\])(?=[^\s,}]{15,}[0-9])(?=[A-Za-z0-9+/=._~-]{16,})[^\s,}]{16,}/i.test(
      redacted,
    )
  ) {
    fail(
      'Unclassified credential-shaped output; raw command output was discarded.',
    )
  }
  return redacted
}

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    )
  }
  return value
}

export function sha256Text(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function redactReceipt(receipt: ReleaseReceipt): string {
  let failedStage = receipt.failedStage
  try {
    failedStage = failedStage ? redactSecretText(failedStage) : failedStage
  } catch {
    failedStage = 'redaction-failed; sensitive failure details discarded'
  }
  return JSON.stringify(
    {
      ...receipt,
      schemaVersion: 'release-receipt/v2',
      failedStage,
    },
    null,
    2,
  )
}
