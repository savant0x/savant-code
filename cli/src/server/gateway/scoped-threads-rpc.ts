// FID-2026-0905-004 — gateway decomposition: scoped-thread RPC.
//
// Read persisted messages for one workspace scope without exposing DB rows,
// and update persisted thread state for the workspace rail. Handlers are
// verbatim moves from gateway.ts; the DB-backed defaults ride with them so
// the DI seam and its fallback stay together.

import {
  getMessagesBySessionId,
  getSessionsByScope,
  updateSessionPinned,
  updateSessionUnread,
} from '@savant-code/database/service'

import { failure, GATEWAY_ERROR_CODES, success } from '../json-rpc'

import type { GatewayLogger, ScopedThreadRecord } from './types'

export function defaultLoadScopedThreads(params: {
  scopeType: 'project' | 'global'
  scopeId: string
}): ScopedThreadRecord[] {
  const sessions = getSessionsByScope(params.scopeType, params.scopeId)
    .slice()
    .reverse()
  return sessions.map((session) => ({
    sessionId: session.id,
    chatId: session.chat_id,
    agentId: session.agent_id,
    unread: session.unread,
    pinned: session.pinned,
    messages: getMessagesBySessionId(session.id).map((message) => ({
      id: message.id,
      role: message.role,
      content:
        typeof message.content === 'string'
          ? message.content
          : JSON.stringify(message.content),
      createdAt: message.created_at,
    })),
  }))
}

export function defaultUpdateScopedThreadState(params: {
  sessionId: string
  unread?: boolean
  pinned?: boolean
}): boolean {
  let changed = false
  if (params.unread !== undefined) {
    changed = updateSessionUnread(params.sessionId, params.unread) || changed
  }
  if (params.pinned !== undefined) {
    changed = updateSessionPinned(params.sessionId, params.pinned) || changed
  }
  return changed
}

/** Read persisted messages for one workspace scope without exposing DB rows. */
export function handleGetScopedThreads(
  send: (data: string) => void,
  id: number | string,
  params: unknown,
  loadScopedThreads: (p: {
    scopeType: 'project' | 'global'
    scopeId: string
  }) => ScopedThreadRecord[],
  logger: GatewayLogger | undefined,
): void {
  const record = (params ?? {}) as Record<string, unknown>
  const scopeType = record.scopeType
  const scopeId = typeof record.scopeId === 'string' ? record.scopeId : ''
  if (
    (scopeType !== 'project' && scopeType !== 'global') ||
    scopeId.trim().length === 0
  ) {
    send(
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.invalidRequest,
          'get_scoped_threads requires scopeType and scopeId',
        ),
      ),
    )
    return
  }

  try {
    const threads = loadScopedThreads({ scopeType, scopeId })
    send(JSON.stringify(success(id, { scopeType, scopeId, threads })))
  } catch (error) {
    logger?.error?.(error, 'gateway: scoped thread read failed')
    send(
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.internalError,
          'Failed to load scoped threads',
        ),
      ),
    )
  }
}

export function handleUpdateScopedThreadState(
  send: (data: string) => void,
  id: number | string,
  params: unknown,
  updateScopedThreadState: (p: {
    sessionId: string
    unread?: boolean
    pinned?: boolean
  }) => boolean,
  logger: GatewayLogger | undefined,
): void {
  const record = (params ?? {}) as Record<string, unknown>
  const sessionId =
    typeof record.sessionId === 'string' ? record.sessionId.trim() : ''
  const unread = typeof record.unread === 'boolean' ? record.unread : undefined
  const pinned = typeof record.pinned === 'boolean' ? record.pinned : undefined
  if (!sessionId || (unread === undefined && pinned === undefined)) {
    send(
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.invalidRequest,
          'update_scoped_thread_state requires sessionId and a state field',
        ),
      ),
    )
    return
  }
  try {
    const updated = updateScopedThreadState({ sessionId, unread, pinned })
    send(JSON.stringify(success(id, { updated })))
  } catch (error) {
    logger?.error?.(error, 'gateway: scoped thread state update failed')
    send(
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.internalError,
          'Failed to update scoped thread state',
        ),
      ),
    )
  }
}
