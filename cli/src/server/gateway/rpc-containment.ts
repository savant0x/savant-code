// FID-2026-1002-008 — gateway RPC error containment (T113 audit D3).
//
// The dispatch boundary, the void-ed async run handler's backstop, and the
// containment frame emission live here so the transport can guarantee: no
// handler failure escapes into Bun's websocket message callback (uncaught
// exception, process-teardown class on the sidecar) and no `void`-ed
// promise rejects. Everything is emitted with the frozen v1 vocabulary —
// `internalError: -32603` (json-rpc.ts, mirrored by the drift-guarded
// desktop protocol module) and the existing `run_complete {ok:false}`
// notification. No wire-contract change.

import {
  failure,
  GATEWAY_ERROR_CODES,
  isJsonRpcMessage,
  notification,
} from '../json-rpc'
import { denyPendingApprovals } from './state'
import { requireTriggerManager } from './triggers-rpc'

import type { GatewayContext } from './state'
import type { GatewayLogger, GatewayTriggerManager } from './types'

/** Best-effort send: a dying socket must not turn containment into an
 *  escape. Failures are logged and swallowed. */
function safeSend(
  send: (data: string) => void,
  data: string,
  logger: GatewayLogger | undefined,
  label: string,
): void {
  try {
    send(data)
  } catch (error) {
    logger?.error?.(error, label)
  }
}

/** The dispatch boundary: run one inbound frame through `frame`; a
 *  synchronous handler throw becomes a JSON-RPC internalError failure
 *  carrying the request id (null when the frame carried none). The
 *  containment send is itself guarded — the usual trigger is a dying
 *  socket. */
export function containDispatch(params: {
  frame: () => void
  send: (data: string) => void
  message: unknown
  logger: GatewayLogger | undefined
}): void {
  try {
    params.frame()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const id =
      isJsonRpcMessage(params.message) && 'id' in params.message
        ? params.message.id
        : null
    params.logger?.error?.(error, 'gateway: RPC handler failed')
    safeSend(
      params.send,
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.internalError,
          `Gateway handler failed: ${message}`,
        ),
      ),
      params.logger,
      'gateway: containment failure frame undeliverable',
    )
  }
}

/** Fire an async RPC handler with its rejection contained. The handler owns
 *  pre/post-acceptance framing (run-lifecycle.ts); this is the backstop
 *  that makes a `void`-ed promise rejection impossible by construction. It
 *  cannot double-emit: the handler's own containment resolves the promise. */
export function runMessageContained(
  run: () => Promise<void>,
  send: (data: string) => void,
  logger: GatewayLogger | undefined,
): void {
  void run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    logger?.error?.(error, 'gateway: user_message rejected')
    safeSend(
      send,
      JSON.stringify(
        notification('run_complete', { ok: false, error: message }),
      ),
      logger,
      'gateway: containment terminal frame undeliverable',
    )
  })
}

/** user_message outer containment (run-lifecycle.ts catch): the phase flags
 *  pick the frame — pre-acceptance failures answer the still-open request
 *  with a JSON-RPC internalError failure; post-acceptance failures emit the
 *  terminal `run_complete {ok:false}` the accepted contract promises
 *  (suppressed when a terminal frame already went out). */
export function containUserMessageFailure(params: {
  send: (data: string) => void
  id: number | string
  logger: GatewayLogger | undefined
  accepted: boolean
  terminalSent: boolean
  error: unknown
}): void {
  const message =
    params.error instanceof Error ? params.error.message : String(params.error)
  params.logger?.error?.(params.error, 'gateway: user_message handler failed')
  let frame: string | null = null
  if (!params.accepted) {
    frame = JSON.stringify(
      failure(
        params.id,
        GATEWAY_ERROR_CODES.internalError,
        `user_message failed: ${message}`,
      ),
    )
  } else if (!params.terminalSent) {
    frame = JSON.stringify(
      notification('run_complete', { ok: false, error: message }),
    )
  }
  if (frame !== null) {
    safeSend(
      params.send,
      frame,
      params.logger,
      'gateway: containment frame undeliverable',
    )
  }
}

/** Run-settle approval cleanup that cannot escape its finally: a bridge
 *  fault in `denyPendingApprovals` would reject the `void`-ed run promises
 *  on both run paths (user_message, injectTriggerRun). The deny stays
 *  fail-closed; a bridge fault is contained and logged. */
export function denyPendingApprovalsContained(ctx: GatewayContext): void {
  try {
    denyPendingApprovals(ctx)
  } catch (error) {
    ctx.logger?.error?.(error, 'gateway: run-settle approval deny failed')
  }
}

/** Shared trigger-method guard (ceiling-driven de-duplication in
 *  handshake-rpc.ts): `requireTriggerManager` already answers
 *  invalidRequest when the feature is off; run the handler only when a
 *  manager exists. */
export function withTriggerManager(
  send: (data: string) => void,
  id: number | string,
  ctx: GatewayContext,
  run: (manager: GatewayTriggerManager) => void,
): void {
  const manager = requireTriggerManager(
    send,
    id,
    ctx.triggerManager,
    ctx.logger,
  )
  if (manager) run(manager)
}
