/**
 * FID-2026-0914-003 — endpoint probes (Stage B).
 *
 * Read-only vendor-surface introspection — the feed cannot supply model
 * lists (modelsPublic true on only 12/214 records, audit A4), so ground
 * truth is ours. No key material is ever sent, stored, or required.
 *
 * The authentication-boundary check (audit A8): an unauthenticated dummy
 * POST /chat/completions MUST return 401/403 from a legitimate provider.
 * Positive controls validated live on 2026-09-14: api.groq.com,
 * api.cerebras.ai, api.mistral.ai all returned 401. A 2xx means the
 * endpoint generates text for anyone — the open-relay class measured in
 * arXiv 2604.08407 — and the candidate is rejected.
 */

export type BoundaryVerdict =
  'boundary-ok' | 'open-relay-reject' | 'boundary-unverifiable'

export function classifyUnauthBoundary(status: number | null): BoundaryVerdict {
  if (status === null) return 'boundary-unverifiable'
  if (status >= 200 && status < 300) return 'open-relay-reject'
  if (status === 401 || status === 403) return 'boundary-ok'
  return 'boundary-unverifiable'
}

export type ProbeResult = {
  reachable: boolean
  modelsCount: number
  modelsShapeOk: boolean
  latencyMs: number | null
  boundary: BoundaryVerdict
  boundaryHttpStatus: number | null
  error: string | null
}

const TIMEOUT_MS = 10_000
const UA =
  'SavantCode-DiscoveryBot/1.0 (+https://github.com/savant-code/savant-code)'

/**
 * Probe one endpoint base URL (e.g. `https://api.host.ai/v1`). `fetchImpl`
 * is injectable for tests; production uses global fetch with a hard timeout.
 */
export async function probeEndpoint({
  baseUrl,
  fetchImpl = fetch,
}: {
  baseUrl: string
  fetchImpl?: typeof fetch
}): Promise<ProbeResult> {
  const base = baseUrl.replace(/\/+$/, '')
  const error = (message: string): ProbeResult => ({
    reachable: false,
    modelsCount: 0,
    modelsShapeOk: false,
    latencyMs: null,
    boundary: 'boundary-unverifiable',
    boundaryHttpStatus: null,
    error: message,
  })

  // 1. Model-list introspection (read-only GET).
  let modelsCount = 0
  let modelsShapeOk = false
  let latencyMs: number | null = null
  try {
    const started = Date.now()
    const response = await fetchImpl(
      `${base}/v1/models`.replace(/v1\/v1$/, 'v1'),
      {
        method: 'GET',
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    )
    latencyMs = Date.now() - started
    if (response.ok) {
      const body: unknown = await response.json().catch(() => null)
      if (
        typeof body === 'object' &&
        body !== null &&
        Array.isArray((body as { data?: unknown }).data)
      ) {
        const rows = (body as { data: unknown[] }).data
        modelsShapeOk = rows.every(
          (row) =>
            typeof row === 'object' &&
            row !== null &&
            typeof (row as { id?: unknown }).id === 'string',
        )
        modelsCount = rows.length
      }
    }
  } catch (err) {
    return error(
      `models probe failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  // 2. Authentication-boundary check (unauthenticated dummy generation).
  // POST with MANUAL redirect handling: fetch rewrites POST→GET on 301/302,
  // so auto-followed redirects degrade the probe into a GET — every relay
  // fronted by an apex→www redirect measured boundary-unverifiable
  // (LIVE-caught 2026-09-15 on orcarouter.ai). Re-issue the POST at each
  // Location (method + body intact, 3-hop bound); relative Locations
  // resolve against the current URL. Hop exhaustion = unverifiable, not a
  // verdict.
  const boundaryBody = JSON.stringify({
    model: 'probe-dummy',
    messages: [{ role: 'user', content: 'ping' }],
    max_tokens: 1,
  })
  let boundaryStatus: number | null = null
  try {
    let current = `${base}/v1/chat/completions`.replace(/v1\/v1$/, 'v1')
    for (let hop = 0; hop < 3; hop++) {
      const response = await fetchImpl(current, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/json' },
        body: boundaryBody,
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      const location = response.headers.get('location')
      if (
        response.status >= 300 &&
        response.status < 400 &&
        typeof location === 'string' &&
        location.length > 0
      ) {
        current = new URL(location, current).toString()
        continue
      }
      boundaryStatus = response.status
      // Drain the body so the socket is released (never read into memory).
      await response.arrayBuffer().catch(() => undefined)
      break
    }
    if (boundaryStatus === null) {
      return {
        reachable: modelsCount > 0,
        modelsCount,
        modelsShapeOk,
        latencyMs,
        boundary: 'boundary-unverifiable' as const,
        boundaryHttpStatus: null,
        error: 'boundary probe failed: redirect hop bound exceeded',
      }
    }
  } catch (err) {
    return {
      reachable: modelsCount > 0,
      modelsCount,
      modelsShapeOk,
      latencyMs,
      boundary: 'boundary-unverifiable' as const,
      boundaryHttpStatus: null,
      error: `boundary probe failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  return {
    reachable: modelsCount > 0 || boundaryStatus !== null,
    modelsCount,
    modelsShapeOk,
    latencyMs,
    boundary: classifyUnauthBoundary(boundaryStatus),
    boundaryHttpStatus: boundaryStatus,
    error: null,
  }
}
