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
