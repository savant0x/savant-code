import { describe, expect, test } from 'bun:test'

import { sanitizeSecrets } from '../logger'

describe('sanitizeSecrets', () => {
  test('passes through primitive and simple values unchanged', () => {
    expect(sanitizeSecrets('hello')).toBe('hello')
    expect(sanitizeSecrets(42)).toBe(42)
    expect(sanitizeSecrets(true)).toBe(true)
    expect(sanitizeSecrets(null)).toBe(null)
    expect(sanitizeSecrets(undefined)).toBe(undefined)
  })

  test('redacts string values whose keys look like secrets/tokens', () => {
    const input = {
      authToken: 'super-secret-token',
      apiKey: 'sk-12345',
      accessToken: 'a1b2c3',
      refreshToken: 'refresh-me',
      secret: 'shh',
      password: 'hunter2',
      authorization: 'Bearer xyz',
    }

    const result = sanitizeSecrets(input) as typeof input

    expect(result.authToken).toBe('[REDACTED]')
    expect(result.apiKey).toBe('[REDACTED]')
    expect(result.accessToken).toBe('[REDACTED]')
    expect(result.refreshToken).toBe('[REDACTED]')
    expect(result.secret).toBe('[REDACTED]')
    expect(result.password).toBe('[REDACTED]')
    expect(result.authorization).toBe('[REDACTED]')
  })

  test('redacts nested secrets in nested objects and arrays', () => {
    const input = {
      user: {
        name: 'Alice',
        apiKey: 'nested-key',
      },
      items: [{ token: 'item-token' }, { safe: 'keep' }],
    }

    const result = sanitizeSecrets(input) as typeof input

    expect(result.user.name).toBe('Alice')
    expect(result.user.apiKey).toBe('[REDACTED]')
    expect(result.items[0]?.token).toBe('[REDACTED]')
    expect(result.items[1]?.safe).toBe('keep')
  })

  test('does not redact non-string secret-like values', () => {
    const input = {
      apiKey: 123,
      token: true,
    }

    const result = sanitizeSecrets(input) as typeof input

    expect(result.apiKey).toBe(123)
    expect(result.token).toBe(true)
  })

  test('matches secret keys case-insensitively and for partial matches', () => {
    const input = {
      auth_token: 'snake-case',
      API_KEY: 'shouty',
      myApiKey: 'camel-case',
      userToken: 'also-camel',
    }

    const result = sanitizeSecrets(input) as typeof input

    expect(result.auth_token).toBe('[REDACTED]')
    expect(result.API_KEY).toBe('[REDACTED]')
    expect(result.myApiKey).toBe('[REDACTED]')
    expect(result.userToken).toBe('[REDACTED]')
  })
})
