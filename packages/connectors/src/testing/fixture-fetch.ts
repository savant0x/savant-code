
import { pickRecordedHeaders } from './fixture-schema.ts'

import type { Fixture, RecordedCall } from './fixture-schema.ts'
import type { Json } from '../core/mod.ts'

/** port: fetch-like shape — Bun's global fetch type carries `preconnect`,
 *  which these fns never exercise (PORT-NOTES.md). */
export type FetchLike = (
  input: URL | string,
  init?: RequestInit,
) => Promise<Response>

/**
 * Serve recorded calls in order; fail loudly on mismatch or exhaustion.
 * `bindings` substitute `{{key}}` placeholders in recorded urls before
 * compare (e.g. `{{request.url}}` → the endpoint's compiled request url) —
 * how one shared chain serves every endpoint of a provider.
 */
export function replayFetch(
  fixture: Fixture,
  bindings: Record<string, string> = {},
): FetchLike {
  const bind = (template: string): string =>
    template.replace(
      /\{\{([A-Za-z_][\w.-]*)\}\}/g,
      (whole, key: string) => bindings[key] ?? whole,
    )
  let index = 0
  return (
    input: URL | string, // port: RequestInfo unavailable under Bun types (PORT-NOTES.md)
    init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.href
    const method = init?.method ?? 'GET'
    const call = fixture.calls[index]
    if (!call) {
      return Promise.reject(
        new Error(
          `replay(${fixture.name}): no recorded call left for ${method} ${url}`,
        ),
      )
    }
    const expectedUrl = bind(call.req.url)
    if (call.req.method !== method || expectedUrl !== url) {
      return Promise.reject(
        new Error(
          `replay(${fixture.name}): call ${index} expected ${call.req.method} ${expectedUrl}, ` +
            `engine issued ${method} ${url}`,
        ),
      )
    }
    index++
    return Promise.resolve(
      // a recorded 3xx replays WITH its allowlisted headers — the
      // engine's transport is `redirect: "manual"`, so a Response
      // carrying a `location` is exactly what the live exchange was
      new Response(JSON.stringify(call.res.body), {
        status: call.res.status,
        headers: {
          'content-type': 'application/json',
          ...call.res.headers,
        },
      }),
    )
  }
}

/** Wrap a real fetch, capturing {req, res} pairs. REQUEST headers are never
 *  recorded (credentials); RESPONSE headers are captured only on the
 *  RECORDED_RES_HEADERS allowlist — and re-attached to the response relayed
 *  onward, so the recording run and its later replay observe the SAME
 *  exchange (without this, a recorded `location` would be in the fixture but
 *  missing from the live run that produced it). */
export function recordingFetch(
  realFetch: FetchLike,
  sink: RecordedCall[],
): FetchLike {
  return async (
    input: URL | string, // port: RequestInfo unavailable under Bun types (PORT-NOTES.md)
    init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.href
    const method = init?.method ?? 'GET'
    const requestBody =
      typeof init?.body === 'string' ? parseMaybeJson(init.body) : undefined
    const response = await realFetch(input, init)
    const text = await response.text()
    const headers = pickRecordedHeaders(response.headers)
    sink.push({
      req: {
        method,
        url,
        ...(requestBody !== undefined ? { body: requestBody } : {}),
      },
      res: {
        status: response.status,
        ...(headers !== undefined ? { headers } : {}),
        body: parseMaybeJson(text) ?? text,
      },
    })
    return new Response(text, {
      status: response.status,
      headers: {
        'content-type':
          response.headers.get('content-type') ?? 'application/json',
        ...headers,
      },
    })
  }
}

function parseMaybeJson(text: string): Json | undefined {
  try {
    return JSON.parse(text) as Json
  } catch {
    return undefined
  }
}
