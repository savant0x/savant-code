/**
 * Inbound frame classification for the session-gateway client: schemas for
 * the four recognized frame shapes plus a classifier that degrades malformed
 * input to a typed unknown outcome (never throws — Law 14). Extracted
 * verbatim from gateway-protocol.ts.
 */

import { printModeEventSchema } from '@savant-code/common/types/print-mode'
import z from 'zod/v4'

import type { JsonRpcId } from './gateway-protocol'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

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
