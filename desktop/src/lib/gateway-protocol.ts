// FID-2026-0820-010 Loop 3 — client-side mirror of the frozen Session Gateway
// v1 wire contract (server source of truth: cli/src/server/json-rpc.ts +
// cli/src/server/gateway.ts). The mirrored constants below are asserted
// against the server source by desktop/scripts/gateway-contract.drift.test.ts;
// change them only together with the server files.
//
// Decomposition: the trigger-management frames live in
// `gateway-protocol-triggers.ts` and the inbound-frame classification in
// `gateway-protocol-inbound.ts`; both are re-exported here so the
// `./gateway-protocol` import surface is unchanged.

import z from 'zod/v4'

export * from './gateway-protocol-inbound'
export * from './gateway-protocol-triggers'

/** Frozen handshake version — must equal cli/src/server/json-rpc.ts. */
export const GATEWAY_PROTOCOL_VERSION = 1

/**
 * Reserved application error codes — names AND values must mirror
 * cli/src/server/json-rpc.ts exactly (drift-guarded by test).
 */
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

/** JSON-RPC request id vocabulary (request/response only). */
export type JsonRpcId = string | number

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: JsonRpcId
  method: string
  params?: Record<string, unknown>
}

export function serializeRequest(frame: JsonRpcRequest): string {
  return JSON.stringify(frame)
}

// ---------------------------------------------------------------------------
// Outbound frame builders (fail fast on client-side contract violations)
// ---------------------------------------------------------------------------

export const helloParamsSchema = z.object({
  protocolVersion: z.literal(GATEWAY_PROTOCOL_VERSION),
  token: z.string().min(1),
})

export function helloRequest(id: JsonRpcId, token: string): JsonRpcRequest {
  const params = helloParamsSchema.parse({
    protocolVersion: GATEWAY_PROTOCOL_VERSION,
    token,
  })
  return { jsonrpc: '2.0', id, method: 'hello', params }
}

export const userMessageParamsSchema = z.object({
  prompt: z.string().min(1),
  /** Reconnect replay handle (server resolves prior RunState from storage). */
  continueId: z.string().min(1).optional(),
})

export type WorkspaceScopeType = 'project' | 'global'

export const scopedThreadsParamsSchema = z.object({
  scopeType: z.enum(['project', 'global']),
  scopeId: z.string().min(1),
})

export function scopedThreadsRequest(
  id: JsonRpcId,
  scopeType: WorkspaceScopeType,
  scopeId: string,
): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id,
    method: 'get_scoped_threads',
    params: scopedThreadsParamsSchema.parse({ scopeType, scopeId }),
  }
}

export const scopedThreadMessageSchema = z.object({
  id: z.string(),
  role: z.string(),
  content: z.string(),
  createdAt: z.string(),
})

export const scopedThreadSchema = z.object({
  sessionId: z.string(),
  chatId: z.string(),
  agentId: z.string(),
  unread: z.boolean(),
  pinned: z.boolean(),
  messages: z.array(scopedThreadMessageSchema),
})

export const updateScopedThreadStateParamsSchema = z
  .object({
    sessionId: z.string().min(1),
    unread: z.boolean().optional(),
    pinned: z.boolean().optional(),
  })
  .refine((value) => value.unread !== undefined || value.pinned !== undefined)

export function updateScopedThreadStateRequest(
  id: JsonRpcId,
  sessionId: string,
  state: { unread?: boolean; pinned?: boolean },
): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id,
    method: 'update_scoped_thread_state',
    params: updateScopedThreadStateParamsSchema.parse({ sessionId, ...state }),
  }
}

export const updateScopedThreadStateResultSchema = z.object({
  updated: z.boolean(),
})

export const scopedThreadsResultSchema = z.object({
  scopeType: z.enum(['project', 'global']),
  scopeId: z.string(),
  threads: z.array(scopedThreadSchema),
})

export type ScopedThread = z.infer<typeof scopedThreadSchema>

export function userMessageRequest(
  id: JsonRpcId,
  prompt: string,
  opts?: { continueId?: string },
): JsonRpcRequest {
  const params = userMessageParamsSchema.parse({
    prompt,
    ...(opts?.continueId !== undefined ? { continueId: opts.continueId } : {}),
  })
  return { jsonrpc: '2.0', id, method: 'user_message', params }
}

/** Answer payload mirrors AskUserBridge.submit: answers + skipped flag. */
export const approvalResponseParamsSchema = z.object({
  approvalId: z.string().min(1),
  response: z
    .object({
      answers: z.array(z.record(z.string(), z.unknown())),
      skipped: z.boolean(),
    })
    .optional(),
})

export function approvalResponseRequest(
  id: JsonRpcId,
  approvalId: string,
  answers: Array<Record<string, unknown>>,
  skipped: boolean,
): JsonRpcRequest {
  const params = approvalResponseParamsSchema.parse({
    approvalId,
    ...(answers.length > 0 || skipped
      ? { response: { answers, skipped } }
      : {}),
  })
  return { jsonrpc: '2.0', id, method: 'approval_response', params }
}

export function interruptRequest(id: JsonRpcId): JsonRpcRequest {
  return { jsonrpc: '2.0', id, method: 'interrupt_stream' }
}

// FID-2026-0901-005: server-provided slash-command registry ---------------

export const listCommandsResultSchema = z.object({
  commands: z.array(
    z.object({
      /** Command id WITHOUT the leading slash ('compact', 'mode:plan'). */
      id: z.string().min(1),
      description: z.string(),
      /** 'agent' = dispatch as prompt text; 'client' = renderer-local only. */
      dispatch: z.enum(['agent', 'client']),
    }),
  ),
})

export function listCommandsRequest(id: JsonRpcId): JsonRpcRequest {
  return { jsonrpc: '2.0', id, method: 'list_commands', params: {} }
}
