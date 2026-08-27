// FID-2026-0820-010 Loop 3 — client-side mirror of the frozen Session Gateway
// v1 wire contract (server source of truth: cli/src/server/json-rpc.ts +
// cli/src/server/gateway.ts). The mirrored constants below are asserted
// against the server source by desktop/scripts/gateway-contract.drift.test.ts;
// change them only together with the server files.

import { printModeEventSchema } from '@savant-code/common/types/print-mode'
import z from 'zod/v4'

import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

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

// ---------------------------------------------------------------------------
// Inbound frames — classified, never thrown on
// ---------------------------------------------------------------------------

export const jsonRpcSuccessSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  result: z.unknown(),
})

export const jsonRpcFailureSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  error: z.object({ code: z.number(), message: z.string() }),
})

export const eventNotificationSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.literal('event'),
  params: z.array(printModeEventSchema),
})

export const runCompleteNotificationSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.literal('run_complete'),
  params: z.object({
    ok: z.boolean(),
    error: z.string().optional(),
    runId: z.string().optional(),
  }),
})

/** Ready-result payload returned by the gateway on a successful hello. */
export const helloResultSchema = z.object({
  protocolVersion: z.number(),
  capabilities: z.array(z.string()),
  projectId: z.string().min(1),
})

export type InboundFrame =
  | { kind: 'success'; id: JsonRpcId; result: unknown }
  | { kind: 'failure'; id: JsonRpcId | null; code: number; message: string }
  | { kind: 'events'; events: PrintModeEvent[] }
  | { kind: 'runComplete'; ok: boolean; error?: string; runId?: string }
  | { kind: 'unknown'; reason: string }

export type ParseOutcome =
  { ok: true; frame: InboundFrame } | { ok: false; error: string }

/**
 * Parse one raw websocket text frame into a classified result. Malformed
 * input never throws — it degrades to a typed outcome the transport can log
 * and drop (Law 14).
 */
export function parseInboundFrame(raw: string): ParseOutcome {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'frame is not valid JSON' }
  }
  return { ok: true, frame: classifyFrame(parsed) }
}

function classifyFrame(parsed: unknown): InboundFrame {
  const events = eventNotificationSchema.safeParse(parsed)
  if (events.success) {
    return { kind: 'events', events: events.data.params }
  }
  const runComplete = runCompleteNotificationSchema.safeParse(parsed)
  if (runComplete.success) {
    const params = runComplete.data.params
    return {
      kind: 'runComplete',
      ok: params.ok,
      ...(params.error !== undefined ? { error: params.error } : {}),
      ...(params.runId !== undefined ? { runId: params.runId } : {}),
    }
  }
  const success = jsonRpcSuccessSchema.safeParse(parsed)
  if (success.success) {
    return { kind: 'success', id: success.data.id, result: success.data.result }
  }
  const failure = jsonRpcFailureSchema.safeParse(parsed)
  if (failure.success) {
    return {
      kind: 'failure',
      id: failure.data.id,
      code: failure.data.error.code,
      message: failure.data.error.message,
    }
  }
  return { kind: 'unknown', reason: describeMismatch(parsed) }
}

function describeMismatch(parsed: unknown): string {
  if (typeof parsed !== 'object' || parsed === null) {
    return 'frame is not a JSON-RPC object'
  }
  const record = parsed as { [key: string]: unknown }
  if (record.jsonrpc !== '2.0') {
    return 'frame is missing jsonrpc:"2.0" envelope'
  }
  if (record.method === 'event') {
    return 'event notification params are not a PrintModeEvent array'
  }
  return `unrecognized frame shape (method: ${String(record.method)})`
}
