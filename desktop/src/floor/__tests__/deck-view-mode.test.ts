import { describe, expect, test } from 'bun:test'

import {
  DECK_VIEW_STORAGE_KEY,
  loadDeckViewMode,
  parseDeckViewMode,
  saveDeckViewMode,
} from '../deck-view-mode'

import type { ViewModeStorage } from '../deck-view-mode'

class MemoryStorage implements ViewModeStorage {
  private readonly map = new Map<string, string>()

  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
}

describe('deck view-mode persistence (FID-2026-0822-012 P1)', () => {
  test('round-trips a saved mode through injected storage', () => {
    const storage = new MemoryStorage()
    saveDeckViewMode('deck', storage)
    expect(loadDeckViewMode(storage)).toBe('deck')
    expect(storage.getItem(DECK_VIEW_STORAGE_KEY)).toBe('deck')
  })

  test('falls back to chat on invalid stored payloads', () => {
    const storage = new MemoryStorage()
    storage.setItem(DECK_VIEW_STORAGE_KEY, 'holodeck')
    expect(loadDeckViewMode(storage)).toBe('chat')
    expect(parseDeckViewMode(42)).toBe('chat')
    expect(parseDeckViewMode(null)).toBe('chat')
    expect(parseDeckViewMode('deck')).toBe('deck')
  })

  test('missing storage degrades to chat and saves are no-ops', () => {
    expect(loadDeckViewMode(null)).toBe('chat')
    expect(() => {
      saveDeckViewMode('deck', null)
    }).not.toThrow()
  })

  test('throwing storage reads and writes are contained', () => {
    const throwing: ViewModeStorage = {
      getItem() {
        throw new Error('quota')
      },
      setItem() {
        throw new Error('quota')
      },
    }
    expect(loadDeckViewMode(throwing)).toBe('chat')
    expect(() => {
      saveDeckViewMode('deck', throwing)
    }).not.toThrow()
  })
})
