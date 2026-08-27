import { describe, expect, it } from 'bun:test'

import {
  maskAutoraterOrigin,
  parseForcedChoice,
  runBoundedAutorater,
} from '../src/raters/autorater'

describe('bounded governance autorater', () => {
  it('masks project and path origin before invoking the process', async () => {
    let captured = ''
    const result = await runBoundedAutorater(
      {
        rubric: 'Savant-Code FID-2026-0824-017',
        candidateA: 'C:\\Users\\dev\\savant-code\\a.ts',
        candidateB: 'clean response',
        timeoutMs: 100,
      },
      async (request) => {
        captured = `${request.rubric}|${request.candidateA}`
        return 'A: deterministic'
      },
      100,
    )

    expect(result.choice).toBe('A')
    expect(captured).toContain('[PROJECT]')
    expect(captured).toContain('[FID]')
    expect(captured).toContain('[PATH]')
  })

  it('parses only categorical A/B outputs', () => {
    expect(parseForcedChoice('B: weaker')).toEqual({
      choice: 'B',
      rationale: 'weaker',
    })
    expect(() => parseForcedChoice('probably A')).toThrow(
      'non-categorical response',
    )
  })

  it('times out a bounded process', async () => {
    await expect(
      runBoundedAutorater(
        {
          rubric: 'rubric',
          candidateA: 'a',
          candidateB: 'b',
          timeoutMs: 10,
        },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 50))
          return 'A'
        },
        10,
      ),
    ).rejects.toThrow('Autorater timeout')
  })

  it('masks known origins without changing ordinary text', () => {
    expect(maskAutoraterOrigin('ordinary response')).toBe('ordinary response')
  })
})
