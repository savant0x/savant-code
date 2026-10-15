import { describe, expect, it } from 'bun:test'

import {
  diagnoseMissingEdit,
  MAX_DIAGNOSTIC_SNIPPET,
  renderMissingEditDiagnosis,
} from '../edit-diagnostics'

const content = [
  'export function demo() {',
  '  const value = 1',
  '  return value',
  '}',
].join('\n')

describe('diagnoseMissingEdit', () => {
  it('reports a verbatim line as the candidate when the block differs', () => {
    const diagnosis = diagnoseMissingEdit({
      content,
      oldStr: '    const value = 1\n    return value\n  }',
    })
    expect(diagnosis.classification).toBe('partial-line-match')
    expect(diagnosis.candidateLine).toBe(2)
    expect(diagnosis.candidateText).toBe('const value = 1')
    expect(diagnosis.fileLines).toBe(4)
    expect(diagnosis.fileChars).toBe(content.length)
  })

  it('classifies a whitespace-only difference when no contiguous block matches', () => {
    const diagnosis = diagnoseMissingEdit({
      content,
      oldStr: 'const value=1;return value;',
    })
    expect(diagnosis.classification).toBe('no-near-match')

    const spaced = diagnoseMissingEdit({
      content: 'const   value\n= 1',
      oldStr: 'const value = 1',
    })
    expect(spaced.classification).toBe('whitespace-only-difference')
  })

  it('classifies a genuinely absent target without inventing a candidate', () => {
    const diagnosis = diagnoseMissingEdit({
      content,
      oldStr: 'this line exists nowhere',
    })
    expect(diagnosis.classification).toBe('no-near-match')
    expect(diagnosis.candidateLine).toBeUndefined()
  })

  it('bounds the candidate snippet', () => {
    const long = 'x'.repeat(MAX_DIAGNOSTIC_SNIPPET + 50)
    const diagnosis = diagnoseMissingEdit({
      content: long,
      oldStr: `${long}\nsecond line`,
    })
    expect(diagnosis.candidateText?.length).toBeLessThanOrEqual(
      MAX_DIAGNOSTIC_SNIPPET + 1,
    )
    expect(diagnosis.candidateText?.endsWith('…')).toBe(true)
  })

  it('redacts an entire credential before bounding its candidate snippet', () => {
    const secret = `sk-${'a'.repeat(MAX_DIAGNOSTIC_SNIPPET + 50)}`
    const diagnosis = diagnoseMissingEdit({
      content: secret,
      oldStr: `${secret}\nabsent`,
    })
    expect(diagnosis.candidateText).toBe('[REDACTED]')
    expect(renderMissingEditDiagnosis(diagnosis)).not.toContain('sk-')
  })
})

describe('renderMissingEditDiagnosis', () => {
  it('names the cause, the candidate and the repair action on its own lines', () => {
    const rendered = renderMissingEditDiagnosis(
      diagnoseMissingEdit({
        content,
        oldStr: '    const value = 1\n    return value',
      }),
    )
    const lines = rendered.split('\n')
    expect(lines[0]).toStartWith('Why: a line of your old string appears')
    expect(lines[1]).toBe('Closest line 2: "const value = 1"')
    expect(lines[2]).toContain('read_files offset/limit')
  })

  it('omits the candidate line when there is none', () => {
    const rendered = renderMissingEditDiagnosis(
      diagnoseMissingEdit({ content, oldStr: 'absent target' }),
    )
    expect(rendered).not.toContain('Closest line')
    expect(rendered).toContain('no line of your old string appears')
  })
})
