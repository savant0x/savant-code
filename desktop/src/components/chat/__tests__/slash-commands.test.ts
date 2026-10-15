import { describe, expect, test } from 'bun:test'

import {
  LOCAL_COMMANDS,
  filterCommands,
  findCommand,
  mergeCommands,
  slashQueryOf,
} from '../slash-commands'

// FID-2026-0820-010 Loop 10 + FID-2026-0901-005 — the palette's data layer
// is pure, so the merge/filter/accept contract is pinned without a DOM.

const SERVER_REGISTRY = [
  { id: 'compact', description: 'compact context now', dispatch: 'agent' },
  { id: 'model', description: 'switch model', dispatch: 'agent' },
  { id: 'review', description: 'open review', dispatch: 'client' },
  { id: 'mode:plan', description: 'plan mode contract', dispatch: 'agent' },
] as const

describe('slash commands (merged registry, FID-2026-0901-005)', () => {
  test('local commands are non-empty and canonical', () => {
    expect(LOCAL_COMMANDS.length).toBeGreaterThan(0)
    for (const command of LOCAL_COMMANDS) {
      expect(command.name.startsWith('/')).toBe(true)
      expect(command.name).toBe(command.name.toLowerCase())
      expect(command.description.length).toBeGreaterThan(0)
    }
  })

  test('mergeCommands unions local + server with honest origins', () => {
    const registry = mergeCommands(SERVER_REGISTRY)
    const byName = new Map(registry.map((command) => [command.name, command]))
    // Local entries marked local.
    expect(byName.get('/deck')?.origin).toBe('local')
    expect(byName.get('/clear')?.origin).toBe('local')
    // Server agent-dispatch entries.
    expect(byName.get('/compact')?.origin).toBe('agent')
    expect(byName.get('/mode:plan')?.origin).toBe('agent')
    // Server TUI-only entries are honestly 'client', not faked.
    expect(byName.get('/review')?.origin).toBe('client')
    // Sorted by name for the palette.
    const names = registry.map((command) => command.name)
    expect([...names].sort()).toEqual(names)
  })

  test('local entries shadow same-named server entries', () => {
    const registry = mergeCommands([
      { id: 'clear', description: 'server clear', dispatch: 'agent' },
    ])
    const clear = registry.find((command) => command.name === '/clear')
    expect(clear?.origin).toBe('local')
    expect(clear?.description).toBe('clear the transcript')
  })

  test('slashQueryOf opens only on a leading slash before any space', () => {
    expect(slashQueryOf('/')).toBe('')
    expect(slashQueryOf('/cl')).toBe('cl')
    expect(slashQueryOf('/CLEAR')).toBe('CLEAR')
    expect(slashQueryOf('hello')).toBeNull()
    expect(slashQueryOf('/clear now')).toBeNull()
    expect(slashQueryOf('/clear\n')).toBeNull()
  })

  test('filter matches name prefixes case-insensitively; empty query lists all', () => {
    const registry = mergeCommands(SERVER_REGISTRY)
    expect(filterCommands(registry, '')).toHaveLength(registry.length)
    expect(
      filterCommands(registry, 'CL').map((command) => command.name),
    ).toEqual(['/clear'])
    expect(
      filterCommands(registry, 'compact').map((command) => command.name),
    ).toEqual(['/compact'])
    expect(filterCommands(registry, 'zzz')).toEqual([])
  })

  test('findCommand exact-matches a submitted draft only', () => {
    const registry = mergeCommands(SERVER_REGISTRY)
    expect(findCommand(registry, '/clear')?.name).toBe('/clear')
    expect(findCommand(registry, '  /CLEAR  ')?.name).toBe('/clear')
    expect(findCommand(registry, '/clear extra')).toBeNull()
    expect(findCommand(registry, 'clear')).toBeNull()
  })
})
