// Gateway client: typed requests over injected transport and connection controllers.

import {
  GatewayConnectionController,
  type GatewayStatus,
  type RunCompleteFrame,
  type RunCompleteInfo,
} from './gateway-client-connection'
import {
  getScopedThreadsVia,
  getTelemetryAggregatesVia,
  interruptVia,
  listCommandsVia,
  respondApprovalVia,
  sendUserMessageVia,
  triggersCreateVia,
  triggersDeleteVia,
  triggersListVia,
  triggersSetEnabledVia,
  triggersSetRecurrenceVia,
  updateScopedThreadStateVia,
  type GatewayRequestContext,
} from './gateway-client-requests'
import { GATEWAY_ERROR_CODES } from './gateway-protocol'
import { GatewayProviderNotifications } from './gateway-provider-notifications'
import { GatewayRequestError, RequestCorrelator } from './gateway-requests'
import {
  browserTransportFactory,
  type TransportFactory,
} from './gateway-transport'
import { ListenerSet } from './listener-set'

import type { GatewayConfig } from './gateway-config'
import type {
  CreatedTriggerInfo,
  JsonRpcId,
  JsonRpcRequest,
  TriggerRecord,
  WorkspaceScopeType,
} from './gateway-protocol'
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
export type {
  GatewayStatus,
  RunCompleteInfo,
} from './gateway-client-connection'

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000

export class GatewayClient {
  readonly providerNotices: GatewayProviderNotifications
  private readonly factory: TransportFactory
  private readonly requestTimeoutMs: number
  private readonly requests = new RequestCorrelator()
  private statusValue: GatewayStatus = 'offline'
  private readonly statusListeners = new ListenerSet<GatewayStatus>()
  private readonly eventListeners = new ListenerSet<PrintModeEvent[]>()
  private readonly runCompleteListeners = new ListenerSet<RunCompleteInfo>()
  private readonly replayGapListeners = new ListenerSet<{
    reason: string
  }>()
  private nextRequestId = 1
  private projectIdValue: string | null = null
  private triggersAvailableValue = false
  /** P35: set by connect(); reset by close(). Gates connectOnce(). */
  private connectStarted = false
  /** Loop 246: the connection lifecycle (socket, handshake, reconnect). */
  private readonly connection: GatewayConnectionController
  /** Loop 246: the public context the extracted request functions bind to. */
  private readonly requestCtx: GatewayRequestContext

  constructor(opts?: {
    factory?: TransportFactory
    requestTimeoutMs?: number
  }) {
    this.factory = opts?.factory ?? browserTransportFactory
    this.requestTimeoutMs = opts?.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    this.connection = new GatewayConnectionController(
      this.factory,
      this.requestTimeoutMs,
      this.requests,
      () => this.nextId(),
      {
        setStatus: (status) => this.setStatus(status),
        emitEvents: (events) => this.eventListeners.emit(events),
        emitRunComplete: (frame: RunCompleteFrame) => {
          this.runCompleteListeners.emit(frame)
        },
        onHello: (projectId, triggersAvailable, providerNotices) => {
          this.providerNotices.enabled = providerNotices
          this.projectIdValue = projectId
          // FID-2026-0824-005 step 5: the server's capability list decides the
          // triggers panel's availability (graceful degradation, no probing).
          this.triggersAvailableValue = triggersAvailable
        },
        onReplayGap: (info) => {
          this.replayGapListeners.emit(info)
        },
      },
    )
    this.requestCtx = {
      dispatch: async (frame) => this.dispatch(frame),
      nextId: () => this.nextId(),
    }
    this.providerNotices = new GatewayProviderNotifications(this.requestCtx)
  }

  getStatus(): GatewayStatus {
    return this.statusValue
  }

  getProjectId(): string | null {
    return this.projectIdValue
  }

  /** FID-2026-0824-005 step 5: whether the server advertised trigger
   *  management (SAVANT_TRIGGERS=1) in its hello capabilities. */
  getTriggersAvailable(): boolean {
    return this.triggersAvailableValue
  }

  getTelemetryAggregates(
    window: '7d' | '30d' | 'all' = '7d',
  ): ReturnType<typeof getTelemetryAggregatesVia> {
    return getTelemetryAggregatesVia(this.requestCtx, window)
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

  /** FID-2026-1003-002 (D6): the reconnect replay could not recover
   *  everything (the disconnect outlasted the replay window) or failed —
   *  the renderer can surface this. */
  onReplayGap(listener: (info: { reason: string }) => void): () => void {
    return this.replayGapListeners.add(listener)
  }

  connect(config: GatewayConfig): void {
    this.connectStarted = true
    this.connection.connect(config)
  }

  /**
   * P35 (operator: "Project FIDs shows 0 open" while the boot batch provably
   * flows): the boot connect was gated by a module-level flag in use-gateway,
   * which is fragile across HMR module generations — a remount could render
   * the full UI while the shared client sat `offline` forever, silently
   * missing the gateway's hello-time FID inventory batch (254 events on this
   * repo). connectOnce() moves the idempotence onto the client instance
   * itself: every effect run / HMR remount may call it; only the first call
   * on a given instance opens a socket. close() resets the gate so an
   * explicit teardown can reconnect.
   */
  connectOnce(config: GatewayConfig): void {
    if (this.connectStarted) return
    this.connect(config)
  }

  close(): void {
    this.connectStarted = false
    this.connection.close()
  }

  async sendUserMessage(
    prompt: string,
    opts?: { continueId?: string },
  ): Promise<void> {
    await sendUserMessageVia(this.requestCtx, prompt, opts)
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
    return getScopedThreadsVia(this.requestCtx, scopeType, scopeId)
  }

  async updateScopedThreadState(
    sessionId: string,
    state: { unread?: boolean; pinned?: boolean },
  ): Promise<{ updated: boolean }> {
    return updateScopedThreadStateVia(this.requestCtx, sessionId, state)
  }

  /** FID-2026-0901-005: the server-side slash-command registry — the full
   *  CLI command surface with honest dispatch classes. */
  async listCommands(): Promise<
    Array<{ id: string; description: string; dispatch: 'agent' | 'client' }>
  > {
    return listCommandsVia(this.requestCtx)
  }

  // --- FID-2026-0824-005 step 5: trigger management (rail panel) ----------

  /** Sanitized trigger list (never the secret or its hash). */
  async triggersList(): Promise<TriggerRecord[]> {
    return triggersListVia(this.requestCtx)
  }

  /** Create a trigger. The response carries the plaintext secret EXACTLY
   *  once — the server persists only its hash. */
  async triggersCreate(params: {
    name: string
    recurrence?: string
  }): Promise<CreatedTriggerInfo> {
    return triggersCreateVia(this.requestCtx, params)
  }

  /** Set (or null-clear) the cron recurrence. */
  async triggersSetRecurrence(
    triggerId: string,
    recurrence: string | null,
  ): Promise<{ updated: boolean }> {
    return triggersSetRecurrenceVia(this.requestCtx, triggerId, recurrence)
  }

  /** Enable/disable (disable pauses scheduled fires). */
  async triggersSetEnabled(
    triggerId: string,
    enabled: boolean,
  ): Promise<{ updated: boolean }> {
    return triggersSetEnabledVia(this.requestCtx, triggerId, enabled)
  }

  /** Delete a trigger. */
  async triggersDelete(triggerId: string): Promise<{ deleted: boolean }> {
    return triggersDeleteVia(this.requestCtx, triggerId)
  }

  async respondApproval(
    approvalId: string,
    answers: Array<Record<string, unknown>>,
    skipped: boolean,
  ): Promise<void> {
    await respondApprovalVia(this.requestCtx, approvalId, answers, skipped)
  }

  async interrupt(): Promise<void> {
    await interruptVia(this.requestCtx)
  }

  private nextId(): JsonRpcId {
    const id = this.nextRequestId
    this.nextRequestId += 1
    return id
  }

  private async dispatch(frame: JsonRpcRequest): Promise<unknown> {
    const connection = this.connection.activeConnection
    if (connection === null || this.statusValue !== 'ready') {
      throw new GatewayRequestError(
        GATEWAY_ERROR_CODES.invalidRequest,
        `gateway not ready (status: ${this.statusValue})`,
      )
    }
    return this.requests.send(connection, frame, this.requestTimeoutMs)
  }

  private setStatus(status: GatewayStatus): void {
    this.statusValue = status
    this.statusListeners.emit(status)
  }
}
