import { describe, expect, test } from 'bun:test'

import { formatToolOutput } from '../../../../utils/savant-code-client'

/**
 * FID-2026-0822-014 export-path byte-equivalence pins.
 *
 * The display layer moved to shape-detected structured cards, but
 * `formatToolOutput` still serializes the copy/export transcript paths —
 * it must remain byte-identical. These pins are the fixture corpus from the
 * FID's characterization step (success / error / list / nested / text).
 */
describe('formatToolOutput export-path byte pins', () => {
  test('success record serializes as YAML key rows', () => {
    expect(
      formatToolOutput([
        { type: 'json', value: { message: 'scanned', harvested: 3 } },
      ]),
    ).toBe('message: scanned\nharvested: 3')
  })

  test('error values surface the raw errorMessage line', () => {
    expect(
      formatToolOutput([{ type: 'json', value: { errorMessage: 'boom' } }]),
    ).toBe('boom')
  })

  test('arrays serialize as dash lists with the leading newline', () => {
    expect(formatToolOutput([{ type: 'json', value: ['a', 'b'] }])).toBe(
      '\n- a\n- b',
    )
  })

  test('nested objects indent two spaces per level under a bare key', () => {
    expect(
      formatToolOutput([{ type: 'json', value: { outer: { inner: 1 } } }]),
    ).toBe('outer:\n  inner: 1')
  })

  test('text parts pass through verbatim', () => {
    expect(formatToolOutput([{ type: 'text', text: '# heading\nbody' }])).toBe(
      '# heading\nbody',
    )
  })

  test('plain string output passes through untouched', () => {
    expect(formatToolOutput('raw')).toBe('raw')
  })

  test('empty containers keep their machine tokens in the EXPORT path', () => {
    expect(formatToolOutput([{ type: 'json', value: [] }])).toBe('[]')
    expect(formatToolOutput([{ type: 'json', value: {} }])).toBe('{}')
    expect(formatToolOutput([{ type: 'json', value: null }])).toBe('null')
  })
})
