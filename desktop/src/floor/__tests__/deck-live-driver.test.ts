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
      // The orchestrator-turn fixture opens with the session start event,
      // which seats the Savant console unit in the adapter.
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
