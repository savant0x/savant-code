// MultilineInput test family — key events that must NOT be inserted:
// special keys, modifier combinations, empty/undefined sequences, and C0
// control characters. Sibling of the Loop 321 decomposition (shared helpers
// in ./multiline-input-key-utils).

import { describe, test, expect } from 'bun:test'

import { shouldAcceptCharacterInput } from './multiline-input-key-utils'

describe('MultilineInput - rejected key events', () => {
  test('rejects arrow key (up)', () => {
    const key = {
      sequence: '\x1b[A',
      name: 'up',
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(false)
  })

  test('rejects function key (f1)', () => {
    const key = {
      sequence: '\x1bOP',
      name: 'f1',
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(false)
  })

  test('rejects backspace key', () => {
    const key = {
      sequence: '\x7f',
      name: 'backspace',
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(false)
  })

  test('rejects enter key', () => {
    const key = {
      sequence: '\r',
      name: 'return',
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(false)
  })

  test('rejects escape key', () => {
    const key = {
      sequence: '\x1b',
      name: 'escape',
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(false)
  })

  test('rejects input with ctrl modifier', () => {
    const key = {
      sequence: '你',
      name: undefined,
      ctrl: true,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(false)
  })

  test('rejects input with meta modifier', () => {
    const key = {
      sequence: '你',
      name: undefined,
      ctrl: false,
      meta: true,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(false)
  })

  test('rejects input with option modifier', () => {
    const key = {
      sequence: '你',
      name: undefined,
      ctrl: false,
      meta: false,
      option: true,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(false)
  })

  test('rejects empty sequence', () => {
    const key = {
      sequence: '',
      name: undefined,
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(false)
  })

  test('rejects undefined sequence', () => {
    const key = {
      sequence: undefined,
      name: undefined,
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(false)
  })

  test('rejects control character (null byte)', () => {
    const key = {
      sequence: '\x00',
      name: undefined,
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(false)
  })

  test('rejects control character (bell)', () => {
    const key = {
      sequence: '\x07',
      name: undefined,
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(false)
  })
})
