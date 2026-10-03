import { describe, expect, test } from 'bun:test'

import {
  COMMANDCODE_PROTOCOLS,
  TOKENROUTER_PROTOCOLS,
  XKIRO_PROTOCOLS,
  resolveMappedModelProtocol,
} from '../../constants/model-config'
import { PROVIDER_REGISTRY } from '../registry'
import { validateProviderRegistry } from '../validate'

describe('live protocol-map coverage (FID-2026-1003-001)', () => {
  test('new xKiro IDs retain explicit routing and vendor namespaces', () => {
    expect(
      resolveMappedModelProtocol(XKIRO_PROTOCOLS, 'xkiro/anthropic/new'),
    ).toBe('anthropic')
    expect(
      resolveMappedModelProtocol(XKIRO_PROTOCOLS, 'xkiro/qwen/new:free'),
    ).toBe('openai')
    expect(
      resolveMappedModelProtocol(XKIRO_PROTOCOLS, 'another/qwen/new'),
    ).toBeUndefined()
    expect(
      resolveMappedModelProtocol(XKIRO_PROTOCOLS, 'xkiro/'),
    ).toBeUndefined()
  })

  test('exact entries override prefixes; longest prefix wins independent of order', () => {
    const map = {
      ...XKIRO_PROTOCOLS,
      'xkiro/anthropic/exception': 'openai',
    } as const
    expect(resolveMappedModelProtocol(map, 'xkiro/anthropic/exception')).toBe(
      'openai',
    )
    expect(resolveMappedModelProtocol(map, 'xkiro/anthropic/future')).toBe(
      'anthropic',
    )
    expect(
      resolveMappedModelProtocol(
        { 'xkiro/*': 'openai', ...map },
        'xkiro/anthropic/future',
      ),
    ).toBe('anthropic')
  })

  test('exact-map providers still reject unknown IDs', () => {
    expect(
      resolveMappedModelProtocol(COMMANDCODE_PROTOCOLS, 'commandcode/new'),
    ).toBeUndefined()
    expect(
      resolveMappedModelProtocol(TOKENROUTER_PROTOCOLS, 'tokenrouter/new'),
    ).toBeUndefined()
  })

  test('registry validates both live additions and retains CleanAPIs', () => {
    expect(validateProviderRegistry(PROVIDER_REGISTRY)).toEqual([])
    for (const id of ['codecraft', 'xkiro', 'cleanapis'] as const) {
      expect(PROVIDER_REGISTRY[id].setupAvailable).toBe(true)
      expect(PROVIDER_REGISTRY[id].catalog.source).toBe('live')
      expect(PROVIDER_REGISTRY[id].idTransform).toBe('strip')
    }
  })
})
