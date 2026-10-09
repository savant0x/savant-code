// FID-2026-0905-004 — gateway decomposition: per-session state + batching.
//
// The GatewayContext bundle (Loop-2 design): per-session state plus the DI
// seams, created once by the facade and passed to every stage module.
// Mutable run/event fields are touched only by their owning modules
// (run-lifecycle for activeRun/lastRunState; the batching primitives here
// for eventBuffer/flushTimer). denyPendingApprovals is called by BOTH the
// socket-close path and the facade shutdown — it stays here so the
// fail-closed contract has a single owner.

import { aggregateCompliance } from '@savant-code/common/util/telemetry-aggregate'

import { notification } from '../json-rpc'
import { EVENT_FLUSH_INTERVAL_MS } from './types'

import type {
  GatewayCommandDescriptor,
  GatewayLogger,
  GatewayRunPromptParams,
  GatewayTriggerManager,
  PendingApproval,
  ScopedThreadRecord,
  ConnectionState,
} from './types'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { ComplianceAggregates } from '@savant-code/common/util/telemetry-aggregate'
import type { RunState } from '@savant-code/sdk'

/** FID-2026-1003-002 (D6): replay-buffer bound — 1,000 batches ≈ 50 s at
 *  the 50 ms flush tick; beyond it the replay reports `gapped` honestly. */
export const REPLAY_BUFFER_CAP = 1_000

/** FID-2026-1003-002 (D6): one replayable event batch — its position in the
 *  single seq space plus the events exactly as they went out on the wire. */
export type ReplayedBatch = { seq: number; events: PrintModeEvent[] }

/** The per-session state + DI bundle shared by all gateway stage modules. */
export type GatewayContext = {
  /** Frozen-v1 hello bearer token (constant-time compared). */
  token: string
  /** Project id derived from the FIDs directory (two levels up). */
  projectId: string
  /** The command registry served to the desktop palette. */
  commands: GatewayCommandDescriptor[]
  /** Optional structured logger. */
  logger: GatewayLogger | undefined
  /** DI: trigger management (undefined = feature off). */
  triggerManager: GatewayTriggerManager | undefined
  /** DI: how a prompt run is executed. */
  runPrompt: (params: GatewayRunPromptParams) => Promise<RunState>
  /** DI: persisted scoped-thread reader. */
  loadScopedThreads: (params: {
    scopeType: 'project' | 'global'
    scopeId: string
  }) => ScopedThreadRecord[]
  /** DI: persisted thread-state writer. */
  updateScopedThreadState: (params: {
    sessionId: string
    unread?: boolean
    pinned?: boolean
  }) => boolean
  /** FID-2026-1007-012 FID 5 — DI: compliance-aggregates reader. */
  loadTelemetryAggregates: (windowDays: number | 'all') => ComplianceAggregates

  /** Connected sockets (added on open, removed on close). */
  connectedSockets: Set<{
    send: (data: string) => void
    data?: ConnectionState
  }>
  /** Pending approvals keyed by gateway-generated approvalId. A pending
   *  approval SURVIVES a socket disconnect (FID-2026-1002-007: the
   *  reconnecting client re-authenticates and resolves it) and is denied
   *  fail-closed when its owning run settles or at gateway shutdown. */
  pendingApprovals: Map<string, PendingApproval>

  /** Run in flight (single-session v1) — owned by run-lifecycle. */
  activeRun: { abortController: AbortController } | null
  /** Last settled RunState (reconnect continuation) — owned by
   *  run-lifecycle. */
  lastRunState: RunState | null

  /** Event-stream batching buffer — owned by the batching primitives. */
  eventBuffer: PrintModeEvent[]
  flushTimer: ReturnType<typeof setInterval> | null

  /** FID-2026-1003-002 (D6): monotonic event-batch counter — every `event`
   *  frame the gateway emits increments it exactly once. */
  batchSeq: number
  /** FID-2026-1003-002 (D6): bounded replay buffer of recent batches — a
   *  reconnecting client recovers what it missed via replay_events. */
  replayBuffer: ReplayedBatch[]
}

/** Create the per-session context. Only the facade calls this. */
export function createGatewayContext(params: {
  token: string
  projectId: string
  commands: GatewayCommandDescriptor[]
  logger: GatewayLogger | undefined
  triggerManager: GatewayTriggerManager | undefined
  runPrompt: (params: GatewayRunPromptParams) => Promise<RunState>
  loadScopedThreads: (params: {
    scopeType: 'project' | 'global'
    scopeId: string
  }) => ScopedThreadRecord[]
  updateScopedThreadState: (params: {
    sessionId: string
    unread?: boolean
    pinned?: boolean
  }) => boolean
  loadTelemetryAggregates?: (windowDays: number | 'all') => ComplianceAggregates
}): GatewayContext {
  return {
    token: params.token,
    projectId: params.projectId,
    commands: params.commands,
    logger: params.logger,
    triggerManager: params.triggerManager,
    runPrompt: params.runPrompt,
    loadScopedThreads: params.loadScopedThreads,
    updateScopedThreadState: params.updateScopedThreadState,
    loadTelemetryAggregates:
      params.loadTelemetryAggregates ??
      ((windowDays) =>
        aggregateCompliance(
          { records: [], totalLines: 0, skippedLines: 0 },
          { windowDays },
        )),
    connectedSockets: new Set(),
    pendingApprovals: new Map(),
    activeRun: null,
    lastRunState: null,
    eventBuffer: [],
    flushTimer: null,
    batchSeq: 0,
    replayBuffer: [],
  }
}

/** Queue one event into the batching buffer. */
export function pushEvent(ctx: GatewayContext, event: PrintModeEvent): void {
  ctx.eventBuffer.push(event)
}

/** FID-2026-1003-002 (D6): emit one event batch — seq-stamped and appended
 *  to the bounded replay buffer, then sent (frame UNCHANGED: a bare
 *  PrintModeEvent[] array) to every connected socket. Every `event` frame
 *  the gateway emits goes through this primitive — one seq space is what
 *  makes the replay cursor arithmetic exact. */
export function emitEventBatch(
  ctx: GatewayContext,
  events: PrintModeEvent[],
): void {
  if (events.length === 0) return
  const seq = ctx.batchSeq + 1
  ctx.batchSeq = seq
  ctx.replayBuffer.push({ seq, events })
  if (ctx.replayBuffer.length > REPLAY_BUFFER_CAP) ctx.replayBuffer.shift()
  for (const socket of ctx.connectedSockets) {
    if (socket.data && !socket.data.authed) continue
    const visible = socket.data?.providerNotices
      ? events
      : events.filter((e) => e.type !== 'provider_notice')
    const frame = JSON.stringify(notification('event', visible))
    try {
      socket.send(frame)
    } catch (error) {
      ctx.logger?.error?.(error, 'gateway: event send failed')
    }
  }
}

/** Flush buffered events to every connected, authenticated socket. The
 *  frame is a single JSON-RPC notification (`method: 'event'`) carrying the
 *  batch as params — one clean JSON-RPC frame per flush tick, so FID-009's
 *  Rust supervisor parses standard JSON-RPC 2.0, never a bare array.
 *  FID-2026-1002-007 (D5): the timer self-stops once the buffer is empty
 *  (idle sessions stop ticking; `pushEvent` re-arms).
 *  FID-2026-1003-002 (D6): the batch is seq-stamped and buffered for
 *  replay before it goes on the wire. */
export function flushEvents(ctx: GatewayContext): void {
  if (ctx.eventBuffer.length === 0) {
    selfStopFlushTimer(ctx)
    return
  }
  const batch = ctx.eventBuffer
  ctx.eventBuffer = []
  selfStopFlushTimer(ctx)
  emitEventBatch(ctx, batch)
}

/** Start the flush interval if not already running. */
export function ensureFlushTimer(ctx: GatewayContext): void {
  if (ctx.flushTimer) return
  ctx.flushTimer = setInterval(() => flushEvents(ctx), EVENT_FLUSH_INTERVAL_MS)
}

/**
 * FID-2026-1002-007 (D5): the timer self-stops when the buffer drains —
 * an idle session must not wake every 50 ms forever. The next `pushEvent`
 * re-arms it via `ensureFlushTimer`, so the batching contract (one frame
 * per flush tick) is unchanged.
 */
function selfStopFlushTimer(ctx: GatewayContext): void {
  if (!ctx.flushTimer) return
  clearInterval(ctx.flushTimer)
  ctx.flushTimer = null
}

/** Deny every pending approval FAIL-CLOSED (deny + recorded in history as a
 *  skipped ask_user tool result). FID-2026-1002-007 (D4): called when the
 *  owning run settles (run-lifecycle finally) and at gateway shutdown —
 *  NOT on socket close (a pending approval survives a disconnect; the
 *  reconnecting client re-authenticates and resolves it). */
export function denyPendingApprovals(ctx: GatewayContext): void {
  for (const [, approval] of ctx.pendingApprovals) {
    approval.deny()
  }
  ctx.pendingApprovals.clear()
}
