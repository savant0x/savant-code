// Openrouter-models test family — gateway model lookup, subscription, and
// store wiring. Sibling of the Loop-338 decomposition (shared lifecycle in
// ./openrouter-models-test-harness).

import { describe, expect, mock, test } from 'bun:test'

import { useGatewayCatalogStore } from '../../state/gateway-catalog-store'
import {
  fetchGatewayModels,
  findGatewayModel,
  subscribeGatewayCatalog,
} from '../openrouter-models'
import {
  makeJsonResponse,
  registerGatewayCatalogLifecycle,
} from './openrouter-models-test-harness'

describe('openrouter-models', () => {
  registerGatewayCatalogLifecycle()

  test('findGatewayModel resolves exact, prefix, and family matches', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(
        makeJsonResponse({
          data: [
            { id: 'openai/gpt-5', name: 'GPT-5' },
            { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
          ],
        }),
      ),
    )
    await fetchGatewayModels(true)
    expect(findGatewayModel('openai/gpt-5')?.name).toBe('GPT-5')
    expect(findGatewayModel('gpt-5')).toBeUndefined()
    expect(findGatewayModel('anthropic/claude-sonnet-4.8')?.name).toBe(
      'Claude Sonnet 4',
    )
  })
  test('subscribeGatewayCatalog notifies listeners when the gateway catalog loads', async () => {
    const listener = mock(() => {})
    const unsubscribe = subscribeGatewayCatalog(listener)
    try {
      // @ts-expect-error - mock fetch
      globalThis.fetch = mock(() =>
        Promise.resolve(makeJsonResponse({ data: [{ id: 'x/y' }] })),
      )
      await fetchGatewayModels(true)
      expect(listener).toHaveBeenCalled()
      expect(listener).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'x/y' })]),
      )
    } finally {
      unsubscribe()
    }
  })
  test('gateway catalog store updates when the gateway catalog loads', async () => {
    // @ts-expect-error - mock fetch
    globalThis.fetch = mock(() =>
      Promise.resolve(
        makeJsonResponse({ data: [{ id: 'openai/gpt-store-test' }] }),
      ),
    )
    const beforeLoadedAt = useGatewayCatalogStore.getState().lastLoadedAt
    await fetchGatewayModels(true)
    const state = useGatewayCatalogStore.getState()
    expect(state.catalog.some((m) => m.id === 'openai/gpt-store-test')).toBe(
      true,
    )
    expect(state.lastLoadedAt).toBeGreaterThanOrEqual(beforeLoadedAt)
  })
})
