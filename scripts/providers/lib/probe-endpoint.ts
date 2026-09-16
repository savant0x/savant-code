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

// ---------------------------------------------------------------------------
// FID-2026-0916-001 — probe target trust boundary (MQ4): the probe target set
// is defined by policy, not by whatever a hostile feed says. Feed- and
// seed-derived URLs must be https AND public (static checks + a resolving
// DNS check); loopback/private/link-local/integer-host forms are rejected
// before any socket is opened. The Stage-E health path passes
// `allowPrivate: true` — those URLs are operator-stamped custom providers,
// an explicit trust act (a local Ollama custom must stay health-checkable).
// ---------------------------------------------------------------------------

/**
 * True iff `address` is a loopback/private/link-local/reserved IP (or a
 * conservatively-private non-canonical form: integer, hex, or octal-encoded
 * hosts). Handles IPv4 dotted-decimal, IPv6 literals (incl. v4-mapped), and
 * drops IPv6 zone ids.
 */
export function isPrivateAddress(address: string): boolean {
  const ip = address.trim().toLowerCase().replace(/%.*$/, '')
  if (ip.startsWith('::ffff:') && ip.includes('.')) {
    return isPrivateAddress(ip.slice('::ffff:'.length))
  }
  if (ip.includes(':')) {
    // IPv6 literal — conservative classification.
    if (ip === '::' || ip === '::1') return true
    const first = ip.split(':')[0] ?? ''
    if (/^f[cd]/.test(first)) return true // fc00::/7 unique-local
    if (/^fe[89ab]/.test(first)) return true // fe80::/10 link-local
    return false
  }
  // IPv4-shaped: only plain dotted-decimal is precisely classifiable.
  // Hostname forms (api.example.ai) and non-canonical integer/hex/octal
  // hosts are NOT classified here — hostname safety is isPublicProbeUrl's
  // job (static literals + the resolving DNS check).
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  const octets: number[] = []
  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return false
    const n = Number(part)
    if (n > 255) return false
    octets.push(n)
  }
  const [a, b] = octets as [number, number, number, number]
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

/**
 * Static (pre-DNS) check: may this URL be probed at all? Only https URLs
 * with a public, non-reserved hostname pass.
 */
export function isPublicProbeUrl(rawUrl: string): {
  ok: boolean
  reason: string
} {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { ok: false, reason: 'unparseable URL' }
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: `scheme ${parsed.protocol} is not https` }
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host.length === 0) return { ok: false, reason: 'empty host' }
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return { ok: false, reason: `reserved host ${host}` }
  }
  if (isPrivateAddress(host)) {
    return { ok: false, reason: `host ${host} is not a public address` }
  }
  // Non-canonical IPv4 host forms (decimal-integer, hex, octal-dotted)
  // are rejected outright — they can encode loopback/private addresses
  // opaquely (e.g. 2130706433 == 127.0.0.1), and several resolvers
  // happily normalize them.
  if (
    /^\d+$/.test(host) ||
    /^0x[0-9a-f]+$/.test(host) ||
    (/^0\d{1,3}(\.0\d{1,3}){0,3}$/.test(host) && host !== '0.0.0.0')
  ) {
    return { ok: false, reason: `non-canonical host form "${host}"` }
  }
  return { ok: true, reason: '' }
}

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
