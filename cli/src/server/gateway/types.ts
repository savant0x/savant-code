// FID-2026-0905-004 — gateway decomposition: shared contracts.
//
// The public gateway API surface (re-exported byte-identically by the
// gateway.ts facade) plus the internal types shared by the stage modules.
// Stage modules import from here — never from the facade.

import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { RunState } from '@savant-code/sdk'

/** Fixed ~50ms event-stream flush interval (token-stream backpressure). */
export const EVENT_FLUSH_INTERVAL_MS = 50

/** The runPrompt seam parameters (structural contract unchanged from the
 *  original inline GatewayOptions.runPrompt shape). */
export type GatewayRunPromptParams = {
  prompt: string
  previousRun?: RunState
  signal: AbortSignal
  onEvent: (event: PrintModeEvent) => void
  onTextChunk: (chunk: string) => void
}

export type GatewayOptions = {
  /** Bearer token required on the hello frame (constant-time compare). */
  token: string
  /** Port to bind. 0 = ephemeral (the bound port is reported via onReady). */
  port?: number
  /** Loopback bind host. Defaults to 127.0.0.1 — never a non-loopback bind. */
  hostname?: string
  /** Origin allowlist (defaults to DEFAULT_GATEWAY_ALLOWED_ORIGINS). */
  allowedOrigins?: readonly string[]
  /** Called once the server is listening with the bound port. */
  onReady?: (info: { port: number }) => void
  /** DI: how a prompt run is executed. Defaults to the SDK client path. */
  runPrompt?: (params: GatewayRunPromptParams) => Promise<RunState>
  /** Root FIDs directory. Defaults to `<cwd>/dev/fids`. */
  fidsDir?: string
  /** DI: persisted scoped-thread reader used by the read-only RPC method. */
  loadScopedThreads?: (params: {
    scopeType: 'project' | 'global'
    scopeId: string
  }) => ScopedThreadRecord[]
  /** DI: persisted thread-state writer used by the workspace rail. */
  updateScopedThreadState?: (params: {
    sessionId: string
    unread?: boolean
    pinned?: boolean
  }) => boolean
  /** Optional logger. */
  logger?: {
    info?: (...args: unknown[]) => void
    error?: (...args: unknown[]) => void
  }
  /** FID-2026-0901-005: DI: the slash-command surface the desktop palette
   *  shows. Defaults to the full CLI registry (data/slash-commands.ts) —
   *  the same list the TUI autocomplete offers. */
  listCommands?: () => GatewayCommandDescriptor[]
  /** FID-2026-0824-005 step 5: DI: trigger management surface for the
   *  desktop rail panel. Undefined = the triggers feature is off (the
   *  methods answer methodNotFound-ish invalidRequest) — the panel
   *  degrades gracefully. */
  triggerManager?: GatewayTriggerManager
}

/** FID-2026-0824-005 step 5: the gateway's view of the trigger store —
 *  sanitized reads (never the secret hash), secret shown exactly once at
 *  create/rotate, fail-closed validation on write. */
export type GatewayTriggerManager = {
  list: () => Array<{
    id: string
    name: string
    createdAt: string
    lastFiredAt?: string
    recurrence?: string
    nextRunAt?: string
    enabled: boolean
  }>
  create: (params: { name: string; recurrence?: string }) => {
    id: string
    name: string
    secret: string
    createdAt: string
  }
  setRecurrence: (triggerId: string, recurrence: string | null) => boolean
  setEnabled: (triggerId: string, enabled: boolean) => boolean
  delete: (triggerId: string) => boolean
}

/** One command in the desktop slash palette (server-provided registry). */
export type GatewayCommandDescriptor = {
  /** Command id without the leading slash ('compact', 'mode:plan'). */
  id: string
  /** One-line description shown in the palette. */
  description: string
  /** 'agent' = dispatched as prompt text through the run path (the runtime
   *  intercepts command-shaped prompts, e.g. /compact); 'client' = handled
   *  entirely by the desktop renderer. */
  dispatch: 'agent' | 'client'
}

export type GatewayHandle = {
  /** The bound port (resolved after onReady fires). */
  port: number
  /** Stop the server and resolve pending approvals fail-closed. */
  stop: () => void
  /** FID-2026-0824-005: drive a synthetic prompt through the SAME run
   *  machinery as user_message (single-session guard, event streaming,
   *  lastRunState continuation). Rejected when a run is in flight. */
  injectTriggerRun: (params: {
    prompt: string
    source: 'trigger'
  }) => Promise<{ accepted: boolean; reason?: string }>
}

/** Internal: fail-closed denial target for a pending approval. */
export type PendingApproval = {
  /** Fail-closed denial target — routes through AskUserBridge.submit so the
   *  halted run settles with a skipped ask_user result recorded in history. */
  deny: () => void
  questions: unknown
}

/** Internal: per-socket hello/auth state. */
export type ConnectionState = {
  authed: boolean
  helloReceived: boolean
}

/** Internal: one persisted scoped thread (read-only projection). */
export type ScopedThreadRecord = {
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
}

/** Internal: the optional structured logger (GatewayOptions['logger']). */
export type GatewayLogger = {
  info?: (...args: unknown[]) => void
  error?: (...args: unknown[]) => void
}
