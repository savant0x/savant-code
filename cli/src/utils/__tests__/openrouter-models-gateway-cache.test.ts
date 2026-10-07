// Openrouter-models test family — the shared gateway cache's publish contract.
//
// Split from openrouter-models-gateway.test.ts for the 300-line quality ceiling
// (FID-2026-1007-006; verbatim moves). These two pins are about WHEN a build may
// publish, not about what a provider parses, and that distinction is the whole
// record: `gatewayCache` and `gatewayInflight` are module scope, shared by every
// file in the `bun test` process, and the failure this record was opened for was
// one file's build settling after another file's reset.
import { describe, expect, mock, test } from 'bun:test'

import {
  __resetOpenRouterModelsCacheForTest,
  fetchGatewayModels,
  getCachedGatewayModels,
} from '../openrouter-models'
import {
  makeJsonResponse,
  registerGatewayCatalogLifecycle,
} from './openrouter-models-test-harness'

describe('openrouter-models gateway cache ownership', () => {
  registerGatewayCatalogLifecycle()

  test('a superseded build publishes nothing into the shared cache (FID-2026-1007-006)', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(
        makeJsonResponse({
          data: [{ id: 'openrouter/leaked', name: 'Leaked' }],
        }),
      ),
    )
    const pending = fetchGatewayModels(true)
    // A reset lands while the build is in flight (the cross-file case: another
    // suite's reset runs before this build settles).
    __resetOpenRouterModelsCacheForTest()
    const returned = await pending

    // Its own caller still gets its catalog...
    expect(returned.length).toBeGreaterThan(0)
    // ...but the shared cache was not written by the superseded build.
    expect(getCachedGatewayModels()).toEqual([])
  })

  test('the in-flight slot clears on settle, so a later call rebuilds (FID-2026-1007-006)', async () => {
    const fetchMock = mock(() =>
      Promise.resolve(
        makeJsonResponse({ data: [{ id: 'openrouter/one', name: 'One' }] }),
      ),
    )
    // @ts-expect-error - mock fetch
    globalThis.fetch = fetchMock
    await fetchGatewayModels(true)
    const callsAfterFirst = fetchMock.mock.calls.length
    await fetchGatewayModels(true)

    // Pre-fix the completed promise stayed in gatewayInflight for the rest of
    // the process, so this call returned it instead of fetching — the TTL never
    // took effect (`CATALOG_TTL_MS` was dead code).
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterFirst)
  })
})
