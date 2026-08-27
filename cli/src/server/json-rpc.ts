// FID-2026-0820-008 — frozen v1 handshake contract for the desktop session
// gateway. FID-009's Rust supervisor programs against THIS surface: changes
// to the envelope shape, the reserved error codes, or protocolVersion are
// breaking and require a handshake major-version bump.

export const GATEWAY_PROTOCOL_VERSION = 1

/** Reserved application error codes (JSON-RPC app range -32000..-32099). */
export const GATEWAY_ERROR_CODES = {
  /** Bad or missing bearer token on the hello frame. */
  unauthorized: -32001,
  /** Origin/Host header rejected at the WS upgrade. */
  originRejected: -32002,
  /** hello carried an unsupported protocolVersion. */
  unsupportedProtocolVersion: -32003,
  /** A user_message arrived while a run is already in flight. */
  sessionBusy: -32004,
  /** hello was not the first frame, or a frame arrived before auth. */
  invalidRequest: -32600,
  /** Unknown method. */
  methodNotFound: -32601,
  /** Run failure / internal error. */
  internalError: -32603,
} as const

export type GatewayErrorCode =
  (typeof GATEWAY_ERROR_CODES)[keyof typeof GATEWAY_ERROR_CODES]

export type JsonRpcRequest = {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: unknown
}

export type JsonRpcNotification = {
  jsonrpc: '2.0'
  method: string
  params?: unknown
}

export type JsonRpcSuccess = {
  jsonrpc: '2.0'
  id: number | string
  result: unknown
}

export type JsonRpcError = {
  jsonrpc: '2.0'
  id: number | string | null
  error: { code: GatewayErrorCode | number; message: string; data?: unknown }
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification

/** Validate an inbound frame is a JSON-RPC object with a string method. */
export function isJsonRpcMessage(value: unknown): value is JsonRpcMessage {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    record.jsonrpc === '2.0' &&
    typeof record.method === 'string' &&
    ('id' in record || 'params' in record)
  )
}

export function success(id: number | string, result: unknown): JsonRpcSuccess {
  return { jsonrpc: '2.0', id, result }
}

export function failure(
  id: number | string | null,
  code: GatewayErrorCode | number,
  message: string,
  data?: unknown,
): JsonRpcError {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  }
}

export function notification(
  method: string,
  params: unknown,
): JsonRpcNotification {
  return { jsonrpc: '2.0', method, params }
}

/** Frozen v1 capability list (extends as the gateway grows; never silently
 *  downgrades a protocolVersion mismatch). */
export const GATEWAY_CAPABILITIES = [
  'hello',
  'user_message',
  'approval_response',
  'interrupt_stream',
  'update_setting',
  'get_scoped_threads',
  'update_scoped_thread_state',
  'event',
] as const
