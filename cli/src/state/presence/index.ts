import { useChatStore } from '../chat-store'
import { resolveActiveModel } from '../savant-free-model-store'
import { PresenceService } from './presence-ipc'
import { createPresencePipeline, subscribeToPresence } from './presence-wire'

import type { PresenceRawState } from './presence-privacy'

/**
 * FID-2026-0818-009: presence service singleton + boot/exit lifecycle.
 *
 * A single in-process `PresenceService`. The boot hook is non-blocking and
 * silent: when Discord is absent the service stays dormant and polls the
 * socket. The client id is hardcoded (`SAVANT_DISCORD_CLIENT_ID`), not
 * operator-configurable (feature-theft guard, 2026-08-18). Process exit runs
 * `shutdownPresence` so no ghost activity survives the session.
 */

const services = new Map<string, PresenceService>()

/** Keep the subscription handle so tests/boot can tear it down. */
let activeSubscription: (() => void) | null = null

export function getPresenceService(clientId: string): PresenceService {
  let service = services.get(clientId)
  if (!service) {
    service = new PresenceService(clientId)
    services.set(clientId, service)
  }
  return service
}

/**
 * Map the current chat-store snapshot into the raw presence shape. This is the
 * ONLY bridge from the Zustand store into the presence pipeline — every field
 * is redacted downstream. `model` is the ACTIVE LLM MODEL (single source of
 * truth: the model store, not the mode); `mode` is the execution mode
 * (HYBRID/STRICT/SCAFFOLD/ANALYZE) and is surfaced separately as a mode
 * overlay. Both are still sanitized before any transport write.
 */
export function buildStoreSnapshot(): PresenceRawState {
  const store = useChatStore.getState()
  const activity = store.activity
  const agent = [...store.agentStack].reverse().find((entry) => entry.isActive)
  const drive = store.runState?.sessionState?.mainAgentState?.drive
  return {
    cwd: process.cwd(),
    model: resolveActiveModel(),
    mode: store.agentMode,
    phase: store.fsmPhase || 'idle',
    agentId: agent?.id ?? null,
    activityKind: activity?.kind ?? null,
    toolName: activity?.kind === 'tool' ? activity.toolName : null,
    activityAgentType:
      activity?.kind === 'subagent' ? activity.agentType : null,
    activeFid: drive?.activeFid ?? null,
  }
}

/** Boot: connect + subscribe the store to the pipeline, unless disabled. */
export function bootPresence(
  enabled: boolean,
  clientId: string | undefined,
): PresenceService | null {
  if (!enabled || !clientId) return null
  const service = getPresenceService(clientId)
  void service.connect()
  const pipeline = createPresencePipeline({
    sink: service,
    startTimestamp: Date.now(),
  })
  activeSubscription?.()
  activeSubscription = subscribeToPresence(
    buildStoreSnapshot,
    (fn) => useChatStore.subscribe(fn),
    pipeline,
  )
  return service
}

/** Process exit: clear + close every service (no ghost presence). */
export async function shutdownPresence(): Promise<void> {
  await Promise.all([...services.values()].map((service) => service.stop()))
}
