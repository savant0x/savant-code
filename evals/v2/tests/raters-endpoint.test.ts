import { describe, expect, it } from 'bun:test'

import {
  AUTORATER_KEY_ENV_VAR,
  AUTORATER_TIMEOUT_ENV_VAR,
  AUTORATER_URL_ENV_VAR,
  resolveAutoraterEndpoint,
} from '../src/raters/endpoint'

describe('resolveAutoraterEndpoint', () => {
  it('is disabled when the URL variable is absent', () => {
    expect(resolveAutoraterEndpoint({})).toEqual({ configured: false })
  })

  it('is disabled when the URL variable is blank', () => {
    expect(
      resolveAutoraterEndpoint({ [AUTORATER_URL_ENV_VAR]: '   ' }),
    ).toEqual({ configured: false })
  })

  it('resolves an https endpoint with defaults and no key', () => {
    const resolved = resolveAutoraterEndpoint({
      [AUTORATER_URL_ENV_VAR]: 'https://judge.example.internal/grade',
    })
    if (!resolved.configured) throw new Error('expected a configured endpoint')
    expect(resolved.config.url.href).toBe(
      'https://judge.example.internal/grade',
    )
    expect(resolved.config.apiKey).toBeUndefined()
    expect(resolved.config.timeoutMs).toBe(30_000)
  })

  it('allows an http localhost judge endpoint', () => {
    const resolved = resolveAutoraterEndpoint({
      [AUTORATER_URL_ENV_VAR]: 'http://127.0.0.1:8080/judge',
    })
    expect(resolved.configured).toBe(true)
  })

  it('trims whitespace around values and carries the optional key', () => {
    const resolved = resolveAutoraterEndpoint({
      [AUTORATER_URL_ENV_VAR]: '  https://judge.example.internal/grade  ',
      [AUTORATER_KEY_ENV_VAR]: ' secret-token ',
    })
    if (!resolved.configured) throw new Error('expected a configured endpoint')
    expect(resolved.config.apiKey).toBe('secret-token')
  })

  it('treats a blank key as absent', () => {
    const resolved = resolveAutoraterEndpoint({
      [AUTORATER_URL_ENV_VAR]: 'https://judge.example.internal/grade',
      [AUTORATER_KEY_ENV_VAR]: '',
    })
    if (!resolved.configured) throw new Error('expected a configured endpoint')
    expect(resolved.config.apiKey).toBeUndefined()
  })

  it('honors a valid timeout override', () => {
    const resolved = resolveAutoraterEndpoint({
      [AUTORATER_URL_ENV_VAR]: 'https://judge.example.internal/grade',
      [AUTORATER_TIMEOUT_ENV_VAR]: '5000',
    })
    if (!resolved.configured) throw new Error('expected a configured endpoint')
    expect(resolved.config.timeoutMs).toBe(5_000)
  })

  it('accepts timeout bounds inclusively', () => {
    for (const raw of ['500', '120000']) {
      const resolved = resolveAutoraterEndpoint({
        [AUTORATER_URL_ENV_VAR]: 'https://judge.example.internal/grade',
        [AUTORATER_TIMEOUT_ENV_VAR]: raw,
      })
      expect(resolved.configured).toBe(true)
    }
  })

  it('rejects invalid timeouts naming the variable', () => {
    for (const raw of ['abc', '0', '-5', '499', '120001']) {
      expect(() =>
        resolveAutoraterEndpoint({
          [AUTORATER_URL_ENV_VAR]: 'https://judge.example.internal/grade',
          [AUTORATER_TIMEOUT_ENV_VAR]: raw,
        }),
      ).toThrow(AUTORATER_TIMEOUT_ENV_VAR)
    }
  })

  it('rejects unparseable URLs without echoing the value', () => {
    let message = ''
    try {
      resolveAutoraterEndpoint({
        [AUTORATER_URL_ENV_VAR]: 'not-an-endpoint-value',
      })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain(AUTORATER_URL_ENV_VAR)
    expect(message).not.toContain('not-an-endpoint-value')
  })

  it('rejects non-http(s) protocols', () => {
    for (const candidate of ['ftp://judge.example.internal', 'file:///judge']) {
      expect(() =>
        resolveAutoraterEndpoint({ [AUTORATER_URL_ENV_VAR]: candidate }),
      ).toThrow(AUTORATER_URL_ENV_VAR)
    }
  })

  it('rejects embedded credentials without echoing them', () => {
    let message = ''
    try {
      resolveAutoraterEndpoint({
        [AUTORATER_URL_ENV_VAR]: 'https://user:hunter2@judge.example.internal',
      })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain(AUTORATER_URL_ENV_VAR)
    expect(message).not.toContain('hunter2')
  })
})
