// FID-2026-0819-005 Loop 246: GatewayClient's typed request surface,
// extracted verbatim from gateway-client.ts as free functions over a
// dispatch/nextId context. GatewayClient delegates each public method to
// its counterpart here — behavior identical, signatures unchanged.

import {
  approvalResponseRequest,
  interruptRequest,
  listCommandsRequest,
  listCommandsResultSchema,
  scopedThreadsRequest,
  scopedThreadsResultSchema,
  triggersCreateRequest,
  triggersCreateResultSchema,
  triggersDeleteRequest,
  triggersDeleteResultSchema,
  triggersListRequest,
  triggersListResultSchema,
  triggersSetEnabledRequest,
  triggersSetRecurrenceRequest,
  triggersSetResultSchema,
  updateScopedThreadStateRequest,
  updateScopedThreadStateResultSchema,
  userMessageRequest,
} from './gateway-protocol'

import type {
  CreatedTriggerInfo,
  JsonRpcId,
  JsonRpcRequest,
  TriggerRecord,
  WorkspaceScopeType,
} from './gateway-protocol'

export type GatewayRequestContext = {
  dispatch(frame: JsonRpcRequest): Promise<unknown>
  nextId(): JsonRpcId
}

export async function sendUserMessageVia(
  ctx: GatewayRequestContext,
  prompt: string,
  opts?: { continueId?: string },
): Promise<void> {
  await ctx.dispatch(userMessageRequest(ctx.nextId(), prompt, opts))
}

export async function getScopedThreadsVia(
  ctx: GatewayRequestContext,
  scopeType: WorkspaceScopeType,
  scopeId: string,
): Promise<{
  scopeType: WorkspaceScopeType
  scopeId: string
  threads: Array<{
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
  }>
}> {
  const result = await ctx.dispatch(
    scopedThreadsRequest(ctx.nextId(), scopeType, scopeId),
  )
  return scopedThreadsResultSchema.parse(result)
}

export async function updateScopedThreadStateVia(
  ctx: GatewayRequestContext,
  sessionId: string,
  state: { unread?: boolean; pinned?: boolean },
): Promise<{ updated: boolean }> {
  const result = await ctx.dispatch(
    updateScopedThreadStateRequest(ctx.nextId(), sessionId, state),
  )
  return updateScopedThreadStateResultSchema.parse(result)
}

/** FID-2026-0901-005: the server-side slash-command registry — the full
 *  CLI command surface with honest dispatch classes. */
export async function listCommandsVia(
  ctx: GatewayRequestContext,
): Promise<
  Array<{ id: string; description: string; dispatch: 'agent' | 'client' }>
> {
  const result = await ctx.dispatch(listCommandsRequest(ctx.nextId()))
  return listCommandsResultSchema.parse(result).commands
}

// --- FID-2026-0824-005 step 5: trigger management (rail panel) ----------

/** Sanitized trigger list (never the secret or its hash). */
export async function triggersListVia(
  ctx: GatewayRequestContext,
): Promise<TriggerRecord[]> {
  const result = await ctx.dispatch(triggersListRequest(ctx.nextId()))
  return triggersListResultSchema.parse(result).triggers
}

/** Create a trigger. The response carries the plaintext secret EXACTLY
 *  once — the server persists only its hash. */
export async function triggersCreateVia(
  ctx: GatewayRequestContext,
  params: {
    name: string
    recurrence?: string
  },
): Promise<CreatedTriggerInfo> {
  const result = await ctx.dispatch(triggersCreateRequest(ctx.nextId(), params))
  return triggersCreateResultSchema.parse(result).trigger
}

/** Set (or null-clear) the cron recurrence. */
export async function triggersSetRecurrenceVia(
  ctx: GatewayRequestContext,
  triggerId: string,
  recurrence: string | null,
): Promise<{ updated: boolean }> {
  const result = await ctx.dispatch(
    triggersSetRecurrenceRequest(ctx.nextId(), triggerId, recurrence),
  )
  return triggersSetResultSchema.parse(result)
}

/** Enable/disable (disable pauses scheduled fires). */
export async function triggersSetEnabledVia(
  ctx: GatewayRequestContext,
  triggerId: string,
  enabled: boolean,
): Promise<{ updated: boolean }> {
  const result = await ctx.dispatch(
    triggersSetEnabledRequest(ctx.nextId(), triggerId, enabled),
  )
  return triggersSetResultSchema.parse(result)
}

/** Delete a trigger. */
export async function triggersDeleteVia(
  ctx: GatewayRequestContext,
  triggerId: string,
): Promise<{ deleted: boolean }> {
  const result = await ctx.dispatch(
    triggersDeleteRequest(ctx.nextId(), triggerId),
  )
  return triggersDeleteResultSchema.parse(result)
}

export async function respondApprovalVia(
  ctx: GatewayRequestContext,
  approvalId: string,
  answers: Array<Record<string, unknown>>,
  skipped: boolean,
): Promise<void> {
  await ctx.dispatch(
    approvalResponseRequest(ctx.nextId(), approvalId, answers, skipped),
  )
}

export async function interruptVia(ctx: GatewayRequestContext): Promise<void> {
  await ctx.dispatch(interruptRequest(ctx.nextId()))
}
