// Public release contract — command-result classification and credential
// redaction. Sibling of the FID-2026-0819-005 Loop 317 decomposition.

import { describe, expect, test } from 'bun:test'

import {
  classifyCommandResult,
  redactSecretText,
  sha256Text,
} from './public-release'

describe('public release contract — redaction', () => {
  test('classifies exit, signal, spawn, timeout, malformed, and success results', () => {
    expect(classifyCommandResult({ status: 0, signal: null })).toBe('success')
    expect(classifyCommandResult({ status: 2, signal: null })).toBe('exit')
    expect(classifyCommandResult({ status: null, signal: 'SIGTERM' })).toBe(
      'signal',
    )
    expect(
      classifyCommandResult({
        status: null,
        signal: null,
        error: new Error('spawn'),
      }),
    ).toBe('spawn-error')
    expect(
      classifyCommandResult({
        status: null,
        signal: null,
        error: Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }),
      }),
    ).toBe('timeout')
    expect(classifyCommandResult({ status: null, signal: null })).toBe(
      'malformed',
    )
  })

  test('fails closed on uncertain credential-shaped output', () => {
    expect(() => redactSecretText('Authorization: Bearer short')).not.toThrow()
    expect(() =>
      redactSecretText('credential: definitely-not-safe-123456'),
    ).toThrow('Unclassified credential-shaped output')
    expect(() =>
      redactSecretText('token=unclassified-secret-value-123456'),
    ).not.toThrow()
  })

  test('redacts token-shaped output and preserves a stable hash', () => {
    const output =
      'API_KEY=secret TOKEN:token-value Authorization: Bearer bearer-secret'
    const redacted = redactSecretText(output)
    expect(redacted).not.toContain('secret')
    expect(redacted).not.toContain('token-value')
    expect(redacted).not.toContain('bearer-secret')
    expect(sha256Text('same')).toBe(sha256Text('same'))
    expect(sha256Text('same')).not.toBe(sha256Text('different'))
  })

  test('does not discard legitimate prose from credential-shaped lines', () => {
    expect(() =>
      redactSecretText('credential: certificate-holder-name'),
    ).not.toThrow()
    expect(() =>
      redactSecretText('credential: definitely-not-safe-123456'),
    ).toThrow('Unclassified credential-shaped output')
  })
})
