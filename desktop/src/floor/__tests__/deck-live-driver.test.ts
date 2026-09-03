// FID-2026-0824-011 — deck live event driver unit suite.
import { readFileSync } from 'node:fs'

import { printModeEventSchema } from '@savant-code/common/types/print-mode'
import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import { createDeckLiveDriver } from '../driver/deck-live-driver'

import type { DeckLiveDriverOptions } from '../driver/deck-live-driver'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

/** Recorded-shape tier-1 fixture, parsed through the LIVE union schema. */
function loadFixture(name: string): PrintModeEvent[] {
  const url = new URL(`../__fixtures__/tier-1/${name}`, import.meta.url)
  const raw: unknown = JSON.parse(readFileSync(url, 'utf8'))
  // Tier-1 fixtures mix shapes: single-event objects and arrays both occur.
  return Array.isArray(raw)
    ? z.array(printModeEventSchema).parse(raw)
    : [printModeEventSchema.parse(raw)]
}

/** DI fake for the gateway-client seam (no sockets, no module mocks). */
class FakeGatewayClient {
  listener: ((events: PrintModeEvent[]) => void) | null = null
  unsubscribeCount = 0

  onEvents(listener: (events: PrintModeEvent[]) => void): () => void {
    this.listener = listener
    return () => {
      this.unsubscribeCount += 1
    }
  }

  emit(events: PrintModeEvent[]): void {
    this.listener?.(events)
  }
}

describe('deck live driver (FID-2026-0824-011)', () => {
  test('folds gateway batches into an accumulating FloorState', () => {
    const client = new FakeGatewayClient()
    const driver = createDeckLiveDriver({
      client,
      now: () => 1000,
    } satisfies DeckLiveDriverOptions)
    try {
      expect(driver.getState().savantPresent).toBe(false)
      client.emit(loadFixture('orchestrator-turn.json'))
      // The fixture opens with `start` (Savant becomes present) and closes
      // with `finish` — FID-2026-0828-002: finish dissolves everything and
      // dims Savant, so the FULL fold leaves the floor idle again.
      expect(driver.getState().savantPresent).toBe(false)
      // Replay without the trailing finish: Savant must be present.
      const events = loadFixture('orchestrator-turn.json')
      client.emit(events.slice(0, -1))
      expect(driver.getState().savantPresent).toBe(true)
    } finally {
      driver.dispose()
    }
  })

  test('arrival clock fires exactly once per folded batch (MQ-M)', () => {
    const client = new FakeGatewayClient()
    let reads = 0
    const driver = createDeckLiveDriver({
      client,
      now: () => {
        reads += 1
        return 42_000
      },
    })
    try {
      client.emit(loadFixture('orchestrator-turn.json'))
      expect(reads).toBe(1)
      client.emit(loadFixture('walker-lifecycle.json'))
      expect(reads).toBe(2)
    } finally {
      driver.dispose()
    }
  })

  test('onChanged fires with the fresh state reference after each fold', () => {
    const client = new FakeGatewayClient()
    const seen: unknown[] = []
    const driver = createDeckLiveDriver({
      client,
      onChanged: (state) => seen.push(state),
    })
    try {
      client.emit(loadFixture('orchestrator-turn.json'))
      expect(seen).toHaveLength(1)
      expect(seen[0]).toBe(driver.getState())
    } finally {
      driver.dispose()
    }
  })

  test('empty batches are a no-op: state reference and onChanged untouched', () => {
    const client = new FakeGatewayClient()
    let changes = 0
    const driver = createDeckLiveDriver({
      client,
      onChanged: () => {
        changes += 1
      },
    })
    try {
      const before = driver.getState()
      client.emit([])
      expect(driver.getState()).toBe(before)
      expect(changes).toBe(0)
    } finally {
      driver.dispose()
    }
  })

  test('dispose unsubscribes once, is idempotent, and stops folding', () => {
    const client = new FakeGatewayClient()
    const driver = createDeckLiveDriver({ client })
    driver.dispose()
    expect(client.unsubscribeCount).toBe(1)
    driver.dispose()
    expect(client.unsubscribeCount).toBe(1)
    // Post-dispose emissions never reach the (already detached) listener.
    client.listener = null
    client.emit(loadFixture('orchestrator-turn.json'))
    expect(driver.getState().savantPresent).toBe(false)
  })
})

describe('deck live driver text snapshot (FID-2026-0831-002 P4)', () => {
  test('folds attributable text deltas into the bubble snapshot', () => {
    const client = new FakeGatewayClient()
    const driver = createDeckLiveDriver({
      client,
      now: () => 1000,
    } satisfies DeckLiveDriverOptions)
    try {
      expect(driver.getTextSnapshot()).toHaveLength(0)
      // walker-lifecycle.json opens with `start`, creates agent-detective-7
      // via `subagent_start`, then carries a `text` event for that agent.
      // The text is attributable because agent-detective-7 is a walker at
      // the time the text event is folded.
      client.emit(loadFixture('walker-lifecycle.json'))
      const snapshot = driver.getTextSnapshot()
      expect(snapshot.length).toBeGreaterThan(0)
      const bubble = snapshot.find(
        (entry) => entry.agentId === 'agent-detective-7',
      )
      expect(bubble).toBeDefined()
      expect(bubble?.text.length).toBeGreaterThan(0)
      expect(bubble?.text.length).toBeLessThanOrEqual(180)
      expect(bubble?.displayName.length).toBeGreaterThan(0)
    } finally {
      driver.dispose()
    }
  })

  test('drops text for unknown agentIds (honesty rule)', () => {
    const client = new FakeGatewayClient()
    const driver = createDeckLiveDriver({
      client,
      now: () => 1000,
    } satisfies DeckLiveDriverOptions)
    try {
      // orchestrator-turn.json carries `text` events attributed to
      // orchestrator-1, but `start` does NOT create a walker — only
      // `subagent_start` does. So orchestrator-1's text is unattributable
      // and must be dropped (honesty rule: never guess onto a character).
      client.emit(loadFixture('orchestrator-turn.json'))
      expect(driver.getTextSnapshot()).toHaveLength(0)
    } finally {
      driver.dispose()
    }
  })

  test('prunes expired bubbles against the batch arrival clock (MQ-M)', () => {
    const client = new FakeGatewayClient()
    let clock = 1000
    const driver = createDeckLiveDriver({
      client,
      now: () => clock,
    } satisfies DeckLiveDriverOptions)
    try {
      client.emit(loadFixture('walker-lifecycle.json'))
      expect(driver.getTextSnapshot().length).toBeGreaterThan(0)
      // Advance past BUBBLE_TTL_MS (12s) — the next fold prunes stale text.
      clock += 12_001
      client.emit(loadFixture('mixed-activity.json'))
      expect(driver.getTextSnapshot()).toHaveLength(0)
    } finally {
      driver.dispose()
    }
  })

  // P19 (operator: "when a agent is active/thinking, it should show a chat
  // bubble over that agent"): main-run text has NO agentId — it is the
  // orchestrator speaking, so it must land on the Savant centerpiece.
  describe('savant attribution of agentId-less text (P19)', () => {
    test('agentId-less text during a live run folds onto the Savant centerpiece', () => {
      const client = new FakeGatewayClient()
      const driver = createDeckLiveDriver({ client, now: () => 1000 })
      try {
        // `start` marks savantPresent; then a bare text chunk arrives.
        client.emit([
          { type: 'start', messageHistoryLength: 1 },
          { type: 'text', text: 'Investigating the codebase now' },
        ])
        const snapshot = driver.getTextSnapshot()
        expect(snapshot).toHaveLength(1)
        expect(snapshot[0]?.agentId).toBe('savant')
        expect(snapshot[0]?.roleId).toBe('savant')
        expect(snapshot[0]?.displayName).toBe('Savant')
        expect(snapshot[0]?.text).toContain('Investigating')
      } finally {
        driver.dispose()
      }
    })

    test('agentId-less text with no live run is dropped (honesty rule)', () => {
      const client = new FakeGatewayClient()
      const driver = createDeckLiveDriver({ client, now: () => 1000 })
      try {
        // No `start` — savantPresent stays false. Bare text must not be
        // guessed onto the centerpiece.
        client.emit([{ type: 'text', text: 'orphan chunk' }])
        expect(driver.getTextSnapshot()).toHaveLength(0)
      } finally {
        driver.dispose()
      }
    })

    test('an attributable agentId still wins over the savant fallback', () => {
      const client = new FakeGatewayClient()
      const driver = createDeckLiveDriver({ client, now: () => 1000 })
      try {
        client.emit([
          { type: 'start', messageHistoryLength: 1 },
          {
            type: 'subagent_start',
            agentId: 'agent-detective-9',
            agentType: 'detective',
            displayName: 'Detective',
            onlyChild: false,
          },
          {
            type: 'text',
            agentId: 'agent-detective-9',
            text: 'Detective speaking, not Savant',
          },
        ])
        const snapshot = driver.getTextSnapshot()
        expect(snapshot).toHaveLength(1)
        expect(snapshot[0]?.agentId).toBe('agent-detective-9')
        expect(snapshot[0]?.roleId).toBe('detective')
      } finally {
        driver.dispose()
      }
    })
  })
})
