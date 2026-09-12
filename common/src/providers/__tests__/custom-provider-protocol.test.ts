import { describe, expect, test } from 'bun:test'

import {
  parseCustomProviders,
  toProviderConfig,
} from '@savant-code/common/providers/custom-providers'

import type { CustomProviderConfig } from '@savant-code/common/providers/types'

/**
 * FID-2026-0911-003 — custom-provider protocol-field pins (RED first).
 * Uses the REAL validation entry point (`parseCustomProviders`) — the
 * protocol field must survive the fail-closed parse like every other
 * field.
 */

const validEntry = {
  id: 'outlier',
  label: 'Outlier Gateway',
  baseUrl: 'https://outlier.example/v1',
  apiKeyEnvVar: 'OUTLIER_API_KEY',
  catalog: { source: 'none' },
}

describe('custom provider protocol field (FID-2026-0911-003)', () => {
  test('protocol is optional; legacy records parse clean and lift to openai', () => {
    const parsed = parseCustomProviders({ customProviders: [validEntry] })
    expect(parsed.problems).toEqual([])
    expect(parsed.configs[0]?.protocol).toBeUndefined()
    const lifted = toProviderConfig(parsed.configs[0] as CustomProviderConfig)
    expect(lifted.protocol).toBe('openai')
  })

  test('an explicit anthropic protocol parses and survives the lift', () => {
    const parsed = parseCustomProviders({
      customProviders: [{ ...validEntry, protocol: 'anthropic' }],
    })
    expect(parsed.problems).toEqual([])
    expect(parsed.configs[0]?.protocol).toBe('anthropic')
    const lifted = toProviderConfig(parsed.configs[0] as CustomProviderConfig)
    expect(lifted.protocol).toBe('anthropic')
    expect(lifted.kind).toBe('gateway')
    expect(lifted.baseUrl).toBe('https://outlier.example/v1')
  })

  test('validation rejects a protocol outside openai|anthropic (fail-closed)', () => {
    const parsed = parseCustomProviders({
      customProviders: [{ ...validEntry, protocol: 'gemini' }],
    })
    expect(parsed.configs).toEqual([])
    expect(parsed.problems.length).toBeGreaterThan(0)
    expect(parsed.problems[0]).toContain('protocol')
  })

  test('protocol accepts exactly openai or anthropic', () => {
    for (const protocol of ['openai', 'anthropic'] as const) {
      const parsed = parseCustomProviders({
        customProviders: [{ ...validEntry, protocol }],
      })
      expect(parsed.problems).toEqual([])
      expect(parsed.configs[0]?.protocol).toBe(protocol)
    }
  })

  test('a non-string protocol is rejected', () => {
    const parsed = parseCustomProviders({
      customProviders: [{ ...validEntry, protocol: 42 }],
    })
    expect(parsed.configs).toEqual([])
    expect(parsed.problems.some((p) => p.includes('protocol'))).toBe(true)
  })
})
