// FID-2026-0905-004 — gateway decomposition: frozen-v1 protocol dispatch.
//
// The hello handshake (protocolVersion + bearer token, fail-closed), the
// hello-first/auth/id framing rules, and the 13-method router. Verbatim
// logic from gateway.ts, parameterized by the GatewayContext + FidEventBus.

import { handleListCommands } from './commands-registry'
import {
  handleApprovalResponse,
  handleInterruptStream,
  handleUserMessage,
} from './run-lifecycle'
import {
  handleGetScopedThreads,
  handleUpdateScopedThreadState,
} from './scoped-threads-rpc'
import {
  handleTriggersCreate,
  handleTriggersDelete,
  handleTriggersList,
  handleTriggersSetEnabled,
  handleTriggersSetRecurrence,
  requireTriggerManager,
} from './triggers-rpc'
import { safeTokenEqual } from '../auth'
import {
  failure,
  GATEWAY_CAPABILITIES,
  GATEWAY_ERROR_CODES,
  GATEWAY_PROTOCOL_VERSION,
  isJsonRpcMessage,
  notification,
  success,
} from '../json-rpc'

import type { FidEventBus } from './fid-events'
import type { GatewayContext } from './state'
import type { ConnectionState } from './types'

/** Authenticate the hello frame. Fail-closed: mismatched protocolVersion →
 *  -32003 (never silently downgraded); missing/bad token → -32001. The reply
 *  carries the frozen capability list. */
export function handleHello(
  ctx: GatewayContext,
  bus: FidEventBus,
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
  if (!safeTokenEqual(providedToken, ctx.token)) {
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
        projectId: ctx.projectId,
      }),
    ),
  )
  setTimeout(() => {
    const updates = bus.collectFidUpdates()
    if (updates.length > 0) {
      send(JSON.stringify(notification('event', updates)))
    }
  }, 0)
  return true
}

/** update_setting (v1: capability listed, no-op persistence). */
function handleUpdateSetting(
  send: (data: string) => void,
  id: number | string,
): void {
  send(JSON.stringify(success(id, { accepted: true })))
}

/** Dispatch one inbound JSON-RPC frame. */
export function createDispatch(
  ctx: GatewayContext,
  bus: FidEventBus,
): (
  send: (data: string) => void,
  message: unknown,
  state: ConnectionState,
) => void {
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
      state.authed = handleHello(ctx, bus, send, id, params)
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
        void handleUserMessage(ctx, send, id, params)
        break
      case 'approval_response':
        handleApprovalResponse(ctx, send, id, params)
        break
      case 'interrupt_stream':
        handleInterruptStream(ctx, send, id)
        break
      case 'update_setting':
        handleUpdateSetting(send, id)
        break
      case 'get_scoped_threads':
        handleGetScopedThreads(
          send,
          id,
          params,
          ctx.loadScopedThreads,
          ctx.logger,
        )
        break
      case 'update_scoped_thread_state':
        handleUpdateScopedThreadState(
          send,
          id,
          params,
          ctx.updateScopedThreadState,
          ctx.logger,
        )
        break
      case 'list_commands':
        handleListCommands(send, id, ctx.commands)
        break
      case 'triggers_list':
        {
          const manager = requireTriggerManager(
            send,
            id,
            ctx.triggerManager,
            ctx.logger,
          )
          if (!manager) return
          handleTriggersList(send, id, manager, ctx.logger)
        }
        break
      case 'triggers_create':
        {
          const manager = requireTriggerManager(
            send,
            id,
            ctx.triggerManager,
            ctx.logger,
          )
          if (!manager) return
          handleTriggersCreate(send, id, params, manager)
        }
        break
      case 'triggers_set_recurrence':
        {
          const manager = requireTriggerManager(
            send,
            id,
            ctx.triggerManager,
            ctx.logger,
          )
          if (!manager) return
          handleTriggersSetRecurrence(send, id, params, manager)
        }
        break
      case 'triggers_set_enabled':
        {
          const manager = requireTriggerManager(
            send,
            id,
            ctx.triggerManager,
            ctx.logger,
          )
          if (!manager) return
          handleTriggersSetEnabled(send, id, params, manager)
        }
        break
      case 'triggers_delete':
        {
          const manager = requireTriggerManager(
            send,
            id,
            ctx.triggerManager,
            ctx.logger,
          )
          if (!manager) return
          handleTriggersDelete(send, id, params, manager)
        }
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
  return dispatch
}
