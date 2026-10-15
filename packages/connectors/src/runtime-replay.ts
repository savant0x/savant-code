/**
 * Replay fetch for the tool-facing runtime (FID-2026-0930-003) — moved here
 * verbatim from runtime.ts for the 300-line ceiling (T106 split discipline).
 *
 * Minimal in-order replay over a loaded fixture chain — request matching
 * mirrors the testing harness (method + url; fixture urls may carry
 * `{{request.url}}`/`{{request.origin}}` placeholders bound from the
 * endpoint's compiled request). Hosts wanting the FULL harness (header
 * allowlist, zod-validated fixture files) use
 * `@savant-code/connectors/testing` instead.
 */

/** The recorded-call shape the runtime replay consumes (structural — the
 *  zod-validated `RecordedCall` is assignable to it). */
export interface RuntimeRecordedCall {
  req: { method?: string; url: string }
  res: { status: number; body: unknown; headers?: Record<string, string> }
}

export function makeReplayFetch(
  source: string,
  fixture: { calls: RuntimeRecordedCall[] },
  requestUrl: string,
): (input: string, init?: RequestInit) => Promise<Response> {
  const bind = (template: string): string =>
    template
      .replace('{{request.url}}', requestUrl)
      .replace('{{request.origin}}', new URL(requestUrl).origin)
  let index = 0
  return (input, init) => {
    const call = fixture.calls[index]
    index += 1
    const method = init?.method ?? 'GET'
    if (!call) {
      return Promise.reject(
        new Error(
          `replay(${source}): no recorded call left for ${method} ${input}`,
        ),
      )
    }
    const expectedUrl = bind(call.req.url)
    const expectedMethod = call.req.method ?? 'GET'
    if (expectedMethod !== method || expectedUrl !== input) {
      return Promise.reject(
        new Error(
          `replay(${source}): call ${index - 1} is ${expectedMethod} ` +
            `${expectedUrl}, run requested ${method} ${input}`,
        ),
      )
    }
    const res = call.res
    // Same serialization as the testing harness's replayFetch: the recorded
    // body is Json — stringify it and serve with the JSON content type
    // (a recorded raw-string body stringifies to a JSON string, which
    // sniffDecode parses right back to the recorded string).
    return Promise.resolve(
      new Response(JSON.stringify(res.body), {
        status: res.status,
        headers: {
          'content-type': 'application/json',
          ...(res.headers ?? {}),
        },
      }),
    )
  }
}
