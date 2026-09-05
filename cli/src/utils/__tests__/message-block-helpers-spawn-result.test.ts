// Message-block-helpers test family — extractSpawnAgentResultContent over
// every agent output shape. Sibling of the Loop 319 decomposition.

import { describe, expect, test } from 'bun:test'

import { extractSpawnAgentResultContent } from '../message-block-helpers'

describe('extractSpawnAgentResultContent', () => {
  test('returns string value directly', () => {
    const result = extractSpawnAgentResultContent('Simple result')
    expect(result).toEqual({ content: 'Simple result', hasError: false })
  })

  test('extracts error message', () => {
    const result = extractSpawnAgentResultContent({
      errorMessage: 'Something went wrong',
    })
    expect(result).toEqual({
      content: 'Something went wrong',
      hasError: true,
    })
  })

  test('extracts nested value string', () => {
    const result = extractSpawnAgentResultContent({
      type: 'lastMessage',
      value: 'Nested value',
    })
    expect(result).toEqual({ content: 'Nested value', hasError: false })
  })

  test('extracts message field', () => {
    const result = extractSpawnAgentResultContent({
      message: 'Message content',
    })
    expect(result).toEqual({ content: 'Message content', hasError: false })
  })

  test('falls back to formatted output for unknown structure', () => {
    const result = extractSpawnAgentResultContent({ unknownField: 123 })
    expect(result.hasError).toBe(false)
    expect(result.content).toContain('unknownField')
  })

  test('handles null value', () => {
    const result = extractSpawnAgentResultContent(null)
    expect(result.hasError).toBe(false)
  })

  test('handles undefined value', () => {
    const result = extractSpawnAgentResultContent(undefined)
    expect(result.hasError).toBe(false)
  })

  test('extracts text from lastMessage output mode with Message array', () => {
    // This is the format returned by agents with outputMode: 'last_message'
    const result = extractSpawnAgentResultContent({
      type: 'lastMessage',
      value: [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Here are the research findings:' },
            { type: 'text', text: ' Important information found.' },
          ],
        },
      ],
    })
    expect(result).toEqual({
      content: 'Here are the research findings: Important information found.',
      hasError: false,
    })
  })

  test('extracts text from multiple assistant messages in lastMessage output', () => {
    const result = extractSpawnAgentResultContent({
      type: 'lastMessage',
      value: [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'First message' }],
        },
        {
          role: 'tool',
          content: [{ type: 'json', value: {} }],
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Second message' }],
        },
      ],
    })
    expect(result).toEqual({
      content: 'First message\nSecond message',
      hasError: false,
    })
  })

  test('handles lastMessage with empty content array', () => {
    const result = extractSpawnAgentResultContent({
      type: 'lastMessage',
      value: [
        {
          role: 'assistant',
          content: [],
        },
      ],
    })
    expect(result).toEqual({ content: '', hasError: false })
  })

  test('handles lastMessage with no assistant messages', () => {
    const result = extractSpawnAgentResultContent({
      type: 'lastMessage',
      value: [
        {
          role: 'tool',
          content: [{ type: 'json', value: {} }],
        },
      ],
    })
    expect(result).toEqual({ content: '', hasError: false })
  })

  test('handles allMessages output mode', () => {
    const result = extractSpawnAgentResultContent({
      type: 'allMessages',
      value: [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'First response' }],
        },
        {
          role: 'user',
          content: [{ type: 'text', text: 'Follow up' }],
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Second response' }],
        },
      ],
    })
    expect(result).toEqual({
      content: 'First response\nSecond response',
      hasError: false,
    })
  })

  test('handles structuredOutput with message field', () => {
    const result = extractSpawnAgentResultContent({
      type: 'structuredOutput',
      value: { message: 'Structured output message' },
    })
    expect(result).toEqual({
      content: 'Structured output message',
      hasError: false,
    })
  })

  test('uses an empty structuredOutput message as no display content', () => {
    const result = extractSpawnAgentResultContent({
      type: 'structuredOutput',
      value: {
        message: '',
        results: [
          {
            stdout: 'Found 1 match\n./file.ts:\nLine 1: needle',
            message: 'Exit code: 0',
          },
        ],
      },
    })

    expect(result).toEqual({ content: '', hasError: false })
  })
})
