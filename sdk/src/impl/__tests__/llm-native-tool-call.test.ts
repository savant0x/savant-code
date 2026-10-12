import { InvalidToolInputError, JSONParseError, TypeValidationError } from 'ai'
import { expect, test } from 'bun:test'

import { normalizeNativeToolCallStreamError } from '../llm'
import { classifyInvalidToolCall } from '../llm/stream-error-chunk'

/**
 * FID-2026-1012-009: read the truncation flag off a classifier result without
 * widening the union — the unavailable-tool member never carries it.
 */
function truncatedFlag(
  result: ReturnType<typeof classifyInvalidToolCall>,
): boolean | undefined {
  return result?.errorClass === 'native-incomplete'
    ? result.argumentsTruncated
    : undefined
}

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

// FID-2026-1012-009: the vendor-SDK classification path cannot supply a finish
// reason, so a payload cut by the output budget was steered as if the model had
// written bad arguments. The classifier now marks structural truncation itself.
test('steers to split payloads when the arguments were cut mid-document', () => {
  const result = normalizeNativeToolCallStreamError({
    type: 'native-incomplete',
    toolName: 'read_files',
    argumentsTruncated: true,
  })

  expect(result?.message).toContain('cut off before they finished parsing')
  expect(result?.message).toContain('Split the work into smaller calls')
  expect(result?.message).not.toContain('retry the tool call')
  expect(result?.argumentsTruncated).toBe(true)
})

test('keeps retry guidance when nothing marks the payload as truncated', () => {
  const result = normalizeNativeToolCallStreamError({
    type: 'native-incomplete',
    toolName: 'read_files',
    argumentsTruncated: false,
  })

  expect(result?.message).toContain(
    'retry the tool call with a complete arguments object',
  )
  expect(result?.message).not.toContain('Split the work')
  expect(result?.argumentsTruncated).toBeUndefined()
})

test('rejects a hostile non-boolean truncation flag at the guard', () => {
  expect(
    normalizeNativeToolCallStreamError({
      type: 'native-incomplete',
      toolName: 'read_files',
      argumentsTruncated: 'yes',
    }),
  ).toBeNull()
})

test('classifies a JSON parse failure as a cut payload, not bad arguments', () => {
  const result = classifyInvalidToolCall({
    toolName: 'read_files',
    error: new InvalidToolInputError({
      toolName: 'read_files',
      toolInput: '{"filePaths":["a"',
      cause: new JSONParseError({
        text: '{"filePaths":["a"',
        cause: new SyntaxError('Unexpected end of JSON input'),
      }),
    }),
  })

  expect(truncatedFlag(result)).toBe(true)
  expect(result?.message).toContain('Split the work into smaller calls')
})

test('keeps the generic advice when arguments parsed but missed the schema', () => {
  const result = classifyInvalidToolCall({
    toolName: 'read_files',
    error: new InvalidToolInputError({
      toolName: 'read_files',
      toolInput: '{}',
      cause: new TypeValidationError({
        value: {},
        cause: new Error('filePaths is required'),
      }),
    }),
  })

  expect(truncatedFlag(result)).toBeUndefined()
  expect(result?.message).toContain(
    'retry the tool call with a complete arguments object',
  )
})

test('keeps the generic advice when the invalid call carries no cause', () => {
  const result = classifyInvalidToolCall({
    toolName: 'read_files',
    error: new InvalidToolInputError({
      toolName: 'read_files',
      toolInput: '{}',
      cause: undefined,
    }),
  })

  expect(truncatedFlag(result)).toBeUndefined()
  expect(result?.message).toContain(
    'retry the tool call with a complete arguments object',
  )
})
