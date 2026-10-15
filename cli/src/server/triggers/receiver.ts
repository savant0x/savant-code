// FID-2026-0824-005 — local webhook receiver (step 1).
//
// Loopback-only HTTP listener (Maus pattern: one port above the gateway)
// exposing ONLY /health (open) and /hooks/:triggerId (bearer + replay
// guarded). SECURITY ORDER per the FID's risk #7 mitigation: auth headers
// are validated BEFORE any payload byte is read. The receiver never drives
// the agent itself — it hands a structured TriggerDelivery to the
// onDelivery callback (the injection bridge owns the drive path).

import crypto from 'node:crypto'

import { safeTokenEqual } from '../auth'

import type { TriggerStore } from './trigger-store'

/** Loopback bind is a HARD requirement (C3): relays deliver TO loopback. */
const LOOPBACK_HOST = '127.0.0.1'

/** Replay window for X-Savant-Timestamp (±5 minutes). */
const REPLAY_WINDOW_MS = 5 * 60 * 1000

/** Nonce cache size cap (LRU-ish by insertion; attacks bounded by window). */
const NONCE_CACHE_MAX = 10_000

/** Step 4: per-trigger fixed-window rate limit. Harmless locally, essential
 *  when a relay (Tailscale Funnel / cloudflared) exposes the hook route to
 *  the internet: bounds the delivery/injection path against floods. The
 *  window is derived from the injected clock so tests can drive it. */
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_PER_WINDOW = 5

export const TRIGGER_NONCE_HEADER = 'x-savant-nonce'
export const TRIGGER_TIMESTAMP_HEADER = 'x-savant-timestamp'

export type TriggerDelivery = {
  triggerId: string
  eventId: string
  nonce: string
  /** Sender-provided one-line summary — DATA, never interpolated as prose. */
  summary: string
  /** Arbitrary JSON payload fields — DATA only. */
  fields: Record<string, unknown>
  receivedAt: string
}

/** Only loopback bind targets are representable (C3, enforced at the type
 *  level: a hostile hostname like 0.0.0.0 is not just refused at runtime —
 *  it does not typecheck). */
export type LoopbackHostname = '127.0.0.1' | 'localhost' | '::1'

export type TriggerReceiverOptions = {
  port: number
  /** The gateway's bound port (the +1 offset is applied by the caller —
   *  pass `port: gatewayPort + 1`). Kept for logging/telemetry context. */
  gatewayPort: number
  store: TriggerStore
  hostname?: LoopbackHostname
  /** DI clock (ms). Defaults to Date.now — tests drive the rate-limit
   *  window deterministically through it. Also used for the replay window. */
  clock?: () => number
  onDelivery: (delivery: TriggerDelivery) => Promise<void>
  logger?: {
    info?: (...args: unknown[]) => void
    error?: (...args: unknown[]) => void
  }
}

export type TriggerReceiverHandle = {
  /** "host:port" of the bound listener. */
  bound: string
  stop: () => void
}

export function isLoopbackHostname(
  hostname: string,
): hostname is LoopbackHostname {
  return (
    hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1'
  )
}

export class TriggerReceiver {
  private readonly options: TriggerReceiverOptions
  private nonces = new Set<string>()
  /** Step 4: per-trigger fixed-window buckets — triggerId → { windowStart, count }. */
  private rateBuckets = new Map<
    string,
    { windowStart: number; count: number }
  >()
  private server: ReturnType<typeof Bun.serve> | null = null

  constructor(options: TriggerReceiverOptions) {
    this.options = options
  }

  private nowMs(): number {
    return this.options.clock ? this.options.clock() : Date.now()
  }

  /** Step 4: fixed-window check AFTER auth (auth failures must not be able
   *  to exhaust a bucket) and BEFORE the body read. Returns null when the
   *  request may proceed, else the Retry-After seconds. */
  private rateLimitCheckpoint(triggerId: string): number | null {
    const now = this.nowMs()
    const bucket = this.rateBuckets.get(triggerId)
    if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
      this.rateBuckets.set(triggerId, { windowStart: now, count: 1 })
      return null
    }
    bucket.count += 1
    if (bucket.count > RATE_LIMIT_MAX_PER_WINDOW) {
      const retryAfterSeconds = Math.ceil(
        (bucket.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000,
      )
      return Math.max(1, retryAfterSeconds)
    }
    return null
  }

  private seenNonce(nonce: string): boolean {
    if (this.nonces.has(nonce)) return true
    if (this.nonces.size >= NONCE_CACHE_MAX) this.nonces.clear()
    this.nonces.add(nonce)
    return false
  }

  async start(): Promise<TriggerReceiverHandle> {
    const hostname = this.options.hostname ?? LOOPBACK_HOST
    if (!isLoopbackHostname(hostname)) {
      throw new Error(
        `Trigger receiver must bind loopback only (refused ${hostname}; relays deliver to loopback)`,
      )
    }
    // Port contract mirrors the gateway: 0 = OS-assigned ephemeral. The
    // Maus gatewayPort+1 offset is the CALLER's decision (server-command
    // computes handle.port + 1 explicitly) — deriving it here produced an
    // explicit low port for port:0/gatewayPort:0 test callers, which only
    // binds on some platforms and collides across serial binds.
    const port = this.options.port

    this.server = Bun.serve({
      port,
      hostname,
      fetch: (request) => this.handle(request),
    })

    this.options.logger?.info?.(
      `trigger receiver listening on ${hostname}:${this.server.port}`,
    )
    return {
      bound: `${hostname}:${this.server.port}`,
      stop: () => {
        this.server?.stop(true)
        this.server = null
      },
    }
  }

  private async handle(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const route = `${request.method} ${url.pathname}`

    if (route === 'GET /health') {
      return Response.json({ ok: true, service: 'trigger-receiver' })
    }
    if (!url.pathname.startsWith('/hooks/')) {
      return new Response('not found', { status: 404 })
    }
    if (request.method !== 'POST') {
      return new Response('method not allowed', { status: 405 })
    }

    const triggerId = url.pathname.slice('/hooks/'.length)
    const trigger = this.options.store.list().find((t) => t.id === triggerId)
    if (!trigger) {
      // Unknown trigger id: same response shape as auth failure to avoid
      // leaking which ids exist.
      return new Response('unauthorized', { status: 401 })
    }

    // --- AUTH LAYER (before ANY body read) ---
    const auth = request.headers.get('authorization')
    const provided = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : ''
    const nonce = request.headers.get(TRIGGER_NONCE_HEADER)?.trim() ?? ''
    const timestamp =
      request.headers.get(TRIGGER_TIMESTAMP_HEADER)?.trim() ?? ''
    if (!provided || !nonce || !timestamp) {
      return new Response('unauthorized', { status: 401 })
    }
    // Constant-time verify against the STORED HASH (secret never on disk).
    const providedHash = crypto
      .createHash('sha256')
      .update(provided)
      .digest('hex')
    if (!safeTokenEqual(trigger.secretHash, providedHash)) {
      return new Response('unauthorized', { status: 401 })
    }
    const ts = Number(timestamp)
    if (
      !Number.isFinite(ts) ||
      Math.abs(this.nowMs() - ts) > REPLAY_WINDOW_MS
    ) {
      return new Response('unauthorized', { status: 401 })
    }
    if (this.seenNonce(nonce)) {
      return new Response('replayed nonce', { status: 401 })
    }
    // --- AUTH LAYER END ---

    // Step 4: rate limit after auth, before the body read.
    const retryAfter = this.rateLimitCheckpoint(triggerId)
    if (retryAfter !== null) {
      return new Response('rate limited', {
        status: 429,
        headers: { 'retry-after': String(retryAfter) },
      })
    }

    // --- only now may the body be touched ---

    let payload: {
      eventId?: unknown
      summary?: unknown
      fields?: unknown
    }
    try {
      payload = (await request.json()) as typeof payload
    } catch {
      return new Response('malformed JSON body', { status: 400 })
    }
    const eventId =
      typeof payload.eventId === 'string' && payload.eventId.trim()
        ? payload.eventId.trim()
        : null
    if (!eventId) {
      return new Response('eventId is required', { status: 400 })
    }
    const summary = typeof payload.summary === 'string' ? payload.summary : ''
    const fields =
      payload.fields &&
      typeof payload.fields === 'object' &&
      !Array.isArray(payload.fields)
        ? (payload.fields as Record<string, unknown>)
        : {}

    await this.options.onDelivery({
      triggerId,
      eventId,
      nonce,
      summary,
      fields,
      receivedAt: new Date().toISOString(),
    })
    return Response.json({ ok: true, delivery: 'accepted' }, { status: 202 })
  }
}

export async function startTriggerReceiver(
  options: TriggerReceiverOptions,
): Promise<TriggerReceiverHandle> {
  const receiver = new TriggerReceiver(options)
  return receiver.start()
}
