import { describe, expect, test } from 'bun:test'

import { launchBundleProvider } from '../tools/handlers/tool/connector-bundle'
import { makeConnectorCredentialsHandler } from '../tools/handlers/tool/connector-credentials'
import { makeConnectorDescribeHandler } from '../tools/handlers/tool/connector-describe'
import { makeConnectorInvokeHandler } from '../tools/handlers/tool/connector-invoke'
import { makeConnectorSearchHandler } from '../tools/handlers/tool/connector-search'

import type { SavantCodeToolHandlerFunction } from '../tools/handlers/handler-function-type'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { Bundle } from '@savant-code/connectors/core'

/**
 * Connector handler suite (FID-2026-0930-003 gate): the four handlers are
 * exercised through their DI seam (injected bundle provider) — search
 * filters, describe errors with the known-id shape, invoke's replay-mode
 * honest answer, and credentials reporting env NAMES only, never a value
 * (Law 12). Also pins the Law-4 reachability half: the four names resolve
 * in the tool union + params map, the production bundle provider loads the
 * checked-in catalog, and the safety-registry completeness check holds at
 * module load (import side effect).
 */

/** Minimal handler params: handlers read only `toolCall`; the full handler
 *  params type carries the runtime's whole dependency surface, which a unit
 *  test does not construct — one documented cast, the test-double seam. */
function handlerParams<T extends ToolName>(
  toolName: T,
  input: unknown,
): Parameters<SavantCodeToolHandlerFunction<T>>[0] {
  return {
    previousToolCallFinished: Promise.resolve(),
    toolCall: { toolName, input },
  } as unknown as Parameters<SavantCodeToolHandlerFunction<T>>[0]
}

/** A tiny synthetic bundle: two providers, one endpoint each, known shapes. */
function fakeBundle(): Bundle {
  const doc = (provider: string, id: string, path: string) => ({
    specVersion: '1.0.0',
    id,
    endpoint: id.split('#')[1] ?? '',
    provider,
    minEngineVersion: '0.0.0',
    meta: {
      displayName: id,
      summary: `synthetic ${id}`,
      categories: ['web-search'],
    },
    auth: {
      inject: { $fn: { key: 'k' } },
      credentials: {
        type: 'object',
        properties: { apiKey: { type: 'string' } },
      },
    },
    request: { method: 'GET', url: `https://synthetic.test${path}` },
    input: {
      schema: {
        body: undefined,
        queryParams: { type: 'object', properties: {} },
        pathParams: undefined,
      },
      toRequest: { $fn: { key: 'k' } },
    },
    output: {
      fromResponse: { $fn: { key: 'k' } },
      fromError: { $fn: { key: 'k' } },
      schema: undefined,
    },
    usage: {
      model: { kind: 'FREE' },
      credits: {},
      estimate: { $fn: { key: 'k' } },
      evidence: { $fn: { key: 'k' } },
      consolidate: undefined,
      updateEstimateEveryMs: undefined,
    },
    lifecycle: undefined,
    resources: undefined,
    timeouts: { requestMs: 1000 },
    hash: 'synthetic',
  })
  const providerDoc = (name: string, displayName: string) => ({
    specVersion: '1.0.0',
    name,
    minEngineVersion: '0.0.0',
    meta: {
      displayName,
      summary: `synthetic provider ${name}`,
      categories: ['web-search'],
    },
    webhooks: undefined,
    hash: 'synthetic',
  })
  return {
    catalogVersion: '0.0.0-test',
    generatedAt: '1970-01-01T00:00:00.000Z',
    minEngineVersion: '0.0.0',
    toolchain: {
      compilerVersion: '0.0.0-test',
      builtWithEngineVersion: '0.0.0-test',
    },
    providers: {
      alpha: providerDoc('alpha', 'Alpha'),
      beta: providerDoc('beta', 'Beta'),
    },
    endpoints: {
      'alpha#one': doc('alpha', 'alpha#one', '/one'),
      'beta#two': doc('beta', 'beta#two', '/two'),
    },
    fnTable: {},
  } as unknown as Bundle
}

describe('connector_search handler', () => {
  test('no filter → providers; provider filter → endpoints of that provider', async () => {
    const bundle = fakeBundle()
    const handler = makeConnectorSearchHandler(async () => bundle)

    const all = await handler(handlerParams('connector_search', {}))
    const allValue = (
      all.output[0] as {
        value: { providers?: Array<{ name: string }> }
      }
    ).value
    expect(allValue.providers?.map((p) => p.name).sort()).toEqual([
      'alpha',
      'beta',
    ])

    const filtered = await handler(
      handlerParams('connector_search', { provider: 'beta' }),
    )
    const filteredValue = (
      filtered.output[0] as { value: { endpoints?: Array<{ id: string }> } }
    ).value
    expect(filteredValue.endpoints?.map((e) => e.id)).toEqual(['beta#two'])
  })

  test('bundle failure surfaces as an errorMessage JSON result', async () => {
    const handler = makeConnectorSearchHandler(async () => {
      throw new Error('bundle unavailable')
    })
    const result = await handler(handlerParams('connector_search', {}))
    const value = (result.output[0] as { value: { errorMessage?: string } })
      .value
    expect(value.errorMessage).toContain('bundle unavailable')
  })
})

describe('connector_describe handler', () => {
  test('returns the endpoint doc as the contract', async () => {
    const handler = makeConnectorDescribeHandler(async () => fakeBundle())
    const result = await handler(
      handlerParams('connector_describe', {
        provider: 'alpha',
        endpoint: 'alpha#one',
      }),
    )
    const value = (result.output[0] as { value: { endpoint?: { id: string } } })
      .value
    expect(value.endpoint?.id).toBe('alpha#one')
  })

  test('unknown endpoint → errorMessage naming the known ids (INVALID_INPUT shape)', async () => {
    const handler = makeConnectorDescribeHandler(async () => fakeBundle())
    const result = await handler(
      handlerParams('connector_describe', {
        provider: 'alpha',
        endpoint: 'alpha#nope',
      }),
    )
    const value = (result.output[0] as { value: { errorMessage?: string } })
      .value
    expect(value.errorMessage).toContain('endpoint not in bundle')
    expect(value.errorMessage).toContain('alpha#one')
  })
})

describe('connector_invoke handler', () => {
  test('replay mode with no registered fixture loader answers honestly (converged behavior: hosts register loaders; none ships in agent-runtime)', async () => {
    const handler = makeConnectorInvokeHandler(async () => fakeBundle())
    const result = await handler(
      handlerParams('connector_invoke', {
        provider: 'alpha',
        endpoint: 'alpha#one',
        input: { queryParams: {} },
        mode: 'replay',
      }),
    )
    const value = (result.output[0] as { value: { errorMessage?: string } })
      .value
    expect(value.errorMessage).toContain('replay mode is not available')
  })

  test('live invoke with a synthetic bundle fails closed as an errorMessage (no egress in tests)', async () => {
    const handler = makeConnectorInvokeHandler(async () => fakeBundle())
    const result = await handler(
      handlerParams('connector_invoke', {
        provider: 'alpha',
        endpoint: 'alpha#one',
        input: { queryParams: {} },
      }),
    )
    const value = (result.output[0] as { value: { errorMessage?: string } })
      .value
    // The synthetic doc's fn table has no real entries — the engine's
    // fail-closed load gate rejects it; the handler renders that as an
    // errorMessage rather than throwing opaque.
    expect(value.errorMessage).toBeDefined()
  })
})

describe('connector_credentials handler (names only — Law 12)', () => {
  test('reports env var NAMES + presence, never a value', async () => {
    process.env.ALPHA_CREDENTIALS_API_KEY = 'super-secret-value'
    try {
      const handler = makeConnectorCredentialsHandler(async () => fakeBundle())
      const result = await handler(
        handlerParams('connector_credentials', {
          provider: 'alpha',
        }),
      )
      const serialized = JSON.stringify(result.output)
      expect(serialized).not.toContain('super-secret-value')
      const value = (
        result.output[0] as {
          value: {
            provider: string
            credentials: Array<{
              field: string
              envVar: string
              aliasEnvVar?: string
              present: boolean
            }>
            ready: boolean
          }
        }
      ).value
      expect(value.provider).toBe('alpha')
      // the canonical name + the documented apiKey alias, NAMES only
      expect(value.credentials).toEqual([
        {
          field: 'apiKey',
          envVar: 'ALPHA_CREDENTIALS_API_KEY',
          aliasEnvVar: 'ALPHA_API_KEY',
          present: true,
        },
      ])
      expect(value.ready).toBe(true)
    } finally {
      delete process.env.ALPHA_CREDENTIALS_API_KEY
    }
  })

  test('an unset credential reports present: false, ready: false', async () => {
    delete process.env.BETA_CREDENTIALS_API_KEY
    delete process.env.BETA_API_KEY
    const handler = makeConnectorCredentialsHandler(async () => fakeBundle())
    const result = await handler(
      handlerParams('connector_credentials', {
        provider: 'beta',
      }),
    )
    const value = (
      result.output[0] as {
        value: { credentials: Array<{ present: boolean }>; ready: boolean }
      }
    ).value
    expect(value.credentials[0]?.present).toBe(false)
    expect(value.ready).toBe(false)
  })

  test('unknown provider → errorMessage listing known providers', async () => {
    const handler = makeConnectorCredentialsHandler(async () => fakeBundle())
    const result = await handler(
      handlerParams('connector_credentials', {
        provider: 'gamma',
      }),
    )
    const value = (result.output[0] as { value: { errorMessage?: string } })
      .value
    expect(value.errorMessage).toContain('provider not in bundle')
  })
})

describe('Law-4 reachability (production wiring)', () => {
  // Union/params/safety pins live in the common suite
  // (common/src/tools/__tests__/connector-tool-params.test.ts); this pins
  // the runtime half: the production provider resolves the real bundle.
  test('the production bundle provider loads the checked-in catalog', async () => {
    const bundle = await launchBundleProvider()
    expect(Object.keys(bundle.endpoints).length).toBeGreaterThan(0)
  })
})
