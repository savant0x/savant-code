interface EventSource {
  on: (event: string, listener: () => void) => object
  off: (event: string, listener: () => void) => object
}

interface SharedEvent {
  callbacks: Set<() => void>
  dispatch: () => void
}

const sources = new WeakMap<EventSource, Map<string, SharedEvent>>()

/** Share native subscriptions while retaining independent consumer lifetimes. */
export function subscribeSharedEvent(
  source: EventSource,
  event: string,
  callback: () => void,
): () => void {
  let events = sources.get(source)
  if (!events) {
    events = new Map()
    sources.set(source, events)
  }
  let shared = events.get(event)
  if (!shared) {
    const callbacks = new Set<() => void>()
    const dispatch = () => {
      for (const listener of [...callbacks]) {
        if (callbacks.has(listener)) listener()
      }
    }
    source.on(event, dispatch)
    shared = { callbacks, dispatch }
    events.set(event, shared)
  }
  const listener = () => callback()
  shared.callbacks.add(listener)
  return () => {
    if (!shared.callbacks.delete(listener)) return
    if (shared.callbacks.size === 0) {
      source.off(event, shared.dispatch)
      events.delete(event)
      if (events.size === 0) sources.delete(source)
    }
  }
}
