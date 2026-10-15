import { describe, expect, it } from 'bun:test'

import { PresenceService } from '../presence-ipc'
import { TokenBucket } from '../presence-selector'
import { createPresencePipeline, subscribeToPresence } from '../presence-wire'

import type { PresenceClientLike } from '../presence-ipc'
import type { PresencePayload } from '../presence-privacy'

describe('presence pipeline', () => {
  const raw = {
    cwd: '/home/dev/projects/api',
    model: 'claude-3-5-sonnet',
    mode: 'HYBRID',
    phase: 'red',
    agentId: 'detective',
    activityKind: null,
    toolName: null,
    activityAgentType: null,
    activeFid: 'FID-2026-0819-042-fix-jwt.md',
  }

  it('dispatches on the first snapshot only, then skips identical deltas', () => {
    const dispatched: PresencePayload[] = []
    const pipeline = createPresencePipeline({
      sink: { update: (p) => void dispatched.push(p) },
      startTimestamp: 1,
      bucket: new TokenBucket(5, 4000, 0),
    })
    pipeline.push(raw)
    pipeline.push(raw)
    expect(dispatched).toHaveLength(1)
    expect(dispatched[0].details).toBe(
      'Project: api · Model: claude-3-5-sonnet',
    )
    expect(dispatched[0].largeImageKey).toBe('agent_detective')
  })

  it('neutralizes a path-leaking snapshot before it reaches the sink', () => {
    const dispatched: PresencePayload[] = []
    const pipeline = createPresencePipeline({
      sink: { update: (p) => void dispatched.push(p) },
      startTimestamp: 1,
      bucket: new TokenBucket(5, 4000, 0),
    })
    pipeline.push({ ...raw, cwd: '/etc/passwd/root', model: 'a/b' })
    expect(dispatched).toHaveLength(1)
    // The sanitizer reduced the path to its basename and trimmed the model to
    // its last segment — no `/` or `\` survives to the transport.
    expect(dispatched[0].details).toBe('Project: root · Model: b')
    expect(dispatched[0].details).not.toContain('/')
    expect(dispatched[0].details).not.toContain('\\')
  })
})

describe('subscribeToPresence', () => {
  it('ticks immediately and unsubscribes', () => {
    const dispatched: PresencePayload[] = []
    const pipeline = createPresencePipeline({
      sink: { update: (p) => void dispatched.push(p) },
      startTimestamp: 1,
    })
    const subscriptions: Array<() => void> = []
    const unsubscribe = subscribeToPresence(
      () => ({
        cwd: '/home/dev/api',
        model: 'm',
        mode: 'HYBRID',
        phase: 'idle',
        agentId: null,
        activityKind: null,
        toolName: null,
        activityAgentType: null,
        activeFid: null,
      }),
      (fn) => {
        subscriptions.push(fn)
        return () => {}
      },
      pipeline,
    )
    expect(dispatched).toHaveLength(1)
    expect(subscriptions).toHaveLength(1)
    expect(typeof unsubscribe).toBe('function')
  })
})

describe('PresenceService state machine', () => {
  function makeFakeClient() {
    const listeners: Record<string, () => void> = {}
    const calls: string[] = []
    const fake: PresenceClientLike = {
      on: (event, listener) => {
        listeners[event] = listener
      },
      login: async () => {
        calls.push('login')
      },
      destroy: async () => {
        calls.push('destroy')
      },
      user: {
        setActivity: async () => {
          calls.push('setActivity')
          return {}
        },
        clearActivity: async () => {
          calls.push('clearActivity')
        },
      },
    }
    return {
      fake,
      calls,
      emitReady: () => listeners['ready']?.(),
      emitDisconnected: () => listeners['disconnected']?.(),
    }
  }

  it('connects → ready → update → disable → clear/destroy', async () => {
    const { fake, calls, emitReady } = makeFakeClient()
    const service = new PresenceService('id', undefined, () => fake)
    await service.connect()
    expect(service.getState()).toBe('connecting')
    emitReady()
    expect(service.getState()).toBe('ready')
    await service.update({ details: 'x', state: 'y', startTimestamp: 1 })
    expect(calls).toContain('setActivity')
    await service.disable()
    expect(calls).toContain('clearActivity')
    expect(calls).toContain('destroy')
    expect(service.getState()).toBe('disabled')
  })

  it('drops to dormant on disconnect without throwing', async () => {
    const { fake, emitReady, emitDisconnected } = makeFakeClient()
    const service = new PresenceService('id', undefined, () => fake)
    await service.connect()
    emitReady()
    emitDisconnected()
    expect(service.getState()).toBe('dropped')
  })

  it('stays dormant when login throws (silent failure)', async () => {
    const service = new PresenceService('id', undefined, () => ({
      on: () => {},
      login: async () => {
        throw new Error('ENOENT')
      },
      destroy: async () => {},
    }))
    await service.connect()
    expect(service.getState()).toBe('dormant')
  })
})
