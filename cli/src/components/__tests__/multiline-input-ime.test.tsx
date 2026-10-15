// MultilineInput test family — Chinese/IME character input handling.
// Sibling of the Loop 321 decomposition (shared helpers in
// ./multiline-input-key-utils).
//
// Chinese characters (and other CJK characters) are multi-byte UTF-8 sequences
// that come from Input Method Editors (IME). The component must accept these
// characters even though key.sequence.length > 1. Rejection cases live in
// ./multiline-input-ime-reject.test.tsx.

import { describe, test, expect } from 'bun:test'

import {
  shouldAcceptCharacterInput,
  getPrintableKeySequence,
} from './multiline-input-key-utils'

describe('MultilineInput - Chinese/IME character input', () => {
  test('accepts single Chinese character (你)', () => {
    const key = {
      sequence: '你',
      name: undefined,
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(true)
  })

  test('accepts Chinese phrase (你好)', () => {
    const key = {
      sequence: '你好',
      name: undefined,
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(true)
  })

  test('accepts longer Chinese text (你好世界)', () => {
    const key = {
      sequence: '你好世界',
      name: undefined,
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(true)
  })

  test('accepts Japanese hiragana (あいうえお)', () => {
    const key = {
      sequence: 'あいうえお',
      name: undefined,
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(true)
  })

  test('accepts Japanese kanji (日本語)', () => {
    const key = {
      sequence: '日本語',
      name: undefined,
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(true)
  })

  test('accepts Korean characters (한글)', () => {
    const key = {
      sequence: '한글',
      name: undefined,
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(true)
  })

  test('accepts emoji characters (😀🎉)', () => {
    const key = {
      sequence: '😀🎉',
      name: undefined,
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(true)
  })

  test('accepts space key (name="space")', () => {
    const key = {
      sequence: ' ',
      name: 'space',
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(true)
  })

  test('accepts single ASCII character (a)', () => {
    const key = {
      sequence: 'a',
      name: undefined,
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(true)
  })

  test('accepts Kitty keyboard numpad digit names', () => {
    const key = {
      sequence: '\x1b[57400u',
      name: 'kp1',
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(getPrintableKeySequence(key)).toBe('1')
  })

  test('accepts raw application keypad digit sequences', () => {
    const key = {
      sequence: '\x1bOq',
      name: '',
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(getPrintableKeySequence(key)).toBe('1')
  })

  test('accepts raw application keypad operator sequences', () => {
    const key = {
      sequence: '\x1bOk',
      name: '',
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(getPrintableKeySequence(key)).toBe('+')
  })

  test('accepts mixed Chinese and ASCII (Hello你好)', () => {
    const key = {
      sequence: 'Hello你好',
      name: undefined,
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(true)
  })

  test('accepts Arabic characters (مرحبا)', () => {
    const key = {
      sequence: 'مرحبا',
      name: undefined,
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(true)
  })

  test('accepts Thai characters (สวัสดี)', () => {
    const key = {
      sequence: 'สวัสดี',
      name: undefined,
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(true)
  })

  test('accepts Russian/Cyrillic characters (Привет)', () => {
    const key = {
      sequence: 'Привет',
      name: undefined,
      ctrl: false,
      meta: false,
      option: false,
    }

    expect(shouldAcceptCharacterInput(key)).toBe(true)
  })
})
