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
//
// FID-2026-0905-004: the gateway is decomposed into single-responsibility
// stage modules under ./gateway/ — this file is the composition facade. It
// owns: option destructuring, context assembly, Bun.serve (the transport IS
// the composition), the FID watcher + shutdown path, and the public handle.
// All RPC behavior lives in the stage modules; the public export surface is
// re-exported byte-identically.

import { basename, join } from 'node:path'

import {
  DEFAULT_GATEWAY_ALLOWED_ORIGINS,
  isAllowedHost,
  isAllowedOrigin,
} from './auth'
import { startFidWatcher } from '../utils/fid-watcher'
import { fetchGatewayModels } from '../utils/openrouter-models'
import { defaultListCommands } from './gateway/commands-registry'
import { defaultRunPrompt } from './gateway/default-run-prompt'
import { createFidEventBus } from './gateway/fid-events'
import { createDispatch } from './gateway/handshake-rpc'
import {
  injectTriggerRun,
  subscribeApprovalBridge,
} from './gateway/run-lifecycle'
import {
  defaultLoadScopedThreads,
  defaultUpdateScopedThreadState,
} from './gateway/scoped-threads-rpc'
import { createGatewayContext, denyPendingApprovals } from './gateway/state'
import { GATEWAY_ERROR_CODES } from './json-rpc'

export { EVENT_FLUSH_INTERVAL_MS } from './gateway/types'
export type {
  GatewayCommandDescriptor,
  GatewayHandle,
  GatewayOptions,
  GatewayTriggerManager,
} from './gateway/types'

import type {
  ConnectionState,
  GatewayOptions,
  GatewayHandle,
} from './gateway/types'

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

  // Per-session state: one context bundle (single-session v1). Pending
  // approvals are keyed by a gateway-generated approvalId (the bridge's
  // toolCallId is a constant — never unique) and survive socket disconnects.
  const ctx = createGatewayContext({
    token,
    projectId: basename(join(fidsDir, '..', '..')) || 'current-project',
    commands,
    logger,
    triggerManager: options.triggerManager,
    runPrompt,
    loadScopedThreads,
    updateScopedThreadState,
  })

  // FID-queue change bus (fidStatuses encapsulated in the bus).
  const fidBus = createFidEventBus({
    fidsDir,
    projectId: ctx.projectId,
    logger,
  })

  // Per-socket dispatch (frozen-v1 framing + 13-method router).
  const dispatch = createDispatch(ctx, fidBus)

  const unsubscribeBridge = subscribeApprovalBridge(ctx)

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
        ctx.connectedSockets.add(
          ws as unknown as { send: (data: string) => void },
        )
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
        ctx.connectedSockets.delete(
          ws as unknown as { send: (data: string) => void },
        )
        // An approval pending across a disconnect resolves FAIL-CLOSED so the
        // run can settle; the desktop can re-approve after reconnect (the
        // halted run's history records the skipped result).
        denyPendingApprovals(ctx)
      },
    },
  })

  fidBus.seed()

  const fidWatcher = startFidWatcher({
    fidsDir,
    onChange: () => {
      fidBus.emitFidChanges(ctx.connectedSockets)
    },
  })

  const stop = (): void => {
    if (ctx.flushTimer) {
      clearInterval(ctx.flushTimer)
      ctx.flushTimer = null
    }
    unsubscribeBridge()
    fidWatcher.close()
    denyPendingApprovals(ctx)
    try {
      server.stop()
    } catch {
      // Already stopped.
    }
  }

  const boundPort = server.port ?? 0
  onReady?.({ port: boundPort })

  return {
    port: boundPort,
    stop,
    injectTriggerRun: (params) => injectTriggerRun(ctx, params),
  }
}
