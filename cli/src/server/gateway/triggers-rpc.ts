// FID-2026-0905-004 — gateway decomposition: trigger management RPC.
//
// FID-2026-0824-005 step 5: the six triggers_* wire methods for the desktop
// rail panel. All methods require the manager DI; without it (feature off)
// they fail with invalidRequest so the panel can show the feature as
// unavailable rather than surfacing a protocol error. Handlers are verbatim
// moves from gateway.ts.

import { failure, GATEWAY_ERROR_CODES, success } from '../json-rpc'

import type { GatewayLogger, GatewayTriggerManager } from './types'

const TRIGGERS_OFF = 'Trigger management is not available (feature off)'

export function requireTriggerManager(
  send: (data: string) => void,
  id: number | string,
  triggerManager: GatewayTriggerManager | undefined,
  logger: GatewayLogger | undefined,
): GatewayTriggerManager | null {
  if (!triggerManager) {
    send(
      JSON.stringify(
        failure(id, GATEWAY_ERROR_CODES.invalidRequest, TRIGGERS_OFF),
      ),
    )
    return null
  }
  return triggerManager
}

export function handleTriggersList(
  send: (data: string) => void,
  id: number | string,
  manager: GatewayTriggerManager,
  logger: GatewayLogger | undefined,
): void {
  try {
    send(JSON.stringify(success(id, { triggers: manager.list() })))
  } catch (error) {
    logger?.error?.(error, 'gateway: triggers_list failed')
    send(
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.internalError,
          'Failed to list triggers',
        ),
      ),
    )
  }
}

export function handleTriggersCreate(
  send: (data: string) => void,
  id: number | string,
  params: unknown,
  manager: GatewayTriggerManager,
): void {
  const record = (params ?? {}) as Record<string, unknown>
  const name = typeof record.name === 'string' ? record.name.trim() : ''
  const recurrence =
    typeof record.recurrence === 'string' && record.recurrence.trim()
      ? record.recurrence.trim()
      : undefined
  if (!name) {
    send(
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.invalidRequest,
          'triggers_create requires name',
        ),
      ),
    )
    return
  }
  try {
    // The plaintext secret rides this ONE response — never persisted,
    // never returned again (rotate re-issues one).
    const created = manager.create({ name, recurrence })
    send(JSON.stringify(success(id, { trigger: created })))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Validation failures (duplicate name, bad cron) are client errors.
    send(
      JSON.stringify(failure(id, GATEWAY_ERROR_CODES.invalidRequest, message)),
    )
  }
}

export function handleTriggersSetRecurrence(
  send: (data: string) => void,
  id: number | string,
  params: unknown,
  manager: GatewayTriggerManager,
): void {
  const record = (params ?? {}) as Record<string, unknown>
  const triggerId = typeof record.triggerId === 'string' ? record.triggerId : ''
  const recurrence =
    typeof record.recurrence === 'string' && record.recurrence.trim()
      ? record.recurrence.trim()
      : null
  if (!triggerId) {
    send(
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.invalidRequest,
          'triggers_set_recurrence requires triggerId',
        ),
      ),
    )
    return
  }
  try {
    const updated = manager.setRecurrence(triggerId, recurrence)
    if (!updated) {
      send(
        JSON.stringify(
          failure(
            id,
            GATEWAY_ERROR_CODES.invalidRequest,
            `Unknown trigger: ${triggerId}`,
          ),
        ),
      )
      return
    }
    send(JSON.stringify(success(id, { updated: true })))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    send(
      JSON.stringify(failure(id, GATEWAY_ERROR_CODES.invalidRequest, message)),
    )
  }
}

export function handleTriggersSetEnabled(
  send: (data: string) => void,
  id: number | string,
  params: unknown,
  manager: GatewayTriggerManager,
): void {
  const record = (params ?? {}) as Record<string, unknown>
  const triggerId = typeof record.triggerId === 'string' ? record.triggerId : ''
  const enabled = record.enabled === true
  if (!triggerId || (record.enabled !== true && record.enabled !== false)) {
    send(
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.invalidRequest,
          'triggers_set_enabled requires triggerId and enabled (boolean)',
        ),
      ),
    )
    return
  }
  const updated = manager.setEnabled(triggerId, enabled)
  if (!updated) {
    send(
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.invalidRequest,
          `Unknown trigger: ${triggerId}`,
        ),
      ),
    )
    return
  }
  send(JSON.stringify(success(id, { updated: true })))
}

export function handleTriggersDelete(
  send: (data: string) => void,
  id: number | string,
  params: unknown,
  manager: GatewayTriggerManager,
): void {
  const record = (params ?? {}) as Record<string, unknown>
  const triggerId = typeof record.triggerId === 'string' ? record.triggerId : ''
  if (!triggerId) {
    send(
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.invalidRequest,
          'triggers_delete requires triggerId',
        ),
      ),
    )
    return
  }
  const deleted = manager.delete(triggerId)
  if (!deleted) {
    send(
      JSON.stringify(
        failure(
          id,
          GATEWAY_ERROR_CODES.invalidRequest,
          `Unknown trigger: ${triggerId}`,
        ),
      ),
    )
    return
  }
  send(JSON.stringify(success(id, { deleted: true })))
}
