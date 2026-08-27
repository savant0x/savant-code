// FID-2026-0820-010 Loop 3 — minimal typed listener registry (Law 13: one
// universal subscription utility shared by the gateway client's three event
// surfaces). Unsubscribe functions are stable and idempotent.

export type Unsubscribe = () => void

export class ListenerSet<T> {
  private readonly listeners: Array<(value: T) => void> = []

  add(listener: (value: T) => void): Unsubscribe {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index >= 0) this.listeners.splice(index, 1)
    }
  }

  emit(value: T): void {
    for (const listener of this.listeners) listener(value)
  }
}
