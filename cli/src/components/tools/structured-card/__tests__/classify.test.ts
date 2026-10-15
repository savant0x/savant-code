import { describe, expect, test } from 'bun:test'

import {
  classifyPayload,
  isEmptyValue,
  scalarToDisplayString,
  summarizePayload,
  unwrapParts,
} from '../classify'

describe('classifyPayload (FID-2026-0822-014)', () => {
  test('error shape: string errorMessage wins over everything', () => {
    expect(classifyPayload({ errorMessage: 'boom' })).toBe('error')
    expect(
      classifyPayload({ errorMessage: 'boom', code: 7, results: [1] }),
    ).toBe('error')
  })

  test('success shape: string message with only scalar extras', () => {
    expect(classifyPayload({ message: 'done' })).toBe('success')
    expect(classifyPayload({ message: 'scanned', harvested: 3 })).toBe(
      'success',
    )
  })

  test('record shape: message plus non-scalar extras is NOT success', () => {
    expect(classifyPayload({ message: 'done', results: [{ file: 'a' }] })).toBe(
      'record',
    )
  })

  test('list shape', () => {
    expect(classifyPayload(['a', 'b'])).toBe('list')
    expect(classifyPayload([{ file: 'a.ts' }, { file: 'b.ts' }])).toBe('list')
  })

  test('empty shapes', () => {
    expect(classifyPayload(undefined)).toBe('empty')
    expect(classifyPayload(null)).toBe('empty')
    expect(classifyPayload('')).toBe('empty')
    expect(classifyPayload('   \n  ')).toBe('empty')
    expect(classifyPayload([])).toBe('list')
    expect(classifyPayload({})).toBe('record')
  })

  test('unknown shapes degrade to record (fail-open)', () => {
    expect(classifyPayload('plain text')).toBe('record')
    expect(classifyPayload(42)).toBe('record')
    expect(classifyPayload({ nested: { deep: true } })).toBe('record')
  })
})

describe('unwrapParts', () => {
  test('single json part unwraps to its value', () => {
    expect(unwrapParts([{ type: 'json', value: { message: 'x' } }])).toEqual({
      message: 'x',
    })
  })

  test('text part unwraps to its text', () => {
    expect(unwrapParts([{ type: 'text', text: 'hi' }])).toBe('hi')
  })

  test('multiple meaningful parts become a list', () => {
    expect(
      unwrapParts([
        { type: 'json', value: 'a' },
        { type: 'json', value: 'b' },
      ]),
    ).toEqual(['a', 'b'])
  })

  test('all-empty parts yield undefined', () => {
    expect(unwrapParts([])).toBeUndefined()
    expect(unwrapParts([{ type: 'json', value: null }])).toBeUndefined()
    expect(unwrapParts([{ type: 'text', text: '  ' }])).toBeUndefined()
    expect(unwrapParts(undefined)).toBeUndefined()
  })

  test('non-array payload passes through untouched', () => {
    const payload = { data: 1 }
    expect(unwrapParts(payload)).toEqual(payload)
  })
})

describe('summarizePayload / helpers', () => {
  test('error summary prefers errorMessage', () => {
    expect(summarizePayload({ errorMessage: 'boom', code: 7 })).toBe('boom')
  })

  test('success summary uses message', () => {
    expect(summarizePayload({ message: 'scanned', harvested: 3 })).toBe(
      'scanned',
    )
  })

  test('list summary reports count', () => {
    expect(summarizePayload([1, 2, 3])).toBe('3 items')
  })

  test('record summary renders first key: value pair', () => {
    expect(summarizePayload({ ledger: 'dev/YAGNI-LEDGER.md', z: 1 })).toBe(
      'ledger: dev/YAGNI-LEDGER.md',
    )
  })

  test('empty payload has no summary', () => {
    expect(summarizePayload(null)).toBeUndefined()
    expect(summarizePayload('')).toBeUndefined()
  })

  test('scalarToDisplayString degrades nested shapes to glyph counts', () => {
    expect(scalarToDisplayString({ a: 1 })).toBe('{…}')
    expect(scalarToDisplayString([1, 2])).toBe('[… 2]')
    expect(scalarToDisplayString('keep')).toBe('keep')
  })

  test('isEmptyValue covers null/blank/containers but not zero', () => {
    expect(isEmptyValue(null)).toBe(true)
    expect(isEmptyValue('')).toBe(true)
    expect(isEmptyValue([])).toBe(true)
    expect(isEmptyValue({})).toBe(true)
    expect(isEmptyValue(0)).toBe(false)
    expect(isEmptyValue(false)).toBe(false)
  })
})
