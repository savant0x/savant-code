/**
 * Pins for the Law 6 scan-surface stripper (FID-2026-1013-012 W3-4): comments
 * and string-literal contents are blanked so the English word "any" in prose
 * cannot false-positive the scanner, while template-literal `${...}`
 * interpolations stay scannable and line structure survives.
 */
import { describe, expect, it } from 'bun:test'

import { stripCommentsAndStrings } from '../code-surface-stripper'

describe('stripCommentsAndStrings', () => {
  it('blanks line and block comments while keeping line structure', () => {
    const source = 'const a = 1 // any\n/* any\nany */\nexport const b = 2\n'
    const stripped = stripCommentsAndStrings(source)

    expect(stripped).not.toContain('any')
    expect(stripped.split('\n').length).toBe(source.split('\n').length)
    expect(stripped).toContain('const a = 1')
    expect(stripped).toContain('export const b = 2')
  })

  it('blanks string literal contents but keeps the code around them', () => {
    const stripped = stripCommentsAndStrings(
      'const m = "Could not find any files"\nconst n = \'any\'\n',
    )

    expect(stripped).not.toContain('any')
    expect(stripped).toContain('const m =')
    expect(stripped).toContain('const n =')
  })

  it('preserves template literal interpolations for scanning', () => {
    const stripped = stripCommentsAndStrings(
      'const t = `text any ${value as any}`\n',
    )

    expect(stripped).toContain('${')
    expect(stripped).toContain('as any')
    expect(stripped).not.toContain('text any')
  })

  it('handles escaped quotes without desynchronizing state', () => {
    const stripped = stripCommentsAndStrings(
      'const s = "a \\"any\\" b"\nexport const t = 1\n',
    )

    expect(stripped).not.toContain('any')
    expect(stripped).toContain('export const t = 1')
  })

  it('masks regex prose without hiding a real type after a quoted regex', () => {
    expect(stripCommentsAndStrings('const pattern = /any/;')).not.toContain(
      'any',
    )
    expect(
      stripCommentsAndStrings('const pattern = /"/; let value: any = 1;'),
    ).toContain(': any')
  })

  it('preserves division, nested templates and TypeScript assertion code', () => {
    const source =
      'const ratio = numerator / denominator; const text = `outer ${`inner ${value as any}`} any`; const cast = <any>value;'
    const stripped = stripCommentsAndStrings(source)
    expect(stripped).toContain('numerator / denominator')
    expect(stripped).toContain('as any')
    expect(stripped).toContain('<any>value')
    expect(stripped).not.toContain('inner ')
  })

  it('preserves TSX expression code, CRLF positions and source length', () => {
    const source =
      'const node = <div title="any">{value as any}</div>;\r\nconst pattern = /["/]/;\r\n'
    const stripped = stripCommentsAndStrings(source, 'view.tsx')
    expect(stripped).toHaveLength(source.length)
    expect(stripped.split('\r\n')).toHaveLength(source.split('\r\n').length)
    expect(stripped).toContain('as any')
    expect(stripped).not.toContain('"any"')
  })
})
