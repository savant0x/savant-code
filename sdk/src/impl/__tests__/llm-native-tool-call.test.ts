import { expect, test } from 'bun:test'

import { normalizeNativeToolCallStreamError } from '../llm'

test('normalizes a native incomplete provider error into a typed stream chunk', () => {
  const result = normalizeNativeToolCallStreamError({
    type: 'native-incomplete',
    toolName: 'sequentialthinking',
  })

  expect(result).toEqual({
    type: 'error',
    message:
      'Incomplete arguments for tool sequentialthinking; retry the tool call with a complete arguments object.',
    errorClass: 'native-incomplete',
    toolName: 'sequentialthinking',
  })
})

test('steers to split payloads on an output-cap hit (FID-2026-0909-008)', () => {
  const result = normalizeNativeToolCallStreamError({
    type: 'native-incomplete',
    toolName: 'write_file',
    finishReason: 'length',
  })

  expect(result?.message).toContain('output token limit was reached')
  expect(result?.message).toContain('Split the work into smaller calls')
  expect(result?.message).not.toContain('retry the tool call')
  expect(result?.finishReason).toBe('length')
})

test('keeps retry guidance when the finish reason is not a cap hit', () => {
  const result = normalizeNativeToolCallStreamError({
    type: 'native-incomplete',
    toolName: 'sequentialthinking',
    finishReason: 'stop',
  })

  expect(result?.message).toContain(
    'retry the tool call with a complete arguments object',
  )
  expect(result?.message).not.toContain('Split the work')
  expect(result?.finishReason).toBe('stop')
})

test('rejects a hostile non-string finish reason at the guard', () => {
  expect(
    normalizeNativeToolCallStreamError({
      type: 'native-incomplete',
      toolName: 'sequentialthinking',
      finishReason: 42,
    }),
  ).toBeNull()
})

test('rejects unclassified provider errors at the native recovery boundary', () => {
  expect(
    normalizeNativeToolCallStreamError({
      type: 'provider-failure',
      message: 'fatal provider stream failure',
    }),
  ).toBeNull()
})

test('does not expose raw incomplete argument fragments', () => {
  const result = normalizeNativeToolCallStreamError({
    type: 'native-incomplete',
    toolName: 'sequentialthinking',
    rawArguments: '{}',
  })

  expect(result?.message).not.toContain('{}')
  expect(JSON.stringify(result)).not.toContain('rawArguments')
})
