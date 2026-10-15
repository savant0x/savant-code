// FID-2026-0901-006 P14 — write_todos checklist parser tests (CLI parity).

import { describe, expect, test } from 'bun:test'

import { parseTodosInput, todosPreview } from '../todos-parse'

describe('parseTodosInput', () => {
  test('extracts task/completed items', () => {
    const payload = parseTodosInput(
      JSON.stringify([
        { task: 'one', completed: true },
        { task: 'two', completed: false },
      ]),
    )
    expect(payload).not.toBeNull()
    expect(payload?.items).toEqual([
      { task: 'one', completed: true },
      { task: 'two', completed: false },
    ])
  })

  test('rejects malformed payloads (Law 14 fail-safe)', () => {
    expect(parseTodosInput(null)).toBeNull()
    expect(parseTodosInput('{"task":"x"}')).toBeNull()
    expect(parseTodosInput(JSON.stringify([]))).toBeNull()
    expect(
      parseTodosInput(JSON.stringify([{ task: 'x', completed: 'yes' }])),
    ).toBeNull()
  })
})

describe('todosPreview', () => {
  test('formats done/total', () => {
    expect(
      todosPreview({
        items: [
          { task: 'a', completed: true },
          { task: 'b', completed: true },
          { task: 'c', completed: false },
        ],
      }),
    ).toBe('2/3 todos')
  })
})
