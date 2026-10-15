// FID-2026-1012-017 Loop 6: a rejection must name a field the model can fix.
// Measured 2026-10-13T05:08Z — 17 duplicate rejections of one `suggest_followups`
// call inside a single response, every one answered with advice that named no
// field, so nothing in the message could change the next emission. Split out of
// `llm-native-tool-call.test.ts` to keep that suite inside the 300-line ceiling.
import { InvalidToolInputError, JSONParseError, TypeValidationError } from 'ai'
import { expect, test } from 'bun:test'
import { z } from 'zod/v4'

import { normalizeNativeToolCallStreamError } from '../llm'
import { classifyInvalidToolCall } from '../llm/stream-error-chunk'

const suggestFollowupsSchema = z.object({
  followups: z.array(z.object({ prompt: z.string(), label: z.string() })),
})

test('names the field the tool schema rejected', () => {
  const invalid: unknown = { followups: [{ label: 'x' }] }
  const parsed = suggestFollowupsSchema.safeParse(invalid)
  if (parsed.success) throw new Error('fixture must fail the schema')

  const result = classifyInvalidToolCall({
    toolName: 'suggest_followups',
    error: new InvalidToolInputError({
      toolName: 'suggest_followups',
      toolInput: JSON.stringify(invalid),
      cause: TypeValidationError.wrap({ value: invalid, cause: parsed.error }),
    }),
  })

  expect(result?.message).toContain(
    'failed the tool schema at: followups[0].prompt',
  )
  expect(result?.message).toContain('invalid_type')
  // The action the model is asked to take is unchanged; only the target is named.
  expect(result?.message).toContain(
    'Correct the argument values so they satisfy the tool schema',
  )
  // FID-2026-1012-017 (Loop 8): the cause travels on the chunk too, so the
  // runtime selects cause-correct steering instead of appending size advice to
  // a message that says the payload arrived and was refused.
  if (result?.errorClass !== 'native-incomplete') {
    throw new Error('the schema failure must classify as native-incomplete')
  }
  expect(result.schemaIssue).toBe(
    'followups[0].prompt — invalid_type (expected string)',
  )
})

test('never carries the received value into the recovery text', () => {
  const secret = 'zz-secret-value-zz'
  const invalid: unknown = { followups: [{ prompt: secret }] }
  const parsed = suggestFollowupsSchema.safeParse(invalid)
  if (parsed.success) throw new Error('fixture must fail the schema')

  const result = classifyInvalidToolCall({
    toolName: 'suggest_followups',
    error: new InvalidToolInputError({
      toolName: 'suggest_followups',
      toolInput: JSON.stringify(invalid),
      cause: TypeValidationError.wrap({ value: invalid, cause: parsed.error }),
    }),
  })

  // The Zod issue's own free-text message embeds the received value; the
  // classifier reads the issue PATH and CODE instead, so nothing model-authored
  // (which may be a credential the model copied) reaches the message or the
  // ledger's first line.
  expect(result?.message).toContain('followups[0].label')
  expect(result?.message).not.toContain(secret)
  expect(JSON.stringify(result)).not.toContain(secret)
})

test('keeps the generic advice when the validation failure is unreadable', () => {
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

  expect(result?.message).not.toContain('failed the tool schema at')
  expect(result?.message).toContain(
    'Correct the argument values so they satisfy the tool schema',
  )
})

test('a cut payload never claims a schema issue', () => {
  const result = classifyInvalidToolCall({
    toolName: 'read_files',
    error: new InvalidToolInputError({
      toolName: 'read_files',
      toolInput: '{"paths":["a"',
      cause: new JSONParseError({
        text: '{"paths":["a"',
        cause: new SyntaxError('Unexpected end of JSON input'),
      }),
    }),
  })

  expect(result?.message).toContain('Split the work into smaller calls')
  expect(result?.message).not.toContain('failed the tool schema at')
  // FID-2026-1012-017: the two causes stay exclusive on the chunk as well — a
  // cut payload carries the truncation marker and can name no issue, so the
  // runtime keeps its size steering for this one.
  if (result?.errorClass !== 'native-incomplete') {
    throw new Error('a cut payload must classify as native-incomplete')
  }
  expect(result.argumentsTruncated).toBe(true)
  expect(result.schemaIssue).toBeUndefined()
})

test('rejects a hostile non-string schema issue at the guard', () => {
  expect(
    normalizeNativeToolCallStreamError({
      type: 'native-incomplete',
      toolName: 'read_files',
      schemaIssue: 7,
    }),
  ).toBeNull()
})
