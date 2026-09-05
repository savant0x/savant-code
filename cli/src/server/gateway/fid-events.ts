// FID-2026-0905-004 — gateway decomposition: FID-queue event bus.
//
// Watches the dev/fids inventory and emits fid_update events when a FID's
// status changes (or a FID disappears → closed). The fidStatuses map is
// ENCAPSULATED here (single owner, Loop-2 decision) instead of living on the
// shared context. Verbatim logic from gateway.ts.

import { loadFidInventory } from '../../utils/fid-loader'
import { notification } from '../json-rpc'

import type { GatewayContext } from './state'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

/** FID-queue change bus: snapshot collection, change-emission, and boot
 *  seeding. Implemented by createFidEventBus; consumed by the facade and
 *  the hello/dispatch path. */
export type FidEventBus = {
  collectFidUpdates: () => PrintModeEvent[]
  emitFidChanges: (sockets: Iterable<{ send: (data: string) => void }>) => void
  seed: () => void
}

/**
 * Create the FID-queue change bus. The facade calls `seed()` once at boot
 * (so the first emitFidChanges only reports actual changes) and passes
 * `getSockets` indirectly through the context.
 */
export function createFidEventBus(params: {
  fidsDir: string
  projectId: string
  logger: GatewayContext['logger']
}): FidEventBus {
  const fidStatuses = new Map<
    string,
    {
      projectId: string
      parentId?: string
      status:
        'created' | 'analyzed' | 'fixed' | 'verified' | 'converged' | 'closed'
    }
  >()

  function collectFidUpdates(): PrintModeEvent[] {
    const inventory = loadFidInventory(params.fidsDir)
    const updates: PrintModeEvent[] = []
    for (const fid of [...inventory.active, ...inventory.archived]) {
      const status = fid.status as
        'created' | 'analyzed' | 'fixed' | 'verified' | 'converged' | 'closed'
      if (
        ![
          'created',
          'analyzed',
          'fixed',
          'verified',
          'converged',
          'closed',
        ].includes(status)
      )
        continue
      updates.push({
        type: 'fid_update',
        fidId: fid.id,
        projectId: params.projectId,
        ...(fid.parentId !== undefined ? { parentId: fid.parentId } : {}),
        status,
      } as PrintModeEvent)
    }
    return updates
  }

  function seed(): void {
    for (const update of collectFidUpdates()) {
      fidStatuses.set(update.type === 'fid_update' ? update.fidId : '', {
        projectId: update.type === 'fid_update' ? update.projectId : '',
        status:
          update.type === 'fid_update' ? update.status : ('closed' as const),
      })
    }
  }

  function emitFidChanges(
    sockets: Iterable<{ send: (data: string) => void }>,
  ): void {
    const next = new Map<
      string,
      {
        projectId: string
        parentId?: string
        status:
          'created' | 'analyzed' | 'fixed' | 'verified' | 'converged' | 'closed'
      }
    >()
    const updates = collectFidUpdates()
    for (const update of updates) {
      if (update.type !== 'fid_update') continue
      next.set(update.fidId, {
        projectId: update.projectId,
        ...(update.parentId !== undefined ? { parentId: update.parentId } : {}),
        status: update.status,
      })
    }
    const changed: PrintModeEvent[] = updates.filter((update) => {
      if (update.type !== 'fid_update') return false
      const previous = fidStatuses.get(update.fidId)
      return (
        previous?.projectId !== update.projectId ||
        previous?.parentId !== update.parentId ||
        previous?.status !== update.status
      )
    })
    for (const id of fidStatuses.keys()) {
      if (!next.has(id)) {
        const previous = fidStatuses.get(id)
        changed.push({
          type: 'fid_update',
          fidId: id,
          projectId: previous?.projectId ?? params.projectId,
          ...(previous?.parentId !== undefined
            ? { parentId: previous.parentId }
            : {}),
          status: 'closed',
        } as PrintModeEvent)
      }
    }
    fidStatuses.clear()
    for (const [id, value] of next) fidStatuses.set(id, value)
    if (changed.length === 0) return
    const frame = JSON.stringify(notification('event', changed))
    for (const socket of sockets) {
      try {
        socket.send(frame)
      } catch (error) {
        params.logger?.error?.(error, 'gateway: FID update send failed')
      }
    }
  }

  return { collectFidUpdates, emitFidChanges, seed }
}
