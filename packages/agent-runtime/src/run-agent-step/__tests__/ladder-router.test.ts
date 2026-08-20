import { describe, expect, it } from 'bun:test'

import { classifyFailure, rungLabel } from '../ladder-router'

const fresh = { iterationCount: 0, budgetExhausted: false }

describe('classifyFailure', () => {
  it('maps each failure kind to its natural rung', () => {
    expect(classifyFailure({ kind: 'mechanical' }, fresh)).toBe(1)
    expect(classifyFailure({ kind: 'verdict' }, fresh)).toBe(2)
    expect(classifyFailure({ kind: 'recurrence' }, fresh)).toBe(3)
    expect(classifyFailure({ kind: 'discovery' }, fresh)).toBe(4)
    expect(classifyFailure({ kind: 'spec-gap' }, fresh)).toBe(5)
    expect(classifyFailure({ kind: 'context' }, fresh)).toBe(6)
    expect(classifyFailure({ kind: 'terminal' }, fresh)).toBe(7)
  })

  it('escals to terminal on budget exhaustion', () => {
    expect(
      classifyFailure(
        { kind: 'verdict' },
        { iterationCount: 0, budgetExhausted: true },
      ),
    ).toBe(7)
  })

  it('escals to terminal at the iteration cap', () => {
    expect(
      classifyFailure(
        { kind: 'verdict' },
        { iterationCount: 10, budgetExhausted: false },
      ),
    ).toBe(7)
  })

  it('escals recurrence to terminal only after 3 strikes', () => {
    expect(
      classifyFailure({ kind: 'recurrence', consecutiveOccurrences: 2 }, fresh),
    ).toBe(3)
    expect(
      classifyFailure({ kind: 'recurrence', consecutiveOccurrences: 3 }, fresh),
    ).toBe(7)
  })

  it('labels every rung', () => {
    expect(rungLabel(7)).toBe('terminal-block')
    expect(rungLabel(1)).toBe('mechanical-retry')
  })
})
