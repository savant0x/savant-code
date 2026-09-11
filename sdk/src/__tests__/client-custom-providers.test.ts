// SavantCodeClient custom-provider registration (FID-2026-0910-004 Step 4,
// D4 lifecycle): the constructor registers a valid set, replaces on
// re-registration, never clears on omission, and throws fail-closed on
// invalid data without corrupting prior state.

import {
  getEffectiveProviderRegistry,
  registerCustomProviders,
  resetCustomProviders,
} from '@savant-code/common/providers/custom-providers'
import { afterEach, describe, expect, test } from 'bun:test'

import { SavantCodeClient } from '../client'

import type { CustomProviderConfig } from '@savant-code/common/providers/types'

const VALID: CustomProviderConfig = {
  id: 'my-gateway',
  label: 'My Gateway',
  baseUrl: 'https://gw.example.com/v1',
  apiKeyEnvVar: 'MY_GW_KEY',
  catalog: { source: 'none' },
}

describe('SavantCodeClient customProviders (FID-2026-0910-004 Step 4)', () => {
  afterEach(() => {
    resetCustomProviders()
  })

  test('constructor without customProviders preserves an existing registration', () => {
    registerCustomProviders([VALID])
    new SavantCodeClient({ apiKey: 'test-key' })
    expect(getEffectiveProviderRegistry()['my-gateway']).toBeDefined()
  })

  test('constructor with a valid set registers it (D4 replace semantics)', () => {
    registerCustomProviders([VALID])
    new SavantCodeClient({
      apiKey: 'test-key',
      customProviders: [
        {
          id: 'second-gw',
          label: 'Second',
          baseUrl: 'https://two.example.com/v1',
          apiKeyEnvVar: 'SECOND_GW_KEY',
          catalog: { source: 'none' },
        },
      ],
    })
    expect(getEffectiveProviderRegistry()['my-gateway']).toBeUndefined()
    expect(getEffectiveProviderRegistry()['second-gw']).toBeDefined()
  })

  test('construction with invalid data throws and leaves prior state untouched', () => {
    registerCustomProviders([VALID])
    expect(
      () =>
        new SavantCodeClient({
          apiKey: 'test-key',
          customProviders: [
            {
              id: 'openrouter', // built-in shadow — rejected fail-closed
              label: 'Impostor',
              baseUrl: 'https://evil.example.com/v1',
              apiKeyEnvVar: 'EVIL_KEY',
              catalog: { source: 'none' },
            },
          ],
        }),
    ).toThrow()
    // Prior registration intact.
    expect(getEffectiveProviderRegistry()['my-gateway']).toBeDefined()
    expect(getEffectiveProviderRegistry()['openrouter']).toBeDefined()
  })
})
