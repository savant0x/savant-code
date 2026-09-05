// FID-2026-0905-004 RED characterization pins — injectTriggerRun.
//
// The gateway handle's trigger-injection seam (FID-2026-0824-005 step 2) had
// zero direct test coverage: its busy-guard, prompt-required rejection, and
// acknowledge-then-run ordering were only indirectly exercised through
// server-command wiring. These pins exercise the handle method directly
// through the same startTestGateway harness as the rest of the family,
// BEFORE the FID-2026-0905-004 decomposition extracts anything.
//
// The gateway never touches the real SDK client — runPrompt is injected.

import { describe, expect, test } from 'bun:test'

import { GATEWAY_PROTOCOL_VERSION } from '../json-rpc'
import {
  openSocket,
  request,
  startTestGateway,
  TEST_TOKEN,
} from './gateway-test-harness'

import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { RunState } from '@savant-code/sdk'

/** Poll until `condition` is true or the deadline passes (bun:test has no waitFor). */
async function until(
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 2000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!(await condition())) {
    if (Date.now() > deadline) {
      throw new Error('until(): condition not met before deadline')
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

function fakeSettledState(id: string): RunState {
  return {
    traceSessionId: id,
    output: {
      type: 'lastMessage',
      value: [{ role: 'assistant', content: [] }],
    },
  } as unknown as RunState
}

describe('gateway injectTriggerRun (FID-2026-0905-004 RED pins)', () => {
  test('busy-guard: rejected while a run is in flight (same guard as user_message)', async () => {
    let releaseRun: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      releaseRun = resolve
    })
    let inFlight = false
    const gw = await startTestGateway({
      runPrompt: async (params) => {
        inFlight = true
        await gate
        inFlight = false
        return fakeSettledState('run-1')
        void params
      },
    })
    try {
      const first = await gw.injectTriggerRun({
        prompt: 'first',
        source: 'trigger',
      })
      expect(first.accepted).toBe(true)
      await until(() => inFlight)

      const second = await gw.injectTriggerRun({
        prompt: 'second',
        source: 'trigger',
      })
      expect(second.accepted).toBe(false)
      expect(second.reason).toContain('already in flight')
    } finally {
      releaseRun?.()
      gw.stop()
    }
  })

  test('prompt-required: whitespace-only prompt rejected, no run dispatched', async () => {
    let runs = 0
    const gw = await startTestGateway({
      runPrompt: async () => {
        runs += 1
        return fakeSettledState('must-not-run')
      },
    })
    try {
      const result = await gw.injectTriggerRun({
        prompt: '   ',
        source: 'trigger',
      })
      expect(result.accepted).toBe(false)
      expect(result.reason).toBe('prompt required')
      // Drain microtasks: a wrongly dispatched fire-and-forget run would
      // have incremented the counter before this resolves.
      await new Promise((resolve) => setTimeout(resolve, 30))
      expect(runs).toBe(0)
    } finally {
      gw.stop()
    }
  })

  test('acknowledge-then-run: accepted before the run settles; failure never throws and clears the guard', async () => {
    let started = false
    const gw = await startTestGateway({
      runPrompt: async () => {
        started = true
        throw new Error('synthetic run failure')
      },
    })
    try {
      const result = await gw.injectTriggerRun({
        prompt: 'boom',
        source: 'trigger',
      })
      // The caller's resolution means "accepted", not "completed" — the run
      // settles out-of-band and its failure is logged, never thrown here.
      expect(result.accepted).toBe(true)
      expect(result.reason).toBeUndefined()
      await until(() => started)
      // The in-flight flag must clear even on failure (otherwise the
      // single-session guard would wedge the gateway shut).
      await until(async () => {
        const probe = await gw.injectTriggerRun({
          prompt: 'guard probe',
          source: 'trigger',
        })
        return probe.accepted
      })
    } finally {
      gw.stop()
    }
  })

  test('events stream through the normal batching path to authed sockets', async () => {
    const gw = await startTestGateway({
      runPrompt: async (params) => {
        params.onTextChunk('chunk-from-trigger-run')
        return fakeSettledState('trigger-run-1')
      },
    })
    try {
      const socket = await openSocket(gw.port)
      await request(
        socket,
        'hello',
        { protocolVersion: GATEWAY_PROTOCOL_VERSION, token: TEST_TOKEN },
        'hello-inject',
      )
      const accepted = await gw.injectTriggerRun({
        prompt: 'trigger directive',
        source: 'trigger',
      })
      expect(accepted.accepted).toBe(true)

      // The ~50ms flush interval delivers the chunk as a printModeText event.
      const deadline = Date.now() + 2000
      let sawChunk = false
      const frames: unknown[] = []
      socket.onMessage((event) => {
        frames.push(JSON.parse(String(event.data)))
        sawChunk =
          sawChunk ||
          frames.some((frame) => {
            const record = frame as { method?: string; params?: unknown }
            if (record.method !== 'event') return false
            return (record.params as unknown[])?.some(
              (entry) =>
                typeof entry === 'object' &&
                entry !== null &&
                (entry as { type?: string }).type === 'text' &&
                (entry as { text?: string }).text === 'chunk-from-trigger-run',
            )
          })
      })
      while (!sawChunk && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      expect(sawChunk).toBe(true)
      socket.close()
    } finally {
      gw.stop()
    }
  })

  test('continuation: a settled trigger run becomes lastRunState for the next run', async () => {
    type RunPrompt = (params: {
      prompt: string
      previousRun?: RunState
      signal: AbortSignal
      onEvent: (event: PrintModeEvent) => void
      onTextChunk: (chunk: string) => void
    }) => Promise<RunState>
    let impl: RunPrompt = async () => fakeSettledState('trigger-run-1')
    let sawPreviousRun: RunState | undefined
    const gw = await startTestGateway({
      runPrompt: async (params) => impl(params),
    })
    try {
      const first = await gw.injectTriggerRun({
        prompt: 'trigger directive',
        source: 'trigger',
      })
      expect(first.accepted).toBe(true)

      // Swap to a capturing impl, then keep injecting until one attempt is
      // ACCEPTED: rejections mean the first run is still in flight, so the
      // first accepted attempt IS the second run — with the settled first
      // run as its previousRun (the continuation under test).
      impl = async (params) => {
        sawPreviousRun = params.previousRun
        return fakeSettledState('user-run-1')
      }
      const deadline = Date.now() + 2000
      let settled = false
      while (!settled && Date.now() < deadline) {
        const attempt = await gw.injectTriggerRun({
          prompt: 'follow-up directive',
          source: 'trigger',
        })
        if (attempt.accepted) {
          await until(() => sawPreviousRun !== undefined)
          settled = true
        } else {
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
      }
      expect(settled).toBe(true)
      expect(sawPreviousRun?.traceSessionId).toBe('trigger-run-1')
    } finally {
      gw.stop()
    }
  })
})
