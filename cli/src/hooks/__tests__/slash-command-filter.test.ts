import { describe, expect, test } from 'bun:test'

import { SLASH_COMMANDS } from '../../data/slash-commands'
import { filterSlashCommands } from '../suggestion-engine/filters'

describe('filterSlashCommands exact ranking', () => {
  test('ranks the exact model command before broader model matches', () => {
    const matches = filterSlashCommands(SLASH_COMMANDS, 'model')

    expect(matches[0]?.id).toBe('model')
    expect(matches.some((command) => command.id === 'mode')).toBe(false)
  })

  test('keeps bare mode distinct from model', () => {
    const modeMatches = filterSlashCommands(SLASH_COMMANDS, 'mode')
    const modelMatches = filterSlashCommands(SLASH_COMMANDS, 'model')

    expect(modeMatches[0]?.id).toBe('mode')
    expect(modelMatches[0]?.id).toBe('model')
  })

  test('preserves generated mode aliases for explicit mode queries', () => {
    const matches = filterSlashCommands(SLASH_COMMANDS, 'model:hybrid')

    expect(matches.some((command) => command.id === 'mode:hybrid')).toBe(true)
  })

  test('keeps the exact command first through incremental model queries', () => {
    const queries = ['m', 'mo', 'mod', 'model']
    const firstMatches = queries.map(
      (query) => filterSlashCommands(SLASH_COMMANDS, query)[0]?.id,
    )

    expect(firstMatches[0]).toBeDefined()
    expect(firstMatches[1]).toBe('mode')
    expect(firstMatches[2]).toBe('mode')
    expect(firstMatches[3]).toBe('model')
  })
})
