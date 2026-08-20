import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import {
  clearMockedModules,
  mockModule,
} from '@savant-code/common/testing/mock-modules'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  mock,
  test,
} from 'bun:test'

import {
  detectVersionCandidates,
  resolveVersionPin,
  slugifyPackageName,
} from '../version-detect'

import type { Logger } from '@savant-code/common/types/contracts/logger'

const logger = TEST_AGENT_RUNTIME_IMPL.logger as Logger

function fetchWith(routes: Array<[string, unknown]>): typeof globalThis.fetch {
  return mock((input: unknown) => {
    const url = String(input)
    const match = routes.find(([prefix]) => url.startsWith(prefix))
    if (match) {
      return Promise.resolve(
        new Response(JSON.stringify(match[1]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
    return Promise.resolve(new Response('Not Found', { status: 404 }))
  }) as unknown as typeof globalThis.fetch
}

describe('slugifyPackageName', () => {
  test('slugifies display names to registry-safe slugs', () => {
    expect(slugifyPackageName('React Native')).toBe('react-native')
    expect(slugifyPackageName('TypeScript')).toBe('typescript')
    expect(slugifyPackageName('  Vue.js 3  ')).toBe('vue-js-3')
    expect(slugifyPackageName('...')).toBe('')
  })
})

describe('detectVersionCandidates + resolveVersionPin', () => {
  beforeAll(async () => {
    await mockModule('@savant-code/common/util/promise', () => ({
      withTimeout: async <T>(promise: Promise<T>, timeout: number) => promise,
    }))
  })

  afterEach(() => {
    mock.restore()
  })

  afterAll(() => {
    clearMockedModules()
  })

  test('resolves the npm latest version unambiguously', async () => {
    const fetch = fetchWith([
      ['https://registry.npmjs.org/react/latest', { version: '19.2.0' }],
    ])
    const candidates = await detectVersionCandidates({
      libraryTitle: 'React',
      logger,
      fetch,
    })
    expect(resolveVersionPin(candidates)).toEqual({
      version: '19.2.0',
      ambiguous: false,
    })
  })

  test('resolves PyPI when npm misses', async () => {
    const fetch = fetchWith([
      ['https://pypi.org/pypi/django/json', { info: { version: '5.1.0' } }],
    ])
    const candidates = await detectVersionCandidates({
      libraryTitle: 'Django',
      logger,
      fetch,
    })
    expect(resolveVersionPin(candidates)).toEqual({
      version: '5.1.0',
      ambiguous: false,
    })
  })

  test('resolves nothing when no registry matches', async () => {
    const fetch = fetchWith([])
    const candidates = await detectVersionCandidates({
      libraryTitle: 'TotallyUnknownLib123',
      logger,
      fetch,
    })
    expect(resolveVersionPin(candidates)).toEqual({
      version: null,
      ambiguous: false,
    })
  })

  test('ignores malformed npm payloads and falls through', async () => {
    const fetch = fetchWith([
      ['https://registry.npmjs.org/foo/latest', { notVersion: true }],
      ['https://pypi.org/pypi/foo/json', { info: { version: '2.0.0' } }],
    ])
    const candidates = await detectVersionCandidates({
      libraryTitle: 'foo',
      logger,
      fetch,
    })
    expect(resolveVersionPin(candidates)).toEqual({
      version: '2.0.0',
      ambiguous: false,
    })
  })

  test('resolves crates.io when npm and PyPI miss', async () => {
    const fetch = fetchWith([
      [
        'https://crates.io/api/v1/crates/serde',
        { crate: { max_version: '1.0.200' } },
      ],
    ])
    const candidates = await detectVersionCandidates({
      libraryTitle: 'serde',
      logger,
      fetch,
    })
    expect(resolveVersionPin(candidates)).toEqual({
      version: '1.0.200',
      ambiguous: false,
    })
  })

  test('resolves RubyGems after crates.io misses', async () => {
    const fetch = fetchWith([
      ['https://rubygems.org/api/v1/gems/rails.json', { version: '8.0.1' }],
    ])
    const candidates = await detectVersionCandidates({
      libraryTitle: 'rails',
      logger,
      fetch,
    })
    expect(resolveVersionPin(candidates)).toEqual({
      version: '8.0.1',
      ambiguous: false,
    })
  })

  test('resolves a Go module path and strips the v prefix', async () => {
    const fetch = fetchWith([
      [
        'https://proxy.golang.org/github.com/spf13/cobra/@latest',
        { Version: 'v1.8.1' },
      ],
    ])
    const candidates = await detectVersionCandidates({
      libraryTitle: 'github.com/spf13/cobra',
      logger,
      fetch,
    })
    expect(resolveVersionPin(candidates)).toEqual({
      version: '1.8.1',
      ambiguous: false,
    })
  })

  test('does not try the Go proxy for a non-module title', async () => {
    const fetch = fetchWith([])
    const candidates = await detectVersionCandidates({
      libraryTitle: 'some lib!',
      logger,
      fetch,
    })
    expect(candidates).toEqual([])
  })

  test('flags an ambiguous name that resolves in multiple ecosystems', async () => {
    const fetch = fetchWith([
      ['https://registry.npmjs.org/cobra/latest', { version: '1.2.3' }],
      ['https://pypi.org/pypi/cobra/json', { info: { version: '2.0.0' } }],
    ])
    const candidates = await detectVersionCandidates({
      libraryTitle: 'cobra',
      logger,
      fetch,
    })
    expect(resolveVersionPin(candidates)).toEqual({
      version: null,
      ambiguous: true,
    })
    // both ecosystems surfaced, order-independent
    expect(candidates.map((c) => c.ecosystem).sort()).toEqual(['npm', 'pypi'])
  })

  test('restricts detection to the named ecosystem when provided', async () => {
    const fetch = fetchWith([
      ['https://registry.npmjs.org/cobra/latest', { version: '1.2.3' }],
      ['https://proxy.golang.org/cobra/@latest', { Version: 'v3.0.0' }],
    ])
    const candidates = await detectVersionCandidates({
      libraryTitle: 'cobra',
      ecosystem: 'go',
      logger,
      fetch,
    })
    expect(resolveVersionPin(candidates)).toEqual({
      version: '3.0.0',
      ambiguous: false,
    })
    // only the pinned registry is consulted — npm is not queried
    expect(candidates.map((c) => c.ecosystem)).toEqual(['go'])
  })
})
