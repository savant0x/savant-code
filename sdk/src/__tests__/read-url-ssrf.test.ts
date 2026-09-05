import { describe, expect, it } from 'bun:test'

import { readUrl } from '../tools/read-url'
import { isBlockedAddress } from '../tools/ssrf'

// FID-2026-0819-005 Loop 205: SSRF-protection suite moved verbatim from
// read-url.test.ts.

describe('readUrl SSRF protection', () => {
  it('classifies private, reserved, and public addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '192.168.0.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      'fc00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
      'not-an-ip',
    ]) {
      expect(isBlockedAddress(ip)).toBe(true)
    }
    for (const ip of ['8.8.8.8', '93.184.216.34', '2606:2800:220:1::1']) {
      expect(isBlockedAddress(ip)).toBe(false)
    }
  })

  it('rejects IP-literal private hosts without fetching', async () => {
    let fetched = false
    const result = await readUrl({
      url: 'http://169.254.169.254/latest/meta-data/',
      fetch: async () => {
        fetched = true
        throw new Error('fetch should not be called')
      },
    })

    expect(fetched).toBe(false)
    expect(result[0].value).toEqual({
      url: 'http://169.254.169.254/latest/meta-data/',
      errorMessage:
        'Refusing to fetch private or reserved address: 169.254.169.254',
    })
  })

  it('rejects hostnames that resolve to a private address', async () => {
    const result = await readUrl({
      url: 'http://intranet.example.com/secrets',
      resolveDns: true,
      lookupHost: async () => ['10.0.0.5'],
      fetch: async () => {
        throw new Error('fetch should not be called')
      },
    })

    expect(result[0].value).toEqual({
      url: 'http://intranet.example.com/secrets',
      errorMessage:
        'Host "intranet.example.com" resolves to a private or reserved address (10.0.0.5)',
    })
  })

  it('allows hostnames that resolve to a public address', async () => {
    const result = await readUrl({
      url: 'https://example.com/page',
      resolveDns: true,
      lookupHost: async () => ['93.184.216.34'],
      fetch: async () =>
        new Response('<main><p>Public content</p></main>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    })
    const value = result[0].value

    expect('errorMessage' in value).toBe(false)
    if ('errorMessage' in value) return
    expect(value.text).toContain('Public content')
  })

  it('blocks a redirect that points at an internal address', async () => {
    const calls: string[] = []
    const result = await readUrl({
      url: 'https://public.example.com/start',
      resolveDns: true,
      lookupHost: async () => ['93.184.216.34'],
      fetch: async (input) => {
        calls.push(String(input))
        return new Response(null, {
          status: 302,
          headers: { location: 'http://169.254.169.254/latest/meta-data/' },
        })
      },
    })

    // First hop fetched and 302'd; redirect target rejected before a 2nd fetch.
    expect(calls).toEqual(['https://public.example.com/start'])
    expect(result[0].value).toEqual({
      url: 'https://public.example.com/start',
      errorMessage:
        'Refusing to fetch private or reserved address: 169.254.169.254',
    })
  })

  it('stops after too many redirects', async () => {
    let calls = 0
    const result = await readUrl({
      url: 'https://example.com/loop',
      resolveDns: true,
      lookupHost: async () => ['93.184.216.34'],
      fetch: async () => {
        calls++
        return new Response(null, {
          status: 302,
          headers: { location: 'https://example.com/loop' },
        })
      },
    })

    // Initial request + 5 redirect follows, then bail out.
    expect(calls).toBe(6)
    expect(result[0].value).toEqual({
      url: 'https://example.com/loop',
      errorMessage: 'Too many redirects (>5)',
    })
  })

  it('rejects a malformed redirect location', async () => {
    const result = await readUrl({
      url: 'https://example.com/start',
      resolveDns: true,
      lookupHost: async () => ['93.184.216.34'],
      fetch: async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'http://' },
        }),
    })

    expect(result[0].value).toEqual({
      url: 'https://example.com/start',
      errorMessage: 'Invalid redirect location: http://',
    })
  })
})
