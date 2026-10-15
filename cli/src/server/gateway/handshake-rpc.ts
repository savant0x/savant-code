// Authenticated frozen-v1 dispatch with optional client capabilities.

import { handleListCommands } from './commands-registry'
import { handleHello } from './hello-rpc'
import {
  handleProviderNotices,
  supportsProviderNotices,
} from './provider-notifications-rpc'
import { handleReplayEvents } from './replay-rpc'
import {
  containDispatch,
  runMessageContained,
  withTriggerManager,
} from './rpc-containment'
import {
  handleApprovalResponse,
  handleInterruptStream,
  handleUserMessage,
} from './run-lifecycle'
import {
  handleGetScopedThreads,
  handleUpdateScopedThreadState,
} from './scoped-threads-rpc'
import { handleTelemetryAggregates } from './telemetry-rpc'
import {
  handleTriggersCreate,
  handleTriggersDelete,
  handleTriggersList,
  handleTriggersSetEnabled,
  handleTriggersSetRecurrence,
} from './triggers-rpc'
import {
  failure,
  GATEWAY_ERROR_CODES,
  isJsonRpcMessage,
  success,
} from '../json-rpc'

import type { FidEventBus } from './fid-events'
import type { GatewayContext } from './state'
import type { ConnectionState } from './types'

export { handleHello } from './hello-rpc'

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
  function dispatchFrame(
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
      state.providerNotices = state.authed && supportsProviderNotices(params)
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
        // FID-2026-1002-008 (D3): fired with its rejection contained — the
        // handler owns pre/post-acceptance framing; this backstop makes the
        // `void`-ed rejection impossible by construction.
        runMessageContained(
          () => handleUserMessage(ctx, send, id, params),
          send,
          ctx.logger,
        )
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
      case 'replay_events':
        // Ordered socket preserves snapshot-before-live replay delivery.
        handleReplayEvents(ctx, send, id, params, state.providerNotices)
        break
      case 'provider_notices_snapshot':
      case 'provider_notices_ack':
        handleProviderNotices(
          send,
          id,
          method,
          params,
          state.providerNotices === true,
        )
        break
      case 'list_commands':
        handleListCommands(send, id, ctx.commands)
        break
      case 'telemetry_aggregates':
        handleTelemetryAggregates(
          send,
          id,
          params,
          ctx.loadTelemetryAggregates,
          ctx.logger,
        )
        break
      case 'triggers_list':
        withTriggerManager(send, id, ctx, (manager) =>
          handleTriggersList(send, id, manager, ctx.logger),
        )
        break
      case 'triggers_create':
        withTriggerManager(send, id, ctx, (manager) =>
          handleTriggersCreate(send, id, params, manager),
        )
        break
      case 'triggers_set_recurrence':
        withTriggerManager(send, id, ctx, (manager) =>
          handleTriggersSetRecurrence(send, id, params, manager),
        )
        break
      case 'triggers_set_enabled':
        withTriggerManager(send, id, ctx, (manager) =>
          handleTriggersSetEnabled(send, id, params, manager),
        )
        break
      case 'triggers_delete':
        withTriggerManager(send, id, ctx, (manager) =>
          handleTriggersDelete(send, id, params, manager),
        )
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

  // FID-2026-1002-008 (D3): the dispatch boundary is contained — a handler
  // throw becomes a JSON-RPC internalError failure, never an escape into
  // Bun's websocket message callback (process-teardown class).
  function dispatch(
    send: (data: string) => void,
    message: unknown,
    state: ConnectionState,
  ): void {
    containDispatch({
      frame: () => dispatchFrame(send, message, state),
      send,
      message,
      logger: ctx.logger,
    })
  }
  return dispatch
}
