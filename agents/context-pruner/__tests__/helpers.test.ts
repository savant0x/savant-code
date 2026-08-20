/**
 * Tests for context-pruner pure helper functions.
 * These are embedded into the generated self-contained source via .toString(),
 * so they must remain pure and dependency-free.
 */
import { describe, expect, it } from 'bun:test'

import {
  truncateLongText,
  getTextContent,
  asNumber,
  asString,
  asObject,
  asAnswerList,
  asAgentResultList,
  asTodoList,
} from '../helpers'

import type { Message } from '../../types/util-types'

describe('truncateLongText', () => {
  it('returns the original text when within limit', () => {
    expect(truncateLongText('short text', 100)).toBe('short text')
  })

  it('truncates long text with 80% prefix and 20% suffix', () => {
    const text = 'a'.repeat(1000)
    const result = truncateLongText(text, 100)
    expect(result).toContain('[...truncated')
    expect(result).toContain('chars...]')
    expect(result.length).toBeLessThan(text.length)
  })

  it('preserves the beginning of the text', () => {
    const prefix = 'START_MARKER_'
    const text = prefix + 'x'.repeat(200)
    // Limit must exceed the 50-char truncation notice + prefix to preserve it
    const result = truncateLongText(text, 200)
    expect(result.startsWith(prefix)).toBe(true)
  })

  it('preserves the end of the text', () => {
    const suffix = '_END_MARKER'
    const text = 'x'.repeat(200) + suffix
    const result = truncateLongText(text, 50)
    expect(result.endsWith(suffix)).toBe(true)
  })
})

describe('getTextContent', () => {
  it('returns string content directly', () => {
    const msg: Message = {
      role: 'user',
      content: [{ type: 'text', text: 'hello world' }],
    }
    expect(getTextContent(msg)).toBe('hello world')
  })

  it('extracts text parts from array content', () => {
    const msg: Message = {
      role: 'user',
      content: [
        { type: 'text', text: 'part one' },
        { type: 'text', text: 'part two' },
      ],
    }
    expect(getTextContent(msg)).toBe('part one\npart two')
  })

  it('ignores non-text parts in array content', () => {
    const msg: Message = {
      role: 'user',
      content: [
        { type: 'text', text: 'visible' },
        { type: 'image', image: 'data:image/png;base64,abc' },
      ],
    }
    expect(getTextContent(msg)).toBe('visible')
  })

  it('returns empty string for empty content', () => {
    const msg: Message = {
      role: 'user',
      content: [{ type: 'text', text: '' }],
    }
    expect(getTextContent(msg)).toBe('')
  })
})

describe('asNumber', () => {
  it('returns the value for numbers', () => {
    expect(asNumber(42)).toBe(42)
    expect(asNumber(0)).toBe(0)
    expect(asNumber(-3.14)).toBe(-3.14)
  })

  it('returns null for non-numbers', () => {
    expect(asNumber('42')).toBeNull()
    expect(asNumber(null)).toBeNull()
    expect(asNumber({})).toBeNull()
  })
})

describe('asString', () => {
  it('returns the value for strings', () => {
    expect(asString('hello')).toBe('hello')
    expect(asString('')).toBe('')
  })

  it('returns undefined for non-strings', () => {
    expect(asString(42)).toBeUndefined()
    expect(asString(null)).toBeUndefined()
  })
})

describe('asObject', () => {
  it('returns the object for plain objects', () => {
    const obj = { key: 'value' }
    expect(asObject(obj)).toEqual({ key: 'value' })
  })

  it('returns undefined for arrays', () => {
    expect(asObject([1, 2, 3])).toBeUndefined()
  })

  it('returns undefined for null and primitives', () => {
    expect(asObject(null)).toBeUndefined()
    expect(asObject('string')).toBeUndefined()
    expect(asObject(42)).toBeUndefined()
  })
})

describe('asAnswerList', () => {
  it('extracts selectedOption answers', () => {
    const result = asAnswerList([
      { selectedOption: 'option-a' },
      { selectedOptions: ['opt-1', 'opt-2'] },
      { otherText: 'custom input' },
    ])
    expect(result).toBeDefined()
    expect(result!).toHaveLength(3)
    expect(result![0].selectedOption).toBe('option-a')
    expect(result![1].selectedOptions).toEqual(['opt-1', 'opt-2'])
    expect(result![2].otherText).toBe('custom input')
  })

  it('returns undefined for non-array input', () => {
    expect(asAnswerList('not-an-array')).toBeUndefined()
    expect(asAnswerList(null)).toBeUndefined()
  })

  it('returns undefined for empty valid arrays', () => {
    expect(asAnswerList([])).toBeUndefined()
  })

  it('skips non-object entries', () => {
    const result = asAnswerList(['string', 42, { selectedOption: 'valid' }])
    expect(result).toBeDefined()
    expect(result!).toHaveLength(1)
  })
})

describe('asAgentResultList', () => {
  it('extracts agent results with names and values', () => {
    const result = asAgentResultList([
      { agentType: 'detective', value: { value: 'found issues' } },
      { agentName: 'custom-agent', value: { type: 'text', value: 'output' } },
    ])
    expect(result).toBeDefined()
    expect(result!).toHaveLength(2)
    expect(result![0].agentType).toBe('detective')
    expect(result![0].value?.value).toBe('found issues')
  })

  it('returns undefined for non-array input', () => {
    expect(asAgentResultList('invalid')).toBeUndefined()
  })

  it('returns an empty array for empty input', () => {
    // asAgentResultList returns the result array directly (even if empty);
    // callers filter on the output, not a null check.
    expect(asAgentResultList([])).toEqual([])
  })

  it('handles entries with missing value', () => {
    const result = asAgentResultList([{ agentType: 'scout' }])
    expect(result).toBeDefined()
    expect(result!).toHaveLength(1)
    expect(result![0].value).toBeUndefined()
  })
})

describe('asTodoList', () => {
  it('extracts todo items with task and completed status', () => {
    const result = asTodoList([
      { task: 'write tests', completed: true },
      { task: 'fix bugs', completed: false },
    ])
    expect(result).toBeDefined()
    expect(result!).toHaveLength(2)
    expect(result![0].task).toBe('write tests')
    expect(result![0].completed).toBe(true)
    expect(result![1].completed).toBe(false)
  })

  it('returns undefined for non-array input', () => {
    expect(asTodoList('not-array')).toBeUndefined()
  })

  it('skips entries without a task string', () => {
    const result = asTodoList([
      { completed: true },
      { task: 'valid task', completed: false },
    ])
    expect(result).toBeDefined()
    expect(result!).toHaveLength(1)
    expect(result![0].task).toBe('valid task')
  })
})
