// FID-2026-0820-008 — Desktop Session Gateway (Phase 1, shell-agnostic).
//
// A Bun-hosted localhost WebSocket server exposing the agent runtime as
// JSON-RPC 2.0 with structured event streaming. The frozen v1 handshake
// contract lives in ./json-rpc.ts (FID-009's Rust supervisor programs against
// it); auth + Origin/Host validation live in ./auth.ts.
//
// Design invariants (from the FID):
//   - Bind loopback only; ephemeral port via CLI arg (not secret).
//   - Bearer token on the hello frame, constant-time compare, fail-closed.
//   - Origin/Host allowlist enforced SERVER-SIDE at the WS upgrade (browser
//     SOP does not cover WS handshakes; WKWebView/WebView2 do not fully
//     implement Private Network Access).
//   - ONE agent session per process (single-session frozen v1). A second
//     user_message while a run is in flight → -32004 sessionBusy.
//   - Event stream: every PrintModeEvent + text chunk is buffered and flushed
//     on a fixed ~50ms interval (token-stream backpressure), not per-token.
//   - Approval lifecycle: ask_user tool calls surface as approval_request
//     events and HALT the run until approval_response resolves them; pending
//     approvals survive a socket disconnect/reconnect (in-process state-sync);
//     gateway shutdown resolves them FAIL-CLOSED (deny + recorded in history
//     via the normal skipped-ask_user tool result).
//   - Reconnect recovery (v1 scope): the gateway keeps the last settled
//     RunState in memory and accepts a client-supplied previousRun / continueId
//     (existing session-restore machinery reuse). Live full-resync over the
//     wire is explicitly OUT of v1 scope.
//
// The run itself is driven through the existing SDK client (headless-run.ts
// precedent) — the agent-runtime step loop wrapped as JSON-RPC handlers, with
// sdk-event-handlers.ts's PrintModeEvent family as the serialization
// reference (Law 13: one event vocabulary, extended only where genuinely new).

import { randomUUID } from 'node:crypto'
import { basename, join } from 'node:path'

import { readProtocolConfig } from '@savant-code/common/util/protocol-config'
import { AskUserBridge } from '@savant-code/common/utils/ask-user-bridge'
import {
  getMessagesBySessionId,
  getSessionsByScope,
  updateSessionPinned,
  updateSessionUnread,
} from '@savant-code/database/service'

import {
  DEFAULT_GATEWAY_ALLOWED_ORIGINS,
  isAllowedHost,
  isAllowedOrigin,
  safeTokenEqual,
} from './auth'
import {
  failure,
  GATEWAY_CAPABILITIES,
  GATEWAY_ERROR_CODES,
  GATEWAY_PROTOCOL_VERSION,
  isJsonRpcMessage,
  notification,
  success,
} from './json-rpc'
import { SLASH_COMMANDS } from '../data/slash-commands'
import {
  applySavantCodeModelOverride,
  resolveAgent,
} from '../hooks/helpers/send-message-agent'
import { getProjectRoot } from '../project-files'
import { loadFidInventory } from '../utils/fid-loader'
import { startFidWatcher } from '../utils/fid-watcher'
import { loadAgentDefinitions } from '../utils/local-agent-registry'
import { fetchGatewayModels } from '../utils/openrouter-models'
import { resolveContextWindowForModel } from '../utils/openrouter-models/lookup'
import { loadMostRecentChatState } from '../utils/run-state-storage'
import { getSavantCodeClient } from '../utils/savant-code-client'

import type { AskUserResponse } from '@savant-code/common/tools/params/tool/ask-user'
import type {
  PrintModeEvent,
  PrintModeFidQueueUpdate,
} from '@savant-code/common/types/print-mode'
import type { RunState } from '@savant-code/sdk'

/** Fixed ~50ms event-stream flush interval (token-stream backpressure). */
export const EVENT_FLUSH_INTERVAL_MS = 50

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
  runPrompt?: (params: {
    prompt: string
    previousRun?: RunState
    signal: AbortSignal
    onEvent: (event: PrintModeEvent) => void
    onTextChunk: (chunk: string) => void
  }) => Promise<RunState>
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
}

type PendingApproval = {
  /** Fail-closed denial target — routes through AskUserBridge.submit so the
   *  halted run settles with a skipped ask_user result recorded in history. */
  deny: () => void
  questions: unknown
}

type ConnectionState = {
  authed: boolean
  helloReceived: boolean
}

/** Deny every pending approval FAIL-CLOSED (deny + recorded in history as a
 *  skipped ask_user tool result). Called on socket close AND on shutdown. */
function denyPendingApprovals(pending: Map<string, PendingApproval>): void {
  for (const [, approval] of pending) {
    approval.deny()
  }
  pending.clear()
}

/** Default run path: the SDK client (existing step loop + event mapping). */
async function defaultRunPrompt(params: {
  prompt: string
  previousRun?: RunState
  signal: AbortSignal
  onEvent: (event: PrintModeEvent) => void
  onTextChunk: (chunk: string) => void
}): Promise<RunState> {
  const client = await getSavantCodeClient({ headless: false })
  if (!client) {
    throw new Error(
      'Failed to initialize the SDK client. Set a provider key or run the login flow first.',
    )
  }
  const agentDefinitions = loadAgentDefinitions()
  // P18 (operator: compaction fired non-stop + the desktop ran the wrong
  // model/window): the CLI resolves the effective agent through
  // `applySavantCodeModelOverride` — the UI model store is the single
  // source of truth for the effective model (FID-2026-0814-004 H-08/H-09).
  // The gateway skipped that override, so the bundled HYBRID default model
  // (and ITS catalog context window) drove the run — a wrong, too-low
  // auto-compact threshold made the pruner compact every turn. Mirror the
  // CLI exactly: override first, THEN resolve the window from the override's
  // own model (send-message-run-config.ts:107-155 parity).
  const resolvedAgentRaw = resolveAgent('HYBRID', undefined, agentDefinitions)
  const agent = applySavantCodeModelOverride(resolvedAgentRaw, agentDefinitions)
  // FID-2026-0901-006: desktop/CLI parity — the CLI threads `contextWindow`
  // (resolved from the model catalog) and `compression` (from
  // protocol.config.yaml, which sets microCompact:false) into client.run. The
  // gateway previously passed neither, so the runtime defaulted
  // microCompactEnabled:true and micro-compacted EVERY step/turn — a behavior
  // the CLI never exhibits. Resolve the same values here so the desktop
  // session compacts exactly like the terminal.
  const resolvedAgent =
    typeof agent === 'string'
      ? agentDefinitions.find((def) => def.id === agent)
      : agent
  const modelId = resolvedAgent?.model
  const contextWindow = modelId
    ? resolveContextWindowForModel(modelId)
    : undefined
  const compression = readProtocolConfig(
    getProjectRoot() ?? process.cwd(),
  ).compression
  // P19 (operator: "the deck does not even show the model"): seed the model
  // on run-accept so the desktop header badge + deck tag render the model
  // immediately — before the first thinking activity event arrives (which
  // now carries the model too; both paths agree, belt-and-suspenders). The
  // override-resolved agent's model IS the run's effective model. Root-level
  // only (no agentId), so the desktop's root-activity reducer accepts it.
  if (typeof modelId === 'string' && modelId.length > 0) {
    params.onEvent({
      type: 'activity',
      activity: { kind: 'thinking', startedAt: Date.now(), model: modelId },
    })
  }
  return client.run({
    agent,
    prompt: params.prompt,
    previousRun: params.previousRun,
    signal: params.signal,
    permissionMode: 'safe',
    protocolVariant: 'harness',
    devMode: false,
    agentDefinitions,
    contextWindow,
    compression,
    handleEvent: (event) => params.onEvent(event),
    handleStreamChunk: (chunk) => {
      if (typeof chunk === 'string') {
        params.onTextChunk(chunk)
      }
    },
  })
}

function defaultUpdateScopedThreadState(params: {
  sessionId: string
  unread?: boolean
  pinned?: boolean
}): boolean {
  let changed = false
  if (params.unread !== undefined) {
    changed = updateSessionUnread(params.sessionId, params.unread) || changed
  }
  if (params.pinned !== undefined) {
    changed = updateSessionPinned(params.sessionId, params.pinned) || changed
  }
  return changed
}

/**
 * FID-2026-0901-005: the server-side command surface — the FULL CLI slash
 * registry (the same one the TUI autocomplete shows). Commands whose handlers
 * are TUI-local (pickers, overlays that need a terminal) are marked 'client'
 * so the desktop can show them honestly or skip them; everything else
 * dispatches as prompt text through the run path, where the runtime's
 * command-shaped-prompt interception (e.g. /compact) makes it real.
 */
const TUI_ONLY_COMMAND_IDS = new Set([
  // Pure-TUI overlays: they open pickers/menus that cannot exist in a
  // renderer and have no prompt-shaped fallback.
  'review',
  'rewind',
  'history',
  'permissions',
  'diagnostics',
  'teacher',
  'contribute',
  'design',
  'design-authoring',
  'auto-drive',
  'fid',
  'graph',
])

function defaultListCommands(): GatewayCommandDescriptor[] {
  return SLASH_COMMANDS.map((command) => ({
    id: command.id,
    description: command.description,
    dispatch: TUI_ONLY_COMMAND_IDS.has(command.id) ? 'client' : 'agent',
  }))
}

/** Serve the registry to the desktop palette. */
function handleListCommands(
  send: (data: string) => void,
  id: number | string,
  commands: GatewayCommandDescriptor[],
): void {
  send(JSON.stringify(success(id, { commands })))
}

type ScopedThreadRecord = {
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

function defaultLoadScopedThreads(params: {
  scopeType: 'project' | 'global'
  scopeId: string
}): ScopedThreadRecord[] {
  const sessions = getSessionsByScope(params.scopeType, params.scopeId)
    .slice()
    .reverse()
  return sessions.map((session) => ({
    sessionId: session.id,
    chatId: session.chat_id,
    agentId: session.agent_id,
    unread: session.unread,
    pinned: session.pinned,
    messages: getMessagesBySessionId(session.id).map((message) => ({
      id: message.id,
      role: message.role,
      content:
        typeof message.content === 'string'
          ? message.content
          : JSON.stringify(message.content),
      createdAt: message.created_at,
    })),
  }))
}

/**
 * Start the session gateway. Binds loopback, validates Origin/Host at the WS
 * upgrade, then enforces the frozen hello handshake (protocolVersion + bearer
 * token) before any other JSON-RPC method is accepted.
 */
export async function startGateway(
  options: GatewayOptions,
): Promise<GatewayHandle> {
  const {
    token,
    port = 0,
    hostname = '127.0.0.1',
    allowedOrigins = DEFAULT_GATEWAY_ALLOWED_ORIGINS,
    onReady,
    runPrompt = defaultRunPrompt,
    fidsDir = join(process.cwd(), 'dev', 'fids'),
    loadScopedThreads = defaultLoadScopedThreads,
    updateScopedThreadState = defaultUpdateScopedThreadState,
    listCommands = defaultListCommands,
  } = options
  const logger = options.logger
  // P19 (operator: "the window is x/200k, which is clearly a hardcoded value"):
  // the interactive CLI warms the live model catalog at boot (index.tsx), but
  // the gateway sidecar never did — so the sidecar's
  // resolveContextWindowForModel always fell through to the 200k heuristic and
  // the desktop context meter/pruner thresholds diverged from the terminal.
  // Fire-and-forget warm: the run path resolves the window AFTER this catalog
  // has had a chance to populate; the disk warm-start cache (FID-2026-0815-007
  // F-09) covers the cold-boot window. Never derails startup on failure.
  void fetchGatewayModels().catch(() => {})
  // FID-2026-0901-005: the command registry served to the desktop palette.
  const commands = listCommands()

  // Per-session state. Single-session v1: one active run at a time; pending
  // approvals are keyed by a gateway-generated approvalId (the bridge's
  // toolCallId is a constant — never unique) and survive socket disconnects.
  const pendingApprovals = new Map<string, PendingApproval>()
  let activeRun: { abortController: AbortController } | null = null
  let lastRunState: RunState | null = null
  // Event-stream batching buffer (token-stream backpressure).
  let eventBuffer: PrintModeEvent[] = []
  let flushTimer: ReturnType<typeof setInterval> | null = null
  const connectedSockets = new Set<{ send: (data: string) => void }>()
  const fidStatuses = new Map<
    string,
    {
      projectId: string
      parentId?: string
      status: PrintModeFidQueueUpdate['status']
    }
  >()
  const projectId = basename(join(fidsDir, '..', '..')) || 'current-project'

  function collectFidUpdates(): PrintModeFidQueueUpdate[] {
    const inventory = loadFidInventory(fidsDir)
    const updates: PrintModeFidQueueUpdate[] = []
    for (const fid of [...inventory.active, ...inventory.archived]) {
      const status = fid.status as PrintModeFidQueueUpdate['status']
      if (
        ![
          'created',
          'analyzed',
          'fixed',
          'verified',
          'converged',
          'closed',
        ].includes(status)
      )
        continue
      updates.push({
        type: 'fid_update',
        fidId: fid.id,
        projectId,
        ...(fid.parentId !== undefined ? { parentId: fid.parentId } : {}),
        status,
      })
    }
    return updates
  }

  function emitFidChanges(): void {
    const next = new Map<
      string,
      {
        projectId: string
        parentId?: string
        status: PrintModeFidQueueUpdate['status']
      }
    >()
    const updates = collectFidUpdates()
    for (const update of updates)
      next.set(update.fidId, {
        projectId: update.projectId,
        ...(update.parentId !== undefined ? { parentId: update.parentId } : {}),
        status: update.status,
      })
    const changed = updates.filter((update) => {
      const previous = fidStatuses.get(update.fidId)
      return (
        previous?.projectId !== update.projectId ||
        previous?.parentId !== update.parentId ||
        previous?.status !== update.status
      )
    })
    for (const id of fidStatuses.keys()) {
      if (!next.has(id)) {
        const previous = fidStatuses.get(id)
        changed.push({
          type: 'fid_update',
          fidId: id,
          projectId: previous?.projectId ?? projectId,
          ...(previous?.parentId !== undefined
            ? { parentId: previous.parentId }
            : {}),
          status: 'closed',
        })
      }
    }
    fidStatuses.clear()
    for (const [id, value] of next) fidStatuses.set(id, value)
    if (changed.length === 0) return
    const frame = JSON.stringify(notification('event', changed))
    for (const socket of connectedSockets) {
      try {
        socket.send(frame)
      } catch (error) {
        logger?.error?.(error, 'gateway: FID update send failed')
      }
    }
  }

  function pushEvent(event: PrintModeEvent): void {
    eventBuffer.push(event)
  }

  /** Flush buffered events to every connected, authenticated socket. The
   *  frame is a single JSON-RPC notification (`method: 'event'`) carrying the
   *  batch as params — one clean JSON-RPC frame per flush tick, so FID-009's
   *  Rust supervisor parses standard JSON-RPC 2.0, never a bare array. */
  function flushEvents(): void {
    if (eventBuffer.length === 0) return
    const batch = eventBuffer
    eventBuffer = []
    const frame = JSON.stringify(notification('event', batch))
    for (const socket of connectedSockets) {
      try {
        socket.send(frame)
      } catch (error) {
        logger?.error?.(error, 'gateway: event flush send failed')
      }
    }
  }

  function ensureFlushTimer(): void {
    if (flushTimer) return
    flushTimer = setInterval(flushEvents, EVENT_FLUSH_INTERVAL_MS)
  }

  /**
   * Authenticate the hello frame. Fail-closed: mismatched protocolVersion →
   * -32003 (never silently downgraded); missing/bad token → -32001. The reply
   * carries the frozen capability list.
   */
  function handleHello(
    send: (data: string) => void,
    id: number | string,
    params: unknown,
  ): boolean {
    const record = (params ?? {}) as Record<string, unknown>
    if (record.protocolVersion !== GATEWAY_PROTOCOL_VERSION) {
      send(
        JSON.stringify(
          failure(
            id,
            GATEWAY_ERROR_CODES.unsupportedProtocolVersion,
            'Unsupported protocol version',
          ),
        ),
      )
      return false
    }
    const providedToken = typeof record.token === 'string' ? record.token : ''
    if (!safeTokenEqual(providedToken, token)) {
      send(
        JSON.stringify(
          failure(
            id,
            GATEWAY_ERROR_CODES.unauthorized,
            'Unauthorized: bad or missing bearer token',
          ),
        ),
      )
      return false
    }
    send(
      JSON.stringify(
        success(id, {
          protocolVersion: GATEWAY_PROTOCOL_VERSION,
          capabilities: GATEWAY_CAPABILITIES,
          projectId,
        }),
      ),
    )
    setTimeout(() => {
      const updates = collectFidUpdates()
      if (updates.length > 0) {
        send(JSON.stringify(notification('event', updates)))
      }
    }, 0)
    return true
  }

  /** Execute a user_message: single-session guard, then run and stream. */
  async function handleUserMessage(
    send: (data: string) => void,
    id: number | string,
    params: unknown,
  ): Promise<void> {
    if (activeRun) {
      send(
        JSON.stringify(
          failure(
            id,
            GATEWAY_ERROR_CODES.sessionBusy,
            'Session busy: a run is already in flight',
          ),
        ),
      )
      return
    }

    const record = (params ?? {}) as Record<string, unknown>
    const prompt = typeof record.prompt === 'string' ? record.prompt : ''
    if (!prompt.trim()) {
      send(
        JSON.stringify(
          failure(
            id,
            GATEWAY_ERROR_CODES.invalidRequest,
            'user_message requires a non-empty prompt',
          ),
        ),
      )
      return
    }

    // Reconnect recovery (v1 scope): a client-supplied previousRun wins;
    // otherwise a continueId resolves through the existing session-restore
    // machinery; otherwise the in-process last settled RunState is reused.
    let previousRun: RunState | undefined
    if (record.previousRun && typeof record.previousRun === 'object') {
      previousRun = record.previousRun as RunState
    } else if (
      typeof record.continueId === 'string' &&
      record.continueId.trim()
    ) {
      const saved = loadMostRecentChatState(record.continueId.trim())
      previousRun = saved?.runState ?? undefined
    } else if (lastRunState) {
      previousRun = lastRunState
    }

    const abortController = new AbortController()
    activeRun = { abortController }
    send(JSON.stringify(success(id, { accepted: true })))

    try {
      const finalState = await runPrompt({
        prompt,
        previousRun,
        signal: abortController.signal,
        onEvent: (event) => {
          pushEvent(event)
          ensureFlushTimer()
        },
        onTextChunk: (chunk) => {
          // TokenStreamEvent → printModeText (design-doc Table 1 mapping).
          pushEvent({ type: 'text', text: chunk })
          ensureFlushTimer()
        },
      })
      lastRunState = finalState
      send(
        JSON.stringify(
          notification('run_complete', {
            ok: true,
            runId: finalState.traceSessionId ?? randomUUID(),
          }),
        ),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      send(
        JSON.stringify(
          notification('run_complete', { ok: false, error: message }),
        ),
      )
    } finally {
      activeRun = null
    }
  }

  /** Resolve a pending approval (approval_response method). */
  function handleApprovalResponse(
    send: (data: string) => void,
    id: number | string,
    params: unknown,
  ): void {
    const record = (params ?? {}) as Record<string, unknown>
    const approvalId =
      typeof record.approvalId === 'string' ? record.approvalId : ''
    const pending = approvalId ? pendingApprovals.get(approvalId) : undefined
    if (!pending) {
      send(
        JSON.stringify(
          failure(id, GATEWAY_ERROR_CODES.invalidRequest, 'Unknown approvalId'),
        ),
      )
      return
    }
    const response = record.response as AskUserResponse | undefined
    // Resolve the halted ask_user through the bridge — recorded in history as
    // the tool result, exactly like a TUI answer.
    AskUserBridge.submit({
      answers: response?.answers ?? [],
      skipped: response?.skipped === true,
    })
    pendingApprovals.delete(approvalId)
    send(JSON.stringify(success(id, { resolved: true })))
  }

  /** Interrupt the in-flight run (interrupt_stream method). */
  function handleInterruptStream(
    send: (data: string) => void,
    id: number | string,
  ): void {
    if (!activeRun) {
      send(
        JSON.stringify(
          failure(id, GATEWAY_ERROR_CODES.invalidRequest, 'No run in flight'),
        ),
      )
      return
    }
    activeRun.abortController.abort(
      new Error('Interrupted by interrupt_stream'),
    )
    send(JSON.stringify(success(id, { interrupting: true })))
  }

  /** Accept an update_setting (v1: capability listed, no-op persistence). */
  function handleUpdateSetting(
    send: (data: string) => void,
    id: number | string,
  ): void {
    send(JSON.stringify(success(id, { accepted: true })))
  }

  /** Read persisted messages for one workspace scope without exposing DB rows. */
  function handleGetScopedThreads(
    send: (data: string) => void,
    id: number | string,
    params: unknown,
  ): void {
    const record = (params ?? {}) as Record<string, unknown>
    const scopeType = record.scopeType
    const scopeId = typeof record.scopeId === 'string' ? record.scopeId : ''
    if (
      (scopeType !== 'project' && scopeType !== 'global') ||
      scopeId.trim().length === 0
    ) {
      send(
        JSON.stringify(
          failure(
            id,
            GATEWAY_ERROR_CODES.invalidRequest,
            'get_scoped_threads requires scopeType and scopeId',
          ),
        ),
      )
      return
    }

    try {
      const threads = loadScopedThreads({ scopeType, scopeId })
      send(JSON.stringify(success(id, { scopeType, scopeId, threads })))
    } catch (error) {
      logger?.error?.(error, 'gateway: scoped thread read failed')
      send(
        JSON.stringify(
          failure(
            id,
            GATEWAY_ERROR_CODES.internalError,
            'Failed to load scoped threads',
          ),
        ),
      )
    }
  }

  function handleUpdateScopedThreadState(
    send: (data: string) => void,
    id: number | string,
    params: unknown,
  ): void {
    const record = (params ?? {}) as Record<string, unknown>
    const sessionId =
      typeof record.sessionId === 'string' ? record.sessionId.trim() : ''
    const unread =
      typeof record.unread === 'boolean' ? record.unread : undefined
    const pinned =
      typeof record.pinned === 'boolean' ? record.pinned : undefined
    if (!sessionId || (unread === undefined && pinned === undefined)) {
      send(
        JSON.stringify(
          failure(
            id,
            GATEWAY_ERROR_CODES.invalidRequest,
            'update_scoped_thread_state requires sessionId and a state field',
          ),
        ),
      )
      return
    }
    try {
      const updated = updateScopedThreadState({ sessionId, unread, pinned })
      send(JSON.stringify(success(id, { updated })))
    } catch (error) {
      logger?.error?.(error, 'gateway: scoped thread state update failed')
      send(
        JSON.stringify(
          failure(
            id,
            GATEWAY_ERROR_CODES.internalError,
            'Failed to update scoped thread state',
          ),
        ),
      )
    }
  }

  /** Dispatch one inbound JSON-RPC frame. */
  function dispatch(
    send: (data: string) => void,
    message: unknown,
    state: ConnectionState,
  ): void {
    if (!isJsonRpcMessage(message)) {
      send(
        JSON.stringify(
          failure(
            null,
            GATEWAY_ERROR_CODES.invalidRequest,
            'Invalid JSON-RPC frame',
          ),
        ),
      )
      return
    }
    const { method, params } = message
    const id = 'id' in message ? message.id : undefined

    // Frozen v1: hello must be the first frame after the WS upgrade.
    if (!state.helloReceived) {
      if (method !== 'hello' || id === undefined) {
        send(
          JSON.stringify(
            failure(
              id === undefined ? null : id,
              GATEWAY_ERROR_CODES.invalidRequest,
              'hello (protocolVersion + token) must be the first frame',
            ),
          ),
        )
        return
      }
      state.helloReceived = true
      state.authed = handleHello(send, id, params)
      return
    }

    if (!state.authed) {
      send(
        JSON.stringify(
          failure(
            id ?? null,
            GATEWAY_ERROR_CODES.unauthorized,
            'Not authenticated',
          ),
        ),
      )
      return
    }

    // The gateway is request/response (no server-side notifications inbound);
    // a frame without an id is a protocol violation.
    if (id === undefined) {
      send(
        JSON.stringify(
          failure(
            null,
            GATEWAY_ERROR_CODES.invalidRequest,
            'Requests require an id',
          ),
        ),
      )
      return
    }

    switch (method) {
      case 'user_message':
        void handleUserMessage(send, id, params)
        break
      case 'approval_response':
        handleApprovalResponse(send, id, params)
        break
      case 'interrupt_stream':
        handleInterruptStream(send, id)
        break
      case 'update_setting':
        handleUpdateSetting(send, id)
        break
      case 'get_scoped_threads':
        handleGetScopedThreads(send, id, params)
        break
      case 'update_scoped_thread_state':
        handleUpdateScopedThreadState(send, id, params)
        break
      case 'list_commands':
        handleListCommands(send, id, commands)
        break
      default:
        send(
          JSON.stringify(
            failure(
              id,
              GATEWAY_ERROR_CODES.methodNotFound,
              `Method not found: ${method}`,
            ),
          ),
        )
    }
  }

  // Bridge the agent runtime's ask_user tool to the WS approval lifecycle.
  // AskUserBridge is single-pending; the gateway is the only subscriber in
  // this process (the TUI never mounts in the sidecar). Each request surfaces
  // as an approval_request event and HALTS the run — the bridge promise does
  // not resolve until approval_response arrives (→ AskUserBridge.submit) or
  // the socket closes / the gateway shuts down (→ deny, fail-closed).
  const unsubscribeBridge = AskUserBridge.subscribe((request) => {
    if (!request) return
    const approvalId = randomUUID()
    pendingApprovals.set(approvalId, {
      deny: () =>
        AskUserBridge.submit({
          answers: [],
          skipped: true,
        }),
      questions: request.questions,
    })
    pushEvent({
      type: 'approval_request',
      approvalId,
      requestType: 'deferral',
      content: request.questions as never,
    })
    ensureFlushTimer()
  })

  const server = Bun.serve<ConnectionState>({
    port,
    hostname,
    async fetch(request, serverInstance) {
      const url = new URL(request.url)
      if (url.pathname !== '/ws') {
        return new Response('Not found', { status: 404 })
      }

      // Origin/Host validation at the upgrade (server-side, fail-closed).
      const originHeader = request.headers.get('origin')
      const hostHeader = request.headers.get('host')
      if (
        !isAllowedOrigin(originHeader, allowedOrigins) ||
        !isAllowedHost(hostHeader)
      ) {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: GATEWAY_ERROR_CODES.originRejected,
              message: 'Origin rejected',
            },
          }),
          { status: 403, headers: { 'content-type': 'application/json' } },
        )
      }

      const upgraded = serverInstance.upgrade(request, {
        data: { authed: false, helloReceived: false },
      })
      if (!upgraded) {
        return new Response('Upgrade failed', { status: 400 })
      }
      return undefined
    },
    websocket: {
      open(ws) {
        // The connection starts unauthenticated; hello flips the flags.
        connectedSockets.add(ws as unknown as { send: (data: string) => void })
      },
      message(ws, rawMessage) {
        const state = ws.data ?? { authed: false, helloReceived: false }
        let parsed: unknown
        try {
          parsed = JSON.parse(String(rawMessage))
        } catch {
          dispatch((data) => ws.send(data), null, state)
          return
        }
        dispatch((data) => ws.send(data), parsed, state)
      },
      close(ws) {
        connectedSockets.delete(
          ws as unknown as { send: (data: string) => void },
        )
        // An approval pending across a disconnect resolves FAIL-CLOSED so the
        // run can settle; the desktop can re-approve after reconnect (the
        // halted run's history records the skipped result).
        denyPendingApprovals(pendingApprovals)
      },
    },
  })

  for (const update of collectFidUpdates()) {
    fidStatuses.set(update.fidId, {
      projectId: update.projectId,
      status: update.status,
    })
  }

  const fidWatcher = startFidWatcher({
    fidsDir,
    onChange: emitFidChanges,
  })

  const stop = (): void => {
    if (flushTimer) {
      clearInterval(flushTimer)
      flushTimer = null
    }
    unsubscribeBridge()
    fidWatcher.close()
    denyPendingApprovals(pendingApprovals)
    try {
      server.stop()
    } catch {
      // Already stopped.
    }
  }

  const boundPort = server.port ?? 0
  onReady?.({ port: boundPort })

  return { port: boundPort, stop }
}
