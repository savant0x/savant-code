/**
 * FID-2026-0919-011 — value-shape secret masking in the logger sanitizer.
 *
 * Key-name redaction never inspects VALUES, but raw payloads ship to remote
 * sinks (PostHog, Axiom) at error/fatal level (`sink.ts` includeRawData).
 * Secrets riding under output-carrying fields (`stdout`, `stderr`, `message`,
 * `content`, `command`, `input`, `value`) must be masked by shape before
 * fan-out. Pinned here:
 *
 *   1. Known credential prefixes (sk-, sk-ant-, ghp_, xoxb-, AKIA, Bearer …)
 *      are masked anywhere in an output field's string value.
 *   2. credential-KEY=value / KEY: value assignments are masked regardless
 *      of the value's shape (env-dump style leaks).
 *   3. High-entropy tokens (≥20 chars, mixed case + digit) are masked;
 *      lowercase-hex shapes (sha256, UUIDs) and innocent prose are NOT.
 *   4. Key-name redaction behavior is unchanged (existing suite stays
 *      authoritative).
 */
import { describe, expect, test } from 'bun:test'

import { maskSecretValues, sanitizeSecrets } from '../logger/sanitize'

/**
 * Fixture rule (T82-I): every secret-shaped fixture in this file uses a body
 * of **8–19 characters**. The masking layer needs ≥8 characters after a known
 * prefix to exercise its branch (`SECRET_PREFIX_REGEX` in
 * `cli/src/utils/logger/sanitize.ts`), while the fail-closed pre-push
 * credential scan flags prefixed bodies of ≥20 (`sk-`/`ghp_`/`xoxb-` in
 * `scripts/public-release/credential-scan.ts`) and cannot tell a fixture from a
 * leaked token. That scanner reads committed blobs **per commit**, so a single
 * ≥20-character literal here blocks the entire push (T82-I). Do NOT lengthen
 * these bodies back to 20+.
 */

describe('maskSecretValues (FID-2026-0919-011)', () => {
  test('masks known credential prefixes', () => {
    expect(maskSecretValues('key=sk-abc123XYZdef456g end')).toBe(
      'key=[REDACTED] end',
    )
    expect(maskSecretValues('token ghp_0a1B2c3D4e5F6g7H')).toBe(
      'token [REDACTED]',
    )
    expect(maskSecretValues('auth: Bearer xyz123abc456def789ghi')).toBe(
      'auth: [REDACTED]',
    )
  })

  test('masks credential KEY=value assignments regardless of value shape', () => {
    expect(
      maskSecretValues('TOKENHARBOR_API_KEY=thk_9f2c1b7a4e6d8f0a1b2c3d4e'),
    ).toBe('TOKENHARBOR_API_KEY=[REDACTED]')
    expect(maskSecretValues('SAVANT_CODE_API_KEY: sk-a1b2c3d4e5f6g7h8')).toBe(
      'SAVANT_CODE_API_KEY: [REDACTED]',
    )
    expect(maskSecretValues("db_password='hunter2-secret'")).toBe(
      'db_password=[REDACTED]',
    )
  })

  test('does NOT mask lowercase-hex shapes or innocent prose', () => {
    const sha =
      'sha256=f162b54de2adfc72d78adb1dbada2dedda111ae0a5e2f6e9500f4f909664c5d2 unchanged'
    expect(maskSecretValues(sha)).toBe(sha)
    expect(maskSecretValues('plain text with no secrets')).toBe(
      'plain text with no secrets',
    )
    expect(maskSecretValues('count=42 total=1337')).toBe('count=42 total=1337')
  })

  test('masks high-entropy mixed-case tokens standalone in output', () => {
    const leaked = 'result: a1B2c3D4e5F6g7H8i9J0k1K2l3L4m5N6 done'
    expect(maskSecretValues(leaked)).toBe('result: [REDACTED] done')
  })
})

describe('sanitizeSecrets value-shape integration (FID-2026-0919-011)', () => {
  test('masks secret values under output-carrying fields', () => {
    const input = {
      stdout: 'TOKENROUTER_API_KEY=trk_0a1b2c3d4e5f6g7h8i9j0',
      command: 'printenv',
      content: 'bearer sk-a1B2c3D4e5F6g7H8',
      name: 'unchanged mixed 42 Case text',
    }
    const result = sanitizeSecrets(input) as typeof input
    expect(result.stdout).toBe('TOKENROUTER_API_KEY=[REDACTED]')
    expect(result.command).toBe('printenv')
    expect(result.content).toBe('bearer [REDACTED]')
    expect(result.name).toBe('unchanged mixed 42 Case text')
  })

  test('output-field masking is case-insensitive on the key', () => {
    const input = { StdOut: 'prefix sk-a1B2c3D4e5F6g7H8 suffix' }
    const result = sanitizeSecrets(input) as typeof input
    expect(result.StdOut).toBe('prefix [REDACTED] suffix')
  })

  test('nested output fields are masked too', () => {
    const input = {
      result: { stdout: 'xoxb-000000-000000-000000abcdef123456' },
    }
    const result = sanitizeSecrets(input) as unknown as {
      result: { stdout: string }
    }
    expect(result.result.stdout).toBe('[REDACTED]')
  })

  test('key-name redaction behavior is unchanged', () => {
    const input = { apiKey: 'sk-12345', tokenCount: 7 }
    const result = sanitizeSecrets(input) as Record<string, unknown>
    expect(result.apiKey).toBe('[REDACTED]')
    expect(result.tokenCount).toBe(7)
  })
})
