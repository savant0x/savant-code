// FID-2026-0820-008 — gateway authentication. Bearer token compared in
// constant time (fail-closed on ANY mismatch), plus server-side Origin/Host
// allowlist validation on every WS upgrade. Browser SOP does not cover WebSocket
// handshakes, and WKWebView/WebView2 do not fully implement Private Network
// Access — so DNS-rebinding / cross-site-WebSocket-hijacking protection is
// enforced HERE, server-side, never delegated to the WebView engine.

import crypto from 'crypto'

/** Allowlisted WebView origins (frozen v1; FID-009 owns the registry). */
export const DEFAULT_GATEWAY_ALLOWED_ORIGINS = [
  'tauri://localhost', // macOS / Linux WebView
  'http://tauri.localhost', // Windows WebView2
  // Dev server (Tauri dev URL) — the gateway must accept it in dev so the
  // WebView origin allowlist does not break hot-reload sessions.
  'http://localhost:1420',
  'https://localhost:1420',
] as const

/**
 * Constant-time string comparison via SHA-256 digests. Never leaks length or
 * content via early-exit comparison. Fail-closed: any mismatch (including
 * empty) returns false.
 */
export function safeTokenEqual(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

/** True when the Origin header value (or its absence) is acceptable. */
export function isAllowedOrigin(
  originHeader: string | null,
  allowlist: readonly string[],
): boolean {
  if (!originHeader || originHeader.trim().length === 0) return false
  return allowlist.includes(originHeader.trim())
}

/** True when the Host header points at loopback. DNS-rebinding protection:
 *  a rebinding attacker cannot set Host to 127.0.0.1 with our ephemeral port
 *  unless they already hold the port — which is the point of ephemeral ports. */
export function isAllowedHost(hostHeader: string | null): boolean {
  if (!hostHeader) return false
  const host = hostHeader.trim()
  const [hostname] = host.split(':')
  return (
    hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]'
  )
}
