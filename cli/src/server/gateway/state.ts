// FID-2026-0905-004 — gateway decomposition: per-session state + batching.
//
// The GatewayContext bundle (Loop-2 design): per-session state plus the DI
// seams, created once by the facade and passed to every stage module.
// Mutable run/event fields are touched only by their owning modules
// (run-lifecycle for activeRun/lastRunState; the batching primitives here
// for eventBuffer/flushTimer). denyPendingApprovals is called by BOTH the
// socket-close path and the facade shutdown — it stays here so the
// fail-closed contract has a single owner.

import { notification } from '../json-rpc'
import { EVENT_FLUSH_INTERVAL_MS } from './types'

import type {
  GatewayCommandDescriptor,
  GatewayLogger,
  GatewayRunPromptParams,
  GatewayTriggerManager,
  PendingApproval,
  ScopedThreadRecord,
} from './types'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { RunState } from '@savant-code/sdk'

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

  /** Connected sockets (added on open, removed on close). */
  connectedSockets: Set<{ send: (data: string) => void }>
  /** Pending approvals keyed by gateway-generated approvalId; survive
   *  socket disconnects, resolved fail-closed on close/shutdown. */
  pendingApprovals: Map<string, PendingApproval>

  /** Run in flight (single-session v1) — owned by run-lifecycle. */
  activeRun: { abortController: AbortController } | null
  /** Last settled RunState (reconnect continuation) — owned by
   *  run-lifecycle. */
  lastRunState: RunState | null

  /** Event-stream batching buffer — owned by the batching primitives. */
  eventBuffer: PrintModeEvent[]
  flushTimer: ReturnType<typeof setInterval> | null
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
    connectedSockets: new Set(),
    pendingApprovals: new Map(),
    activeRun: null,
    lastRunState: null,
    eventBuffer: [],
    flushTimer: null,
  }
}

/** Queue one event into the batching buffer. */
export function pushEvent(ctx: GatewayContext, event: PrintModeEvent): void {
  ctx.eventBuffer.push(event)
}

/** Flush buffered events to every connected, authenticated socket. The
 *  frame is a single JSON-RPC notification (`method: 'event'`) carrying the
 *  batch as params — one clean JSON-RPC frame per flush tick, so FID-009's
 *  Rust supervisor parses standard JSON-RPC 2.0, never a bare array. */
export function flushEvents(ctx: GatewayContext): void {
  if (ctx.eventBuffer.length === 0) return
  const batch = ctx.eventBuffer
  ctx.eventBuffer = []
  const frame = JSON.stringify(notification('event', batch))
  for (const socket of ctx.connectedSockets) {
    try {
      socket.send(frame)
    } catch (error) {
      ctx.logger?.error?.(error, 'gateway: event flush send failed')
    }
  }
}

/** Start the flush interval if not already running. */
export function ensureFlushTimer(ctx: GatewayContext): void {
  if (ctx.flushTimer) return
  ctx.flushTimer = setInterval(() => flushEvents(ctx), EVENT_FLUSH_INTERVAL_MS)
}

/** Deny every pending approval FAIL-CLOSED (deny + recorded in history as a
 *  skipped ask_user tool result). Called on socket close AND on shutdown. */
export function denyPendingApprovals(ctx: GatewayContext): void {
  for (const [, approval] of ctx.pendingApprovals) {
    approval.deny()
  }
  ctx.pendingApprovals.clear()
}
