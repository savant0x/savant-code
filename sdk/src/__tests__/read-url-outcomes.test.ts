import { describe, expect, it } from 'bun:test'

import { readUrl } from '../tools/read-url'
import {
  canonicalUrlKey,
  classifyExtractionMiss,
  classifyHttpStatus,
  createNegativeCache,
} from '../tools/read-url/outcomes'

import type { FetchLike } from '../tools/read-url'

/**
 * FID-2026-1012-018: the read_url outcome taxonomy, URL identity and per-run
 * negative cache — the shapes the fetch path now classifies, the identity used
 * to recognise a repeat, and the guarantee that only run-final outcomes are
 * memoized (a rate limit is advised, never remembered as a dead end).
 */

describe('classifyHttpStatus', () => {
  it('classifies the owned statuses with their next action', () => {
    expect(classifyHttpStatus(404, 'Not Found')).toMatchObject({
      kind: 'not-found',
      firstLine: 'Failed to fetch URL: 404 Not Found',
      cacheable: true,
    })
    expect(classifyHttpStatus(401, 'Unauthorized')).toMatchObject({
      kind: 'unauthorized',
      cacheable: true,
    })
    expect(classifyHttpStatus(403, 'Forbidden')).toMatchObject({
      kind: 'denied',
      cacheable: true,
    })
    expect(classifyHttpStatus(405, 'Method Not Allowed')).toMatchObject({
      kind: 'method-not-allowed',
      firstLine: 'Failed to fetch URL: 405 Method Not Allowed',
      cacheable: true,
    })
  })

  it('keeps transient statuses uncacheable', () => {
    expect(classifyHttpStatus(429, 'Too Many Requests')).toMatchObject({
      kind: 'rate-limited',
      cacheable: false,
    })
    expect(classifyHttpStatus(503, 'Service Unavailable')).toMatchObject({
      kind: 'unavailable',
      cacheable: false,
    })
    expect(classifyHttpStatus(500, 'Internal Server Error')).toMatchObject({
      kind: 'server-error',
      cacheable: false,
    })
  })

  it('points the not-found case at a search instead of a dead end', () => {
    expect(classifyHttpStatus(404, 'Not Found').advice).toContain('web_search')
    expect(classifyHttpStatus(429, 'Too Many Requests').advice).toContain(
      'Rate limited',
    )
  })
})

describe('classifyExtractionMiss', () => {
  it('names the empty-body cause when the response proves it', () => {
    const outcome = classifyExtractionMiss({
      contentType: 'text/html',
      bodyLength: 0,
      textLength: 0,
    })

    expect(outcome.firstLine).toBe('No readable text found at URL')
    expect(outcome.advice).toContain('body was empty')
  })

  it('names the markup-with-no-text cause for an HTML response', () => {
    const outcome = classifyExtractionMiss({
      contentType: 'text/html; charset=utf-8',
      bodyLength: 1_200,
      textLength: 0,
    })

    expect(outcome.advice).toContain('markup with no extractable text')
  })

  it('reports an unproven cause as unclassified rather than guessing', () => {
    const outcome = classifyExtractionMiss({
      contentType: 'application/octet-stream',
      bodyLength: 512,
      textLength: 0,
    })

    expect(outcome.advice).toContain('does not prove the cause')
  })
})

describe('canonicalUrlKey', () => {
  it('removes only the fragment', () => {
    const withFragment = canonicalUrlKey('https://example.com/a/b/#section')
    const without = canonicalUrlKey('https://example.com/a/b/')

    expect(withFragment).toBe(without)
  })

  it('preserves the trailing slash, the port and the full query', () => {
    expect(canonicalUrlKey('https://example.com/docs/')).toBe(
      'https://example.com/docs/',
    )
    expect(canonicalUrlKey('https://example.com/docs')).toBe(
      'https://example.com/docs',
    )
    expect(canonicalUrlKey('https://example.com:8443/a?x=1&sig=abc#frag')).toBe(
      'https://example.com:8443/a?x=1&sig=abc',
    )
  })

  it('never persists credentials', () => {
    expect(canonicalUrlKey('https://user:secret@example.com/page')).toBe(
      'https://example.com/page',
    )
  })

  it('normalizes scheme and host case only', () => {
    expect(canonicalUrlKey('HTTPS://Example.COM/Path')).toBe(
      'https://example.com/Path',
    )
  })
})

describe('negative cache', () => {
  it('memoizes cacheable outcomes and refuses transient ones', () => {
    const cache = createNegativeCache()
    const notFound = classifyHttpStatus(404, 'Not Found')
    const rateLimited = classifyHttpStatus(429, 'Too Many Requests')

    cache.remember('https://example.com/a', notFound)
    cache.remember('https://example.com/b', rateLimited)

    expect(cache.get('https://example.com/a')).toBe(notFound)
    expect(cache.get('https://example.com/b')).toBeUndefined()
    expect(cache.size()).toBe(1)
  })

  it('is bounded so a long run cannot grow it without limit', () => {
    const cache = createNegativeCache(2)

    for (let index = 0; index < 5; index += 1) {
      cache.remember(
        `https://example.com/${index}`,
        classifyHttpStatus(404, 'Not Found'),
      )
    }

    expect(cache.size()).toBe(2)
    expect(cache.get('https://example.com/0')).toBeUndefined()
  })
})

describe('readUrl with the taxonomy', () => {
  it('answers a repeated 404 from the memo instead of fetching again', async () => {
    const cache = createNegativeCache()
    let calls = 0
    const countingFetch: FetchLike = async () => {
      calls += 1
      return new Response('nope', {
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'text/html' },
      })
    }

    const first = await readUrl({
      url: 'https://example.com/missing#top',
      fetch: countingFetch,
      cache,
    })
    const second = await readUrl({
      url: 'https://example.com/missing',
      fetch: countingFetch,
      cache,
    })

    expect(calls).toBe(1)
    for (const result of [first, second]) {
      const value = result[0].value
      if (!('errorMessage' in value)) throw new Error('expected an error')
      expect(value.errorMessage.split('\n')[0]).toBe(
        'Failed to fetch URL: 404 Not Found',
      )
    }
    const secondValue = second[0].value
    if (!('errorMessage' in secondValue)) throw new Error('expected an error')
    expect(secondValue.errorMessage).toContain('already attempted in this run')
    expect(cache.size()).toBe(1)
  })

  it('does not memoize a rate limit and still surfaces the advice', async () => {
    const cache = createNegativeCache()
    let calls = 0
    const fetch429: FetchLike = async () => {
      calls += 1
      return new Response('slow down', {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'content-type': 'text/html' },
      })
    }

    await readUrl({ url: 'https://example.com/hot', fetch: fetch429, cache })
    const second = await readUrl({
      url: 'https://example.com/hot',
      fetch: fetch429,
      cache,
    })

    expect(calls).toBe(2)
    expect(cache.size()).toBe(0)
    const value = second[0].value
    if (!('errorMessage' in value)) throw new Error('expected an error')
    expect(value.errorMessage.split('\n')[0]).toBe(
      'Failed to fetch URL: 429 Too Many Requests',
    )
    expect(value.errorMessage).toContain('Rate limited')
  })

  it('classifies an oversized response with the cap and the next action', async () => {
    const result = await readUrl({
      url: 'https://example.com/huge',
      fetch: async () =>
        new Response('x', {
          status: 200,
          headers: {
            'content-type': 'text/html',
            'content-length': '3000000',
          },
        }),
    })

    const value = result[0].value
    if (!('errorMessage' in value)) throw new Error('expected an error')
    const [firstLine] = value.errorMessage.split('\n')
    expect(firstLine).toMatch(/^Response (is too large|exceeded)/)
    expect(value.errorMessage).toContain('byte cap this reader accepts')
  })

  it('classifies a refused content type with the format guidance', async () => {
    const result = await readUrl({
      url: 'https://example.com/report.pdf',
      fetch: async () =>
        new Response('%PDF-1.7', {
          status: 200,
          headers: { 'content-type': 'application/pdf' },
        }),
    })

    const value = result[0].value
    if (!('errorMessage' in value)) {
      throw new Error('expected the PDF content type to be refused')
    }
    expect(value.errorMessage.split('\n')[0]).toBe(
      'Unsupported content type: application/pdf',
    )
    expect(value.errorMessage).toContain('do not re-fetch the same URL')
  })

  it('reports an empty body as an unextractable response with its cause', async () => {
    const result = await readUrl({
      url: 'https://example.com/empty',
      fetch: async () =>
        new Response('', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    })

    const value = result[0].value
    if (!('errorMessage' in value)) throw new Error('expected an error')
    expect(value.errorMessage.split('\n')[0]).toBe(
      'No readable text found at URL',
    )
    expect(value.errorMessage).toContain('body was empty')
  })
})
