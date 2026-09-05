import {
  assistantMessage,
  systemMessage,
  userMessage,
} from '@savant-code/common/util/messages'
import { describe, expect, it } from 'bun:test'

import {
  messagesWithSystem,
  buildUserMessageContent,
} from '../../util/messages'

import type { TextPart } from '@savant-code/common/types/messages/content-part'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

/**
 * Type guard to check if a content part is a text part.
 */
function isTextPart(part: unknown): part is TextPart {
  return (
    typeof part === 'object' &&
    part !== null &&
    'type' in part &&
    part.type === 'text' &&
    'text' in part
  )
}

describe('messagesWithSystem', () => {
  it('prepends system message to array', () => {
    const messages = [userMessage('hello'), assistantMessage('hi')] as Message[]
    const system = 'Be helpful'

    const result = messagesWithSystem({ messages, system })

    // Use the original message objects to avoid flaky sentAt timestamp comparisons
    expect(result).toEqual([systemMessage('Be helpful'), ...messages])
  })
})

describe('buildUserMessageContent', () => {
  it('wraps prompt in user_message tags when no content provided', () => {
    const result = buildUserMessageContent('Hello world', undefined, undefined)

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('text')
    const firstPart = result[0]
    if (!isTextPart(firstPart)) throw new Error('Expected text part')
    expect(firstPart.text).toContain('<user_message>')
    expect(firstPart.text).toContain('Hello world')
  })

  it('wraps text content in user_message tags', () => {
    const result = buildUserMessageContent(undefined, undefined, [
      { type: 'text', text: 'Hello from content' },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('text')
    const firstPart = result[0]
    if (!isTextPart(firstPart)) throw new Error('Expected text part')
    expect(firstPart.text).toContain('<user_message>')
    expect(firstPart.text).toContain('Hello from content')
  })

  it('uses prompt when content has empty text part', () => {
    const result = buildUserMessageContent('See attached image(s)', undefined, [
      { type: 'text', text: '' },
      { type: 'image', image: 'base64data', mediaType: 'image/png' },
    ])

    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('text')
    const firstPart = result[0]
    if (!isTextPart(firstPart)) throw new Error('Expected text part')
    expect(firstPart.text).toContain('See attached image(s)')
    expect(result[1].type).toBe('image')
  })

  it('uses prompt when content has whitespace-only text part', () => {
    const result = buildUserMessageContent('See attached image(s)', undefined, [
      { type: 'text', text: '   ' },
      { type: 'image', image: 'base64data', mediaType: 'image/png' },
    ])

    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('text')
    const firstPart = result[0]
    if (!isTextPart(firstPart)) throw new Error('Expected text part')
    expect(firstPart.text).toContain('See attached image(s)')
    expect(result[1].type).toBe('image')
  })

  it('uses prompt when content has only images (no text part)', () => {
    const result = buildUserMessageContent('See attached image(s)', undefined, [
      { type: 'image', image: 'base64data', mediaType: 'image/png' },
    ])

    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('text')
    const firstPart = result[0]
    if (!isTextPart(firstPart)) throw new Error('Expected text part')
    expect(firstPart.text).toContain('See attached image(s)')
    expect(result[1].type).toBe('image')
  })

  it('uses content text when it has meaningful content (ignores prompt)', () => {
    const result = buildUserMessageContent(
      'This prompt should be ignored',
      undefined,
      [
        { type: 'text', text: 'User provided text' },
        { type: 'image', image: 'base64data', mediaType: 'image/png' },
      ],
    )

    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('text')
    const firstPart = result[0]
    if (!isTextPart(firstPart)) throw new Error('Expected text part')
    expect(firstPart.text).toContain('User provided text')
    expect(firstPart.text).not.toContain('This prompt should be ignored')
    expect(result[1].type).toBe('image')
  })

  it('ignores whitespace-only prompt when content has no text', () => {
    const result = buildUserMessageContent('   ', undefined, [
      { type: 'image', image: 'base64data', mediaType: 'image/png' },
    ])

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('image')
  })
})
