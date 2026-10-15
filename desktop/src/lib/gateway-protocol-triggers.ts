/**
 * Trigger-management frames (FID-2026-0824-005 step 5 — desktop rail panel).
 * Server source of truth: cli/src/server/gateway.ts handleTriggers*.
 * Extracted verbatim from gateway-protocol.ts.
 */

import z from 'zod/v4'

import type { JsonRpcRequest } from './gateway-protocol'

/** One trigger in the rail panel (sanitized — never the secret or its hash). */
export const triggerRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  lastFiredAt: z.string().optional(),
  recurrence: z.string().optional(),
  nextRunAt: z.string().optional(),
  enabled: z.boolean(),
})

export type TriggerRecord = z.infer<typeof triggerRecordSchema>

export const triggersListResultSchema = z.object({
  triggers: z.array(triggerRecordSchema),
})

export function triggersListRequest(id: number | string): JsonRpcRequest {
  return { jsonrpc: '2.0', id, method: 'triggers_list', params: {} }
}

/** Create params: name required, recurrence optional (5-field cron). */
export const triggersCreateParamsSchema = z.object({
  name: z.string().min(1),
  recurrence: z.string().min(1).optional(),
})

/** The creation response — the ONLY frame that carries the plaintext secret. */
export const triggersCreateResultSchema = z.object({
  trigger: z.object({
    id: z.string(),
    name: z.string(),
    secret: z.string(),
    createdAt: z.string(),
  }),
})

export type CreatedTriggerInfo = z.infer<
  typeof triggersCreateResultSchema
>['trigger']

export function triggersCreateRequest(
  id: number | string,
  params: { name: string; recurrence?: string },
): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id,
    method: 'triggers_create',
    params: triggersCreateParamsSchema.parse(params),
  }
}

export const triggersSetRecurrenceParamsSchema = z.object({
  triggerId: z.string().min(1),
  /** null clears the schedule (back to webhook-only). */
  recurrence: z.string().min(1).nullable(),
})

export function triggersSetRecurrenceRequest(
  id: number | string,
  triggerId: string,
  recurrence: string | null,
): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id,
    method: 'triggers_set_recurrence',
    params: triggersSetRecurrenceParamsSchema.parse({ triggerId, recurrence }),
  }
}

export const triggersSetEnabledParamsSchema = z.object({
  triggerId: z.string().min(1),
  enabled: z.boolean(),
})

export function triggersSetEnabledRequest(
  id: number | string,
  triggerId: string,
  enabled: boolean,
): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id,
    method: 'triggers_set_enabled',
    params: triggersSetEnabledParamsSchema.parse({ triggerId, enabled }),
  }
}

export const triggersSetResultSchema = z.object({
  updated: z.boolean(),
})

export const triggersDeleteParamsSchema = z.object({
  triggerId: z.string().min(1),
})

export function triggersDeleteRequest(
  id: number | string,
  triggerId: string,
): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id,
    method: 'triggers_delete',
    params: triggersDeleteParamsSchema.parse({ triggerId }),
  }
}

export const triggersDeleteResultSchema = z.object({
  deleted: z.boolean(),
})
