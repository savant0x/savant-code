import { expect, test } from 'bun:test'

import { ContextCompactor } from '../context-compactor'

const isPromptTooLongError = ContextCompactor.isPromptTooLongError

const message =
  'This model configuration accepts at most 1048576 combined input and output tokens. However, your request has 112977 input tokens and asks for 943717 output tokens (1056694 tokens total). Please reduce the input length or requested output length.'

test('recorded combined-budget rejection reaches existing compaction recovery', () => {
  expect(isPromptTooLongError(new Error(message))).toBe(true)
  expect(isPromptTooLongError({ message, statusCode: 400 })).toBe(true)
  expect(
    isPromptTooLongError({
      message: 'Bad Request',
      responseBody: JSON.stringify({ error: { message } }),
    }),
  ).toBe(true)
})

test('exhausted local budget uses the existing context overflow code', () => {
  expect(
    isPromptTooLongError({
      code: 'context_length_exceeded',
      message: 'Request input leaves no output headroom',
    }),
  ).toBe(true)
  expect(
    isPromptTooLongError({
      message: 'max_tokens must be <= 131072',
      statusCode: 400,
    }),
  ).toBe(false)
  expect(
    isPromptTooLongError({ message: 'HTTP 429: retry later', statusCode: 429 }),
  ).toBe(false)
})
