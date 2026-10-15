import * as fs from 'node:fs'

import { describe, expect, test } from 'bun:test'

import {
  getEffectiveProviderRegistry,
  parseCustomProviders,
  registerCustomProviders,
  resetCustomProviders,
} from '../custom-providers'
import { deriveAllowedModelPrefixes } from '../derive'
import { ORG_PREFIXES } from '../org'
import { PROVIDER_REGISTRY } from '../registry'
import { validateProviderRegistry } from '../validate'

import type { JSONValue } from '../../types/json'
import type { CustomProviderConfig } from '../custom-providers'

/**
 * FID-2026-0910-004 Steps 1-2 — user-defined custom providers (common layer).
 *
 * RED-first: written against the FID's converged contract before any
 * implementation exists in this workspace. GREEN when:
 * - Step 1: `CustomProviderConfig` + `parseCustomProviders` exist and enforce
 *   the D1/D2 constraints; the `inline` catalog variant exists in
 *   `ProviderConfig`; `validateProviderRegistry` accepts it.
 * - Step 2: `custom-providers.ts` provides register/getEffective/reset with
 *   the D4 lifecycle (valid-replace / no-op-without / fail-closed) and the
 *   effective registry is validated by the SAME `validateProviderRegistry`.
 * - Step 3: the dead `filteredModels` computation in
 *   `common/src/types/dynamic-agent-template.ts` is removed (no behavior
 *   change; the dead-code pin guards against resurrection).
 *
 * Contract note (pin corrected during RED, documented in the FID): parsing
 * and registration are separate — `parseCustomProviders` returns
 * `{ configs, problems }` (never throws), `registerCustomProviders` takes
 * already-validated configs, re-validates the merged view, and throws
 * fail-closed. A test-first draft had conflated the two return shapes.
 */

/** A minimal valid custom provider record (D1 shape). */
function validCustom(
  overrides: Partial<CustomProviderConfig> = {},
): CustomProviderConfig {
  return {
    id: 'my-gateway',
    label: 'My Gateway',
    baseUrl: 'https://gw.example.com/v1',
    apiKeyEnvVar: 'MY_GATEWAY_API_KEY',
    catalog: { source: 'inline', models: { 'my-gateway/llama-3': 'Llama 3' } },
    ...overrides,
  }
}

function wrapped(entries: unknown): JSONValue {
  return { customProviders: entries } as JSONValue
}

describe('parseCustomProviders (FID-2026-0910-004 Step 1)', () => {
  test('accepts a valid custom provider (problems empty, config parsed)', () => {
    const input = wrapped([
      {
        id: 'my-gateway',
        label: 'My Gateway',
        baseUrl: 'https://gw.example.com/v1',
        apiKeyEnvVar: 'MY_GATEWAY_API_KEY',
        catalog: { source: 'none' },
      },
    ])
    const { configs, problems } = parseCustomProviders(input)
    expect(problems).toEqual([])
    expect(configs.length).toBe(1)
    expect(configs[0]?.id).toBe('my-gateway')
    expect(configs[0]?.baseUrl).toBe('https://gw.example.com/v1')
  })

  test('accepts an inline catalog and a live catalog URL', () => {
    const inline = parseCustomProviders(
      wrapped([validCustom({ catalog: { source: 'inline', models: {} } })]),
    )
    expect(inline.problems).toEqual([])
    expect(inline.configs.length).toBe(1)

    const live = parseCustomProviders(
      wrapped([
        validCustom({
          catalog: { source: 'live', url: 'https://gw.example.com/v1/models' },
        }),
      ]),
    )
    expect(live.problems).toEqual([])
    expect(live.configs.length).toBe(1)
  })

  test('missing customProviders field yields a problem, not a throw', () => {
    const { configs, problems } = parseCustomProviders(wrapped(undefined))
    expect(configs).toEqual([])
    expect(problems.join(' ')).toContain('customProviders')
  })

  test('rejects a non-array customProviders field (fail-closed)', () => {
    const problems = parseCustomProviders(wrapped('not-an-array')).problems
    expect(problems.join(' ')).toContain('customProviders')
    expect(problems.length).toBeGreaterThan(0)
  })

  test('rejects a non-object entry with its array index in the message', () => {
    const problems = parseCustomProviders(wrapped([42])).problems
    expect(problems.join(' ')).toContain('[0]')
  })

  test('rejects invalid id shape and whitespace-only labels', () => {
    const badId = parseCustomProviders(
      wrapped([validCustom({ id: 'Bad_Id!' })]),
    ).problems
    expect(badId.join(' ')).toContain('id')

    const badLabel = parseCustomProviders(
      wrapped([validCustom({ label: '   ' })]),
    ).problems
    expect(badLabel.join(' ')).toContain('label')
  })

  test('rejects non-http(s) baseUrls (reuses the registry URL rule)', () => {
    const problems = parseCustomProviders(
      wrapped([validCustom({ baseUrl: 'ftp://nope.example.com' })]),
    ).problems
    expect(problems.join(' ')).toContain('baseUrl')
  })

  test('rejects env-var names that are not uppercase SNAKE_CASE', () => {
    const problems = parseCustomProviders(
      wrapped([validCustom({ apiKeyEnvVar: 'not-snake-case' })]),
    ).problems
    expect(problems.join(' ')).toContain('apiKeyEnvVar')
  })

  test('rejects reserved ids: registry ids AND org-slug prefixes (D2)', () => {
    for (const reserved of ['openrouter', 'ollama', 'anthropic', 'openai']) {
      const problems = parseCustomProviders(
        wrapped([validCustom({ id: reserved })]),
      ).problems
      expect(problems.join(' ')).toContain(reserved)
    }
  })

  test('rejects env-var collisions with claimed built-in vars (D2)', () => {
    const problems = parseCustomProviders(
      wrapped([validCustom({ apiKeyEnvVar: 'OPENROUTER_API_KEY' })]),
    ).problems
    expect(problems.join(' ')).toContain('OPENROUTER_API_KEY')
  })

  test('rejects a custom id colliding with another custom id', () => {
    const problems = parseCustomProviders(
      wrapped([validCustom(), validCustom({ label: 'Other' })]),
    ).problems
    expect(problems.join(' ')).toContain('my-gateway')
  })

  test('rejects env-var collisions between custom entries', () => {
    const problems = parseCustomProviders(
      wrapped([
        validCustom(),
        validCustom({ id: 'other-gw', apiKeyEnvVar: 'MY_GATEWAY_API_KEY' }),
      ]),
    ).problems
    expect(problems.join(' ')).toContain('MY_GATEWAY_API_KEY')
  })

  test('rejects inline-catalog model ids that do not carry the prefix (D3)', () => {
    const problems = parseCustomProviders(
      wrapped([
        validCustom({
          catalog: {
            source: 'inline',
            models: { 'wrong-prefix/model': 'X' },
          },
        }),
      ]),
    ).problems
    expect(problems.join(' ')).toContain('prefix')
  })
})

describe('custom provider registry merge (FID-2026-0910-004 Step 2)', () => {
  test('register → effective contains the converted custom entry', () => {
    resetCustomProviders()
    registerCustomProviders([validCustom()])

    const effective = getEffectiveProviderRegistry()
    const custom = effective['my-gateway']
    expect(custom).toBeDefined()
    if (!custom) throw new Error('unreachable')
    expect(custom.kind).toBe('gateway')
    expect(custom.protocol).toBe('openai')
    expect(custom.idTransform).toBe('strip')
    expect(custom.baseUrl).toBe('https://gw.example.com/v1')
    expect(custom.credentials.envVar).toBe('MY_GATEWAY_API_KEY')
    expect(custom.credentials.resolver).toBeUndefined()
    expect(custom.catalog.source).toBe('inline')
    expect(custom.order).toBe(5)
    // D2: built-ins win — every built-in id still present and unchanged.
    for (const [id, config] of Object.entries(PROVIDER_REGISTRY)) {
      expect(effective[id]).toEqual(config)
    }
    resetCustomProviders()
  })

  test('derived prefix list includes the custom id (merge-consumer parity)', () => {
    resetCustomProviders()
    registerCustomProviders([validCustom()])
    const effective = getEffectiveProviderRegistry()
    expect(
      deriveAllowedModelPrefixes(effective, ORG_PREFIXES).sort(),
    ).toContain('my-gateway')
    resetCustomProviders()
  })

  test('D4 lifecycle: valid registration replaces; empty list is a no-op', () => {
    resetCustomProviders()
    registerCustomProviders([validCustom()])
    registerCustomProviders([
      validCustom({
        id: 'second-gw',
        apiKeyEnvVar: 'SECOND_GW_KEY',
        catalog: {
          source: 'inline',
          models: { 'second-gw/model-a': 'Model A' },
        },
      }),
    ])
    expect(getEffectiveProviderRegistry()['my-gateway']).toBeUndefined()
    expect(getEffectiveProviderRegistry()['second-gw']).toBeDefined()

    // D4: registering with no custom providers present must NOT clear state
    // (evals constructs SavantCodeClient without the option).
    registerCustomProviders([])
    expect(getEffectiveProviderRegistry()['second-gw']).toBeDefined()
    resetCustomProviders()
  })

  test('reset returns the registry to built-ins-only', () => {
    resetCustomProviders()
    registerCustomProviders([validCustom()])
    resetCustomProviders()
    expect(Object.keys(getEffectiveProviderRegistry()).sort()).toEqual(
      Object.keys(PROVIDER_REGISTRY).sort(),
    )
  })

  test('invalid registration throws fail-closed and leaves state untouched', () => {
    resetCustomProviders()
    registerCustomProviders([validCustom()])
    expect(() =>
      registerCustomProviders([
        validCustom({
          id: 'openrouter',
          catalog: {
            source: 'inline',
            models: { 'openrouter/model-x': 'X' },
          },
        }),
      ]),
    ).toThrow()
    // The previously registered (valid) set survives the failed call.
    expect(getEffectiveProviderRegistry()['my-gateway']).toBeDefined()
    expect(getEffectiveProviderRegistry()['openrouter']).toEqual(
      PROVIDER_REGISTRY.openrouter,
    )
    resetCustomProviders()
  })

  test('merged view passes the SAME validateProviderRegistry gate', () => {
    resetCustomProviders()
    registerCustomProviders([validCustom()])
    // Round-trip: the effective registry must satisfy the built-in validator
    // (env-var claims, URL parsing, catalog invariants) with zero problems.
    expect(validateProviderRegistry(getEffectiveProviderRegistry())).toEqual([])
    resetCustomProviders()
  })
})

describe('Step 3 — dynamic-agent-template dead computation removed', () => {
  test('no dead filteredModels computation remains in the module', () => {
    const source = fs.readFileSync(
      new URL('../../types/dynamic-agent-template.ts', import.meta.url),
      'utf8',
    )
    // Pin the dead CODE patterns, not identifiers (a comment may name them):
    // the module-load filter over `models` and the old-constants import.
    expect(source).not.toContain('Object.values(models)')
    expect(source).not.toContain("from '../old-constants'")
  })
})
