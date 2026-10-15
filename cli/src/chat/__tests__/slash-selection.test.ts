import { describe, expect, test } from 'bun:test'

import { getSelectedSlashCommand } from '../slash-selection'

const matches = [
  { id: 'mode', label: 'mode', description: 'mode' },
  { id: 'model', label: 'model', description: 'model' },
] as const

describe('getSelectedSlashCommand', () => {
  test('returns the selected current match', () => {
    expect(getSelectedSlashCommand([...matches], 1)?.id).toBe('model')
  })

  test('does not fall back to the first command for a stale index', () => {
    expect(getSelectedSlashCommand([...matches], 8)).toBeUndefined()
    expect(getSelectedSlashCommand([...matches], -1)).toBeUndefined()
  })
})
