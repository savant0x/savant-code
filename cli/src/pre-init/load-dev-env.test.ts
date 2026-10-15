import { afterEach, describe, expect, test } from 'bun:test'

import { applyBinaryEnvValues } from './load-dev-env'

const originalEnv = { ...process.env }

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key]
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('release env.json precedence', () => {
  const releaseEnv = {
    DIRECT_PROVIDER: 'openrouter',
    INFERENCE_BASE_URL: 'https://openrouter.ai/api/v1',
    SAVANT_CODE_DEFAULT_MODEL_ID: 'openrouter/free',
    NEXT_PUBLIC_SAVANT_CODE_APP_URL: 'https://savant-code.com',
  }

  test('loads the OpenRouter release defaults when no routing override exists', () => {
    const target: NodeJS.ProcessEnv = {}

    applyBinaryEnvValues(releaseEnv, target)

    expect(target).toMatchObject(releaseEnv)
  })

  test('preserves a complete custom routing pair atomically', () => {
    const target: NodeJS.ProcessEnv = {
      DIRECT_PROVIDER: 'tokenharbor',
      INFERENCE_BASE_URL: 'https://tokenharbor.ai/v1',
    }

    applyBinaryEnvValues(releaseEnv, target)

    expect(target.DIRECT_PROVIDER).toBe('tokenharbor')
    expect(target.INFERENCE_BASE_URL).toBe('https://tokenharbor.ai/v1')
    expect(target.SAVANT_CODE_DEFAULT_MODEL_ID).toBe('openrouter/free')
  })

  test('does not combine a partial routing override with OpenRouter defaults', () => {
    const target: NodeJS.ProcessEnv = { DIRECT_PROVIDER: 'tokenharbor' }

    applyBinaryEnvValues(releaseEnv, target)

    expect(target.DIRECT_PROVIDER).toBe('tokenharbor')
    expect(target.INFERENCE_BASE_URL).toBeUndefined()
  })

  test('release client values remain authoritative over shell values', () => {
    const target: NodeJS.ProcessEnv = {
      NEXT_PUBLIC_SAVANT_CODE_APP_URL: 'http://localhost:3000',
    }

    applyBinaryEnvValues(releaseEnv, target)

    expect(target.NEXT_PUBLIC_SAVANT_CODE_APP_URL).toBe(
      'https://savant-code.com',
    )
  })
})
