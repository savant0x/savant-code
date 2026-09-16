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
import { lookup } from 'node:dns/promises'

import { isPrivateAddress, isPublicProbeUrl } from './probe-url-guard'

// ---------------------------------------------------------------------------
// FID-2026-0916-001 — probe target trust boundary (MQ4). The static guard
// functions (isPrivateAddress / isPublicProbeUrl) live in ./probe-url-guard
// (300-line ceiling split, FID-2026-0913-002 discipline); re-exported here so
// every `./probe-endpoint` import path stays stable.
// ---------------------------------------------------------------------------

export { isPrivateAddress, isPublicProbeUrl } from './probe-url-guard'

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
  allowPrivate = false,
  lookupImpl = lookup,
  fetchImpl = fetch,
}: {
  baseUrl: string
  /** Stage-E operator-stamped targets only (MQ4) — skips the guard. */
  allowPrivate?: boolean
  /** Injectable resolver (DI per repo convention; production: node:dns). */
  lookupImpl?: typeof lookup
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

  // 0. Trust boundary (MQ4) — before any socket is opened: static checks
  // (https + public non-reserved host), then a resolving DNS check so a
  // public-looking hostname that resolves into a private range is also
  // caught. Fail-closed: an unresolvable host is not probeable.
  if (!allowPrivate) {
    const staticCheck = isPublicProbeUrl(base)
    if (!staticCheck.ok) {
      return error(`blocked: not a public probe target (${staticCheck.reason})`)
    }
    let hostname: string
    try {
      hostname = new URL(base).hostname.toLowerCase().replace(/^\[|\]$/g, '')
    } catch {
      return error('blocked: not a public probe target (unparseable URL)')
    }
    try {
      const resolved = await lookupImpl(hostname, { all: true, verbatim: true })
      if (
        resolved.length === 0 ||
        resolved.some((address) => isPrivateAddress(address.address))
      ) {
        return error(
          'blocked: not a public probe target (resolved address is private or the host does not resolve)',
        )
      }
    } catch (err) {
      return error(
        `blocked: DNS resolution failed for probe target (${err instanceof Error ? err.message : String(err)})`,
      )
    }
  }

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
