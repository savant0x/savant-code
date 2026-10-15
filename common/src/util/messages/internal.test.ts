import { describe, expect, it } from 'bun:test'

import { assistantMessage, userMessage } from './constructors'
import { filterInternalEchoMessages, isInternalEchoMessage } from './internal'

describe('internal ECHO message projection', () => {
  it('recognizes all internal ECHO tags without changing ordinary messages', () => {
    const refresh = userMessage({ content: 'refresh', tags: ['ECHO_REFRESH'] })
    const steering = userMessage({ content: 'steer', tags: ['ECHO_STEERING'] })
    const compliance = userMessage({
      content: 'compliance',
      tags: ['ECHO_COMPLIANCE'],
    })
    const ordinary = assistantMessage('answer')

    expect(isInternalEchoMessage(refresh)).toBe(true)
    expect(isInternalEchoMessage(steering)).toBe(true)
    expect(isInternalEchoMessage(compliance)).toBe(true)
    expect(isInternalEchoMessage(ordinary)).toBe(false)
    expect(filterInternalEchoMessages([refresh, ordinary])).toEqual([ordinary])
  })
})
