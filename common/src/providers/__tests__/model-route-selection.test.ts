import { afterEach, describe, expect, test } from 'bun:test'

import {
  captureModelRoute,
  resolveModelRoute,
  routeForModelReplacement,
} from '../model-route'

const originalEndpoint = process.env.INFERENCE_BASE_URL

afterEach(() => {
  if (originalEndpoint === undefined) delete process.env.INFERENCE_BASE_URL
  else process.env.INFERENCE_BASE_URL = originalEndpoint
})

describe('selected transport owns model routing', () => {
  test('a deliberate model replacement captures its own serving prefix', () => {
    process.env.INFERENCE_BASE_URL = 'https://operator.invalid/v1'
    expect(
      routeForModelReplacement('anthropic/claude-sonnet-4.5')?.providerId,
    ).toBe('anthropic')
  })
  test('a nested vendor id retains the selected gateway', () => {
    delete process.env.INFERENCE_BASE_URL
    expect(
      resolveModelRoute('anthropic/claude-sonnet-4.5', undefined, 'nous')
        ?.providerId,
    ).toBe('nous')
  })

  test('prefix inference remains available without a selected transport', () => {
    delete process.env.INFERENCE_BASE_URL
    expect(
      resolveModelRoute('anthropic/claude-sonnet-4.5', undefined, '')
        ?.providerId,
    ).toBe('anthropic')
  })

  test('a custom endpoint never acquires an inferred provider credential', () => {
    process.env.INFERENCE_BASE_URL = 'https://operator.invalid/v1'
    expect(
      resolveModelRoute('anthropic/claude-sonnet-4.5', undefined, 'nous'),
    ).toBeUndefined()
    expect(
      resolveModelRoute('anthropic/claude-sonnet-4.5', undefined, ''),
    ).toBeUndefined()
  })

  test('an explicit route wins over both ambient selection and model text', () => {
    process.env.INFERENCE_BASE_URL = 'https://operator.invalid/v1'
    const route = captureModelRoute('nous')
    expect(
      resolveModelRoute('anthropic/claude-sonnet-4.5', route, 'anthropic'),
    ).toEqual(route)
  })
})
