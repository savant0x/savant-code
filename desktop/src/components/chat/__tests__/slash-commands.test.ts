import { describe, expect, test } from 'bun:test'

import {
  filterSlashCommands,
  findSlashCommand,
  slashQueryOf,
  SLASH_COMMANDS,
} from '../slash-commands'

// FID-2026-0820-010 Loop 10 — the palette's data layer is pure, so the
// open/filter/accept contract is pinned without a DOM harness.

describe('slash commands (Loop 10)', () => {
  test('the registry is non-empty and names are canonical', () => {
    expect(SLASH_COMMANDS.length).toBeGreaterThan(0)
    for (const command of SLASH_COMMANDS) {
      expect(command.name.startsWith('/')).toBe(true)
      expect(command.name).toBe(command.name.toLowerCase())
      expect(command.description.length).toBeGreaterThan(0)
    }
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
    expect(filterSlashCommands('')).toHaveLength(SLASH_COMMANDS.length)
    expect(filterSlashCommands('CL').map((command) => command.name)).toEqual([
      '/clear',
    ])
    expect(filterSlashCommands('ch').map((command) => command.name)).toEqual([
      '/chat',
    ])
    expect(filterSlashCommands('zzz')).toEqual([])
  })

  test('findSlashCommand exact-matches a submitted draft only', () => {
    expect(findSlashCommand('/clear')?.name).toBe('/clear')
    expect(findSlashCommand('  /CLEAR  ')?.name).toBe('/clear')
    expect(findSlashCommand('/clear extra')).toBeNull()
    expect(findSlashCommand('clear')).toBeNull()
  })
})
