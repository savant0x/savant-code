// FID-2026-0916-001 MQ4 static probe-target guards — moved verbatim from
// probe-endpoint.ts under the 300-line ceiling (FID-2026-0913-002 split
// discipline: move-only, re-exported from the original path, zero consumer
// churn). Pure functions; no imports.
//
// Trust-boundary context: the probe target set is defined by policy, not by
// whatever a hostile feed says. Feed- and seed-derived URLs must be https AND
// public (these static checks + a resolving DNS check in probeEndpoint);
// loopback/private/link-local/integer-host forms are rejected before any
// socket is opened. The Stage-E health path passes `allowPrivate: true` —
// those URLs are operator-stamped custom providers, an explicit trust act
// (a local Ollama custom must stay health-checkable).

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
