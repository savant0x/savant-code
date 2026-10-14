import { describe, expect, test } from 'bun:test'

import {
  asBoolean,
  asPositiveInt,
  renderToolInput,
  renderToolOutput,
  toolDisplayName,
  truncateSingleLine,
} from '../tool-display'

// FID-2026-1013-011 Wave 2 — the consolidated primitives' contract. Each
// block pins the behavior the removed duplicates had, plus the parity fix the
// wave exists for (stringified `sequentialthinking` fields).

describe('toolDisplayName (W2-1)', () => {
  test('Title-Cases snake_case identifiers', () => {
    expect(toolDisplayName('read_files')).toBe('Read Files')
    expect(toolDisplayName('run_terminal_command')).toBe('Run Terminal Command')
    expect(toolDisplayName('str_replace')).toBe('Str Replace')
  })

  test('applies the list_directory override', () => {
    expect(toolDisplayName('list_directory')).toBe('List Directories')
  })

  test('strips an MCP server__tool namespace before Title-Casing', () => {
    expect(toolDisplayName('filesystem__read_file')).toBe('Read File')
    expect(toolDisplayName('github__list_issues')).toBe('List Issues')
  })

  test('an override wins over namespace stripping (CLI lookup order)', () => {
    expect(toolDisplayName('list_directory')).toBe('List Directories')
  })

  test('an identifier with no underscores is still capitalized', () => {
    expect(toolDisplayName('glob')).toBe('Glob')
    expect(toolDisplayName('')).toBe('')
  })
})

describe('truncateSingleLine (W2-2)', () => {
  test('collapses whitespace runs into one trimmed line', () => {
    expect(truncateSingleLine('  a \n\t b   c  ')).toBe('a b c')
  })

  test('caps at the 160-character default, ellipsis included', () => {
    const long = 'x'.repeat(200)
    const capped = truncateSingleLine(long)
    expect(capped).toHaveLength(160)
    expect(capped.endsWith('…')).toBe(true)
  })

  test('honors a caller-supplied cap (desktop header passes 120)', () => {
    const capped = truncateSingleLine('y'.repeat(200), 120)
    expect(capped).toHaveLength(120)
    expect(capped).toBe(`${'y'.repeat(119)}…`)
  })

  test('a line exactly at the cap is returned unchanged', () => {
    const exact = 'z'.repeat(160)
    expect(truncateSingleLine(exact)).toBe(exact)
  })
})

describe('renderToolInput (W2-3)', () => {
  test('returns an empty string for absent or empty input', () => {
    expect(renderToolInput(null)).toBe('')
    expect(renderToolInput(undefined)).toBe('')
    expect(renderToolInput({})).toBe('')
    expect(renderToolInput([])).toBe('')
  })

  test('pretty-prints a JSON input with two-space indentation', () => {
    expect(renderToolInput({ a: 1 })).toBe('{\n  "a": 1\n}')
    expect(renderToolInput([1, 2])).toBe('[\n  1,\n  2\n]')
  })

  test('degrades to String() instead of throwing on a circular value', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(renderToolInput(circular)).toBe('[object Object]')
  })
})

describe('renderToolOutput (W2-3)', () => {
  test('pretty-prints a JSON envelope and tags it as json', () => {
    expect(renderToolOutput('[{"type":"text","text":"hi"}]')).toEqual({
      body: '[\n  {\n    "type": "text",\n    "text": "hi"\n  }\n]',
      lang: 'json',
    })
  })

  test('keeps non-JSON text raw with no fence language', () => {
    expect(renderToolOutput('plain output')).toEqual({
      body: 'plain output',
      lang: '',
    })
    expect(renderToolOutput('{ not json')).toEqual({
      body: '{ not json',
      lang: '',
    })
  })
})

describe('asPositiveInt / asBoolean (W2-5)', () => {
  test('accepts integers >= 1 and rejects zero, negatives, and fractions', () => {
    expect(asPositiveInt(3)).toBe(3)
    expect(asPositiveInt(0)).toBeUndefined()
    expect(asPositiveInt(-1)).toBeUndefined()
    expect(asPositiveInt(2.5)).toBeUndefined()
    expect(asPositiveInt(undefined)).toBeUndefined()
    expect(asPositiveInt(null)).toBeUndefined()
  })

  test('coerces stringified integers (print-mode payload parity)', () => {
    expect(asPositiveInt('3')).toBe(3)
    expect(asPositiveInt('0')).toBeUndefined()
    expect(asPositiveInt('3.5')).toBeUndefined()
    expect(asPositiveInt('abc')).toBeUndefined()
  })

  test('coerces booleans and their stringified forms only', () => {
    expect(asBoolean(true)).toBe(true)
    expect(asBoolean(false)).toBe(false)
    expect(asBoolean('true')).toBe(true)
    expect(asBoolean('false')).toBe(false)
    expect(asBoolean(1)).toBeUndefined()
    expect(asBoolean('yes')).toBeUndefined()
    expect(asBoolean(undefined)).toBeUndefined()
  })
})
