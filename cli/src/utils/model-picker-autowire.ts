/**
 * FID-2026-1008-005 item 3: registry-only auto-wire for the /model picker.
 *
 * Picking a model whose provider is in the registry but has no credentials
 * ("Not wired") runs the existing `/provider <id>` key flow. The picked model
 * is staged here and applied once the key for that same provider is saved, so
 * the selection becomes active without a second /model pick. Only one
 * selection is pending at a time, and it is applied at most once.
 */

export interface PendingModelWire {
  id: string
  provider: string
}

let pending: PendingModelWire | undefined

export function stageModelAutoWire(model: PendingModelWire): void {
  pending = { id: model.id, provider: model.provider }
}

export function getPendingModelAutoWire(): PendingModelWire | undefined {
  return pending
}

export function clearModelAutoWire(): void {
  pending = undefined
}

/**
 * Apply the staged selection when its provider's key has just been saved.
 * Returns true when a selection was applied. A key saved for a different
 * provider leaves the staged selection untouched.
 */
export function completeModelAutoWire(
  provider: string,
  apply: (model: PendingModelWire) => void,
): boolean {
  if (!pending || pending.provider !== provider) return false
  const next = pending
  pending = undefined
  apply(next)
  return true
}
