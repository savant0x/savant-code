// FID-2026-0819-005 Loop 246: GatewayClient's connection lifecycle,
// extracted from gateway-client.ts (hello-first handshake, typed status
// machine, exponential-backoff reconnect). Owns the socket + reconnect
// state; the parent supplies transport configuration and receives state
// transitions through the events seam. Statement bodies are verbatim from
// the parent's private methods.

import {
  GATEWAY_PROTOCOL_VERSION,
  helloRequest,
  helloResultSchema,
  parseInboundFrame,
  replayEventsRequest,
  replayResultSchema,
  type InboundFrame,
  type JsonRpcId,
} from './gateway-protocol'
import { backoffDelayMs } from './gateway-transport'

import type { GatewayConfig } from './gateway-config'
import type { RequestCorrelator } from './gateway-requests'
import type { TransportConnection, TransportFactory } from './gateway-transport'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

export type GatewayStatus =
  'connecting' | 'authenticating' | 'ready' | 'reconnecting' | 'offline'

export type RunCompleteInfo = { ok: boolean; error?: string; runId?: string }

export type RunCompleteFrame = Extract<InboundFrame, { kind: 'runComplete' }>

export class GatewayConnectionController {
  private connection: TransportConnection | null = null
  private config: GatewayConfig | null = null
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private manualClose = false

  constructor(
    private readonly factory: TransportFactory,
    private readonly requestTimeoutMs: number,
    private readonly requests: RequestCorrelator,
    private readonly nextId: () => JsonRpcId,
    private readonly events: {
      setStatus: (status: GatewayStatus) => void
      emitEvents: (events: PrintModeEvent[]) => void
      emitRunComplete: (frame: RunCompleteFrame) => void
      onHello: (
        projectId: string,
        triggersAvailable: boolean,
        providerNotices: boolean,
      ) => void
      onReplayGap: (info: { reason: string }) => void
    },
  ) {
    // FID-2026-1003-002 (D6): the replay cursor — the last event-batch seq
    // this client has applied. Null until the first hello baselines it.
    this.eventCursor = null
    this.replayInFlight = false
  }

  private eventCursor: number | null
  private replayInFlight: boolean

  /** The live socket for request dispatch (null while offline). */
  get activeConnection(): TransportConnection | null {
    return this.connection
  }

  connect(config: GatewayConfig): void {
    this.manualClose = false
    this.reconnectAttempt = 0
    this.config = config
    this.clearReconnectTimer()
    this.openSocket()
  }

  openSocket(): void {
    if (this.config === null) {
      throw new Error('connect(config) must be called before opening a socket')
    }
    this.events.setStatus(
      this.reconnectAttempt === 0 ? 'connecting' : 'reconnecting',
    )
    const url = `ws://127.0.0.1:${this.config.port}/ws`
    this.connection = this.factory(url, {
      onOpen: () => {
        this.events.setStatus('authenticating')
        void this.handshake(this.connection)
      },
      onMessage: (raw: string) => {
        this.handleFrame(raw)
      },
      onClose: () => {
        this.handleDisconnect('socket closed')
      },
      onError: () => {
        // Detail-free by spec; the following close event drives recovery.
      },
    })
  }

  close(): void {
    this.manualClose = true
    this.clearReconnectTimer()
    const connection = this.connection
    this.connection = null
    connection?.close()
    this.requests.rejectAll('gateway closed by client')
    this.events.setStatus('offline')
  }

  private async handshake(socket: TransportConnection | null): Promise<void> {
    if (this.config === null || socket === null) return
    try {
      const result = await this.requests.send(
        socket,
        helloRequest(this.nextId(), this.config.token),
        this.requestTimeoutMs,
      )
      const parsed = helloResultSchema.safeParse(result)
      if (
        !parsed.success ||
        parsed.data.protocolVersion !== GATEWAY_PROTOCOL_VERSION
      ) {
        // Fail-closed: never stream against an unexpected contract version.
        this.connection?.close()
        return
      }
      this.onHello(parsed.data.projectId, parsed.data.capabilities)
      this.trackEventCursor(parsed.data.capabilities, parsed.data.eventSeq)
      this.reconnectAttempt = 0
      this.events.setStatus('ready')
    } catch {
      // Auth rejected (-32001/-32003) or timed out — close drives backoff.
      this.connection?.close()
    }
  }

  private onHello(projectId: string, capabilities: readonly string[]): void {
    // FID-2026-0824-005 step 5: the server's capability list decides the
    // triggers panel's availability (graceful degradation, no probing).
    this.events.onHello(
      projectId,
      capabilities.includes('triggers_list'),
      capabilities.includes('provider_notices_v1'),
    )
  }

  /** FID-2026-1003-002 (D6): maintain the replay cursor across hellos and
   *  fire the reconnect replay when the sidecar is ahead of us. Absent
   *  eventSeq = old sidecar → v1 behavior, no cursor. */
  private trackEventCursor(
    capabilities: readonly string[],
    eventSeq: number | undefined,
  ): void {
    if (eventSeq === undefined) return
    const cursor = this.eventCursor
    if (cursor === null || eventSeq < cursor) {
      // First hello (baseline) or sidecar restart (state is gone):
      // re-baseline — nothing before our existence is owed.
      this.eventCursor = eventSeq
      return
    }
    if (
      eventSeq > cursor &&
      capabilities.includes('replay_events') &&
      !this.replayInFlight
    ) {
      void this.replayMissed()
    }
  }

  /** Recover the batches flushed while disconnected. The response shares
   *  this ordered socket, so it lands before any batch flushed after the
   *  server's snapshot — applying it in order is race-free. */
  private async replayMissed(): Promise<void> {
    const cursor = this.eventCursor
    const socket = this.connection
    if (cursor === null || socket === null) return
    this.replayInFlight = true
    try {
      const result = await this.requests.send(
        socket,
        replayEventsRequest(this.nextId(), cursor),
        this.requestTimeoutMs,
      )
      const parsed = replayResultSchema.safeParse(result)
      if (!parsed.success) {
        this.events.onReplayGap({ reason: 'replay result failed validation' })
        return
      }
      for (const batch of parsed.data.batches) {
        this.events.emitEvents(batch.events)
      }
      this.eventCursor = Math.max(cursor, parsed.data.latestSeq)
      if (parsed.data.gapped) {
        this.events.onReplayGap({
          reason: `disconnect outlasted the replay window (resumed at seq ${String(parsed.data.earliestSeq)})`,
        })
      }
    } catch {
      this.events.onReplayGap({ reason: 'replay request failed' })
    } finally {
      this.replayInFlight = false
    }
  }

  private handleFrame(raw: string): void {
    const outcome = parseInboundFrame(raw)
    if (!outcome.ok) return
    const frame: InboundFrame = outcome.frame
    if (frame.kind === 'events') {
      // FID-2026-1003-002 (D6): every live batch advances the cursor — the
      // seq space counts event frames exactly once per client.
      if (this.eventCursor !== null) this.eventCursor += 1
      this.events.emitEvents(frame.events)
      return
    }
    if (frame.kind === 'runComplete') {
      this.events.emitRunComplete(frame)
      return
    }
    this.requests.applyInbound(frame)
  }

  private handleDisconnect(reason: string): void {
    this.connection = null
    this.requests.rejectAll(`connection lost: ${reason}`)
    if (this.manualClose) {
      this.events.setStatus('offline')
      return
    }
    this.reconnectAttempt += 1
    const delay = backoffDelayMs(this.reconnectAttempt)
    this.events.setStatus('reconnecting')
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.openSocket()
    }, delay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}
