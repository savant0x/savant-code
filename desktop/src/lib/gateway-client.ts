// FID-2026-0820-010 Loop 3 — WebSocket transport state machine for the
// desktop session gateway (FID-2026-0820-008 contract): hello-first
// handshake, typed status machine, exponential-backoff reconnect. The raw
// socket sits behind the TransportFactory seam (./gateway-transport) and the
// request lifecycle behind ./gateway-requests — tests substitute fakes
// (dependency injection, never module mocks).

import {
  GATEWAY_ERROR_CODES,
  GATEWAY_PROTOCOL_VERSION,
  approvalResponseRequest,
  scopedThreadsRequest,
  scopedThreadsResultSchema,
  updateScopedThreadStateRequest,
  updateScopedThreadStateResultSchema,
  helloRequest,
  helloResultSchema,
  interruptRequest,
  parseInboundFrame,
  userMessageRequest,
  type InboundFrame,
  type JsonRpcId,
  type JsonRpcRequest,
  type WorkspaceScopeType,
} from './gateway-protocol'
import { GatewayRequestError, RequestCorrelator } from './gateway-requests'
import {
  backoffDelayMs,
  browserTransportFactory,
  type TransportConnection,
  type TransportFactory,
} from './gateway-transport'
import { ListenerSet } from './listener-set'

import type { GatewayConfig } from './gateway-config'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

// Public surface re-exported for consumers (and the drift-tested API used by
// the transport suites).
export { backoffDelayMs, browserTransportFactory } from './gateway-transport'
export { GatewayRequestError } from './gateway-requests'
export type {
  TransportConnection,
  TransportFactory,
  TransportHandlers,
} from './gateway-transport'

export type GatewayStatus =
  'connecting' | 'authenticating' | 'ready' | 'reconnecting' | 'offline'

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000

export type RunCompleteInfo = { ok: boolean; error?: string; runId?: string }

export class GatewayClient {
  private readonly factory: TransportFactory
  private readonly requestTimeoutMs: number
  private connection: TransportConnection | null = null
  private config: GatewayConfig | null = null
  private statusValue: GatewayStatus = 'offline'
  private readonly statusListeners = new ListenerSet<GatewayStatus>()
  private readonly eventListeners = new ListenerSet<PrintModeEvent[]>()
  private readonly runCompleteListeners = new ListenerSet<RunCompleteInfo>()
  private readonly requests = new RequestCorrelator()
  private nextRequestId = 1
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private manualClose = false
  private projectIdValue: string | null = null

  constructor(opts?: {
    factory?: TransportFactory
    requestTimeoutMs?: number
  }) {
    this.factory = opts?.factory ?? browserTransportFactory
    this.requestTimeoutMs = opts?.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
  }

  getStatus(): GatewayStatus {
    return this.statusValue
  }

  getProjectId(): string | null {
    return this.projectIdValue
  }

  onStatus(listener: (s: GatewayStatus) => void): () => void {
    return this.statusListeners.add(listener)
  }

  onEvents(listener: (events: PrintModeEvent[]) => void): () => void {
    return this.eventListeners.add(listener)
  }

  onRunComplete(listener: (info: RunCompleteInfo) => void): () => void {
    return this.runCompleteListeners.add(listener)
  }

  connect(config: GatewayConfig): void {
    this.manualClose = false
    this.reconnectAttempt = 0
    this.config = config
    this.clearReconnectTimer()
    this.openSocket()
  }

  close(): void {
    this.manualClose = true
    this.clearReconnectTimer()
    const connection = this.connection
    this.connection = null
    connection?.close()
    this.requests.rejectAll('gateway closed by client')
    this.setStatus('offline')
  }

  async sendUserMessage(
    prompt: string,
    opts?: { continueId?: string },
  ): Promise<void> {
    await this.dispatch(userMessageRequest(this.nextId(), prompt, opts))
  }

  async getScopedThreads(
    scopeType: WorkspaceScopeType,
    scopeId: string,
  ): Promise<{
    scopeType: WorkspaceScopeType
    scopeId: string
    threads: Array<{
      sessionId: string
      chatId: string
      agentId: string
      unread: boolean
      pinned: boolean
      messages: Array<{
        id: string
        role: string
        content: string
        createdAt: string
      }>
    }>
  }> {
    const result = await this.dispatch(
      scopedThreadsRequest(this.nextId(), scopeType, scopeId),
    )
    return scopedThreadsResultSchema.parse(result)
  }

  async updateScopedThreadState(
    sessionId: string,
    state: { unread?: boolean; pinned?: boolean },
  ): Promise<{ updated: boolean }> {
    const result = await this.dispatch(
      updateScopedThreadStateRequest(this.nextId(), sessionId, state),
    )
    return updateScopedThreadStateResultSchema.parse(result)
  }

  async respondApproval(
    approvalId: string,
    answers: Array<Record<string, unknown>>,
    skipped: boolean,
  ): Promise<void> {
    await this.dispatch(
      approvalResponseRequest(this.nextId(), approvalId, answers, skipped),
    )
  }

  async interrupt(): Promise<void> {
    await this.dispatch(interruptRequest(this.nextId()))
  }

  private nextId(): JsonRpcId {
    const id = this.nextRequestId
    this.nextRequestId += 1
    return id
  }

  private async dispatch(frame: JsonRpcRequest): Promise<unknown> {
    const connection = this.connection
    if (connection === null || this.statusValue !== 'ready') {
      throw new GatewayRequestError(
        GATEWAY_ERROR_CODES.invalidRequest,
        `gateway not ready (status: ${this.statusValue})`,
      )
    }
    return this.requests.send(connection, frame, this.requestTimeoutMs)
  }

  private openSocket(): void {
    if (this.config === null) {
      throw new Error('connect(config) must be called before opening a socket')
    }
    this.setStatus(this.reconnectAttempt === 0 ? 'connecting' : 'reconnecting')
    const url = `ws://127.0.0.1:${this.config.port}/ws`
    this.connection = this.factory(url, {
      onOpen: () => {
        this.setStatus('authenticating')
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
      this.projectIdValue = parsed.data.projectId
      this.reconnectAttempt = 0
      this.setStatus('ready')
    } catch {
      // Auth rejected (-32001/-32003) or timed out — close drives backoff.
      this.connection?.close()
    }
  }

  private handleFrame(raw: string): void {
    const outcome = parseInboundFrame(raw)
    if (!outcome.ok) return
    const frame: InboundFrame = outcome.frame
    if (frame.kind === 'events') {
      this.eventListeners.emit(frame.events)
      return
    }
    if (frame.kind === 'runComplete') {
      this.runCompleteListeners.emit(frame)
      return
    }
    this.requests.applyInbound(frame)
  }

  private handleDisconnect(reason: string): void {
    this.connection = null
    this.requests.rejectAll(`connection lost: ${reason}`)
    if (this.manualClose) {
      this.setStatus('offline')
      return
    }
    this.reconnectAttempt += 1
    const delay = backoffDelayMs(this.reconnectAttempt)
    this.setStatus('reconnecting')
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

  private setStatus(status: GatewayStatus): void {
    this.statusValue = status
    this.statusListeners.emit(status)
  }
}
