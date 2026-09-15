/**
 * FID-2026-0915-002 (split 4) — boundary/probe pins, moved verbatim from
 * harvest-core.test.ts (the `classifyUnauthBoundary (401-boundary gate)`
 * describe).
 */
import { describe, expect, test } from 'bun:test'

import { classifyUnauthBoundary, probeEndpoint } from '../lib/probe-endpoint'

describe('classifyUnauthBoundary (401-boundary gate)', () => {
  test('401/403 = boundary-ok (the A8 positive controls)', () => {
    expect(classifyUnauthBoundary(401)).toBe('boundary-ok')
    expect(classifyUnauthBoundary(403)).toBe('boundary-ok')
  })

  test('any 2xx = open-relay-reject (the LLMjacking class)', () => {
    expect(classifyUnauthBoundary(200)).toBe('open-relay-reject')
    expect(classifyUnauthBoundary(204)).toBe('open-relay-reject')
  })

  test('404/5xx/network-null = boundary-unverifiable (flagged, not rejected)', () => {
    expect(classifyUnauthBoundary(404)).toBe('boundary-unverifiable')
    expect(classifyUnauthBoundary(500)).toBe('boundary-unverifiable')
    expect(classifyUnauthBoundary(null)).toBe('boundary-unverifiable')
  })

  test('probeEndpoint maps fetch outcomes through the same verdicts (injected fetch)', async () => {
    const ok = await probeEndpoint({
      baseUrl: 'https://api.example-free.ai',
      fetchImpl: (async (url: string, init?: RequestInit) => {
        if (String(url).endsWith('/v1/models')) {
          return new Response(JSON.stringify({ data: [{ id: 'm1' }] }), {
            status: 200,
          })
        }
        return new Response(null, { status: 401 }) // chat/completions dummy
      }) as typeof fetch,
    })
    expect(ok.modelsCount).toBe(1)
    expect(ok.boundary).toBe('boundary-ok')

    const open = await probeEndpoint({
      baseUrl: 'https://open.relay.example',
      fetchImpl: (async () =>
        new Response('ok', { status: 200 })) as typeof fetch,
    })
    expect(open.boundary).toBe('open-relay-reject')

    const dead = await probeEndpoint({
      baseUrl: 'https://dead.example',
      fetchImpl: (async () => {
        throw new TypeError('fetch failed')
      }) as typeof fetch,
    })
    expect(dead.boundary).toBe('boundary-unverifiable')
    expect(dead.modelsCount).toBe(0)
  })

  test('boundary POST survives an apex→www 301 (re-POST: method AND body intact)', async () => {
    // LIVE-caught defect (2026-09-15, orcarouter.ai): fetch rewrites POST→GET
    // on 301/302, so auto-followed redirects turned the boundary probe into a
    // GET — every relay fronted by an apex→www redirect was misclassified
    // boundary-unverifiable. The probe must re-issue the POST itself.
    const calls: Array<{ url: string; method: string; body: unknown }> = []
    const result = await probeEndpoint({
      baseUrl: 'https://orcarouter.example',
      fetchImpl: (async (url: string, init?: RequestInit) => {
        const u = String(url)
        if (u.endsWith('/v1/models')) {
          return new Response(JSON.stringify({ data: [{ id: 'm1' }] }), {
            status: 200,
          })
        }
        calls.push({ url: u, method: init?.method ?? 'GET', body: init?.body })
        if (u === 'https://orcarouter.example/v1/chat/completions') {
          // First hop: the apex→www redirect (fetch would degrade to GET here).
          return new Response(null, {
            status: 301,
            headers: {
              Location: 'https://www.orcarouter.example/v1/chat/completions',
            },
          })
        }
        return new Response(null, { status: 401 }) // the real boundary answer
      }) as typeof fetch,
    })
    expect(result.boundary).toBe('boundary-ok')
    expect(calls.length).toBe(2)
    expect(calls[0]!.method).toBe('POST')
    expect(calls[1]!.url).toBe(
      'https://www.orcarouter.example/v1/chat/completions',
    )
    // The whole point: the re-issued request is still a POST WITH a body.
    expect(calls[1]!.method).toBe('POST')
    expect(typeof calls[1]!.body).toBe('string')
  })

  test('relative redirect Locations resolve against the current URL; hop bound is graceful', async () => {
    const result = await probeEndpoint({
      baseUrl: 'https://relay.example',
      fetchImpl: (async (url: string) => {
        const u = String(url)
        if (u.endsWith('/v1/models')) {
          return new Response(JSON.stringify({ data: [] }), { status: 200 })
        }
        if (u === 'https://relay.example/v1/chat/completions') {
          return new Response(null, {
            status: 302,
            headers: { Location: '/v1/chat/completions' },
          })
        }
        // Always redirect again → hop bound must trip, not loop forever.
        return new Response(null, {
          status: 302,
          headers: { Location: '/v1/chat/completions' },
        })
      }) as typeof fetch,
    })
    // Hop exhaustion is a measurement failure, not a crash: unverifiable.
    expect(result.boundary).toBe('boundary-unverifiable')
  })
})
