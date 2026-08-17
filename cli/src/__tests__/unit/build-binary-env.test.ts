import { describe, test, expect } from 'bun:test'

import {
  CANONICAL_NEXT_PUBLIC_DEFAULTS,
  CANONICAL_RELEASE_RUNTIME_DEFAULTS,
  evaluateBinaryEnvIntegrity,
  getOpenTuiNativePackageNames,
  getReleaseRuntimeDefaults,
  findBinaryEnvLeaks,
} from '../../../scripts/build-binary'

// FID-2026-0805-002: a release build must never ship dev NEXT_PUBLIC_* values
// (localhost URLs, personal emails, placeholder keys) inside the env.json
// sibling. findBinaryEnvLeaks is the pure gate; these tests pin its contract.
function canonicalEnv(): Record<string, string> {
  return {
    NODE_ENV: 'production',
    SAVANT_CODE_IS_BINARY: 'true',
    SAVANT_CODE_CLI_VERSION: '0.0.19',
    ...CANONICAL_NEXT_PUBLIC_DEFAULTS,
  }
}

describe('release runtime defaults', () => {
  test('routes Savant-Code release binaries through OpenRouter direct mode', () => {
    expect(getReleaseRuntimeDefaults('savant-code')).toEqual({
      ...CANONICAL_RELEASE_RUNTIME_DEFAULTS,
      SAVANT_CODE_DEFAULT_MODEL_ID: 'openrouter/free',
    })
  })

  test('preserves Savant-Free backend/session routing', () => {
    expect(getReleaseRuntimeDefaults('savant-free')).toEqual({})
  })
})

// Regression: v0.0.25 linux-arm64 release binary was missing because the
// build fetched only the glibc bundle (@opentui/core-linux-arm64) while Bun's
// bundler resolved the musl variant (@opentui/core-linux-arm64-musl) on the
// ubuntu CI runner. Bun's cross-target libc pick is host-dependent (musl on
// ubuntu, glibc on Windows), so linux targets install BOTH variants.
describe('getOpenTuiNativePackageNames', () => {
  function info(bunTarget: string, platform: string, arch: string) {
    return {
      bunTarget,
      platform: platform as NodeJS.Platform,
      arch,
    }
  }

  test('linux targets install both glibc and musl bundles', () => {
    expect(
      getOpenTuiNativePackageNames(info('bun-linux-x64', 'linux', 'x64')),
    ).toEqual(['@opentui/core-linux-x64', '@opentui/core-linux-x64-musl'])
    expect(
      getOpenTuiNativePackageNames(info('bun-linux-arm64', 'linux', 'arm64')),
    ).toEqual(['@opentui/core-linux-arm64', '@opentui/core-linux-arm64-musl'])
  })

  test('linux-arm64 set includes the musl variant the CI runner resolves', () => {
    const names = getOpenTuiNativePackageNames(
      info('bun-linux-arm64', 'linux', 'arm64'),
    )
    expect(names).toContain('@opentui/core-linux-arm64-musl')
  })

  test('darwin and win32 targets resolve their unsuffixed bundles', () => {
    expect(
      getOpenTuiNativePackageNames(info('bun-darwin-x64', 'darwin', 'x64')),
    ).toEqual(['@opentui/core-darwin-x64'])
    expect(
      getOpenTuiNativePackageNames(info('bun-darwin-arm64', 'darwin', 'arm64')),
    ).toEqual(['@opentui/core-darwin-arm64'])
    expect(
      getOpenTuiNativePackageNames(info('bun-windows-x64', 'win32', 'x64')),
    ).toEqual(['@opentui/core-win32-x64'])
  })

  test('every produced variant is declared by @opentui/core 0.5.3', () => {
    const declared = [
      '@opentui/core-darwin-x64',
      '@opentui/core-darwin-arm64',
      '@opentui/core-linux-x64',
      '@opentui/core-linux-arm64',
      '@opentui/core-win32-x64',
      '@opentui/core-win32-arm64',
      '@opentui/core-linux-x64-musl',
      '@opentui/core-linux-arm64-musl',
    ]
    const produced = [
      ...getOpenTuiNativePackageNames(info('bun-linux-x64', 'linux', 'x64')),
      ...getOpenTuiNativePackageNames(
        info('bun-linux-arm64', 'linux', 'arm64'),
      ),
      ...getOpenTuiNativePackageNames(info('bun-darwin-x64', 'darwin', 'x64')),
      ...getOpenTuiNativePackageNames(
        info('bun-darwin-arm64', 'darwin', 'arm64'),
      ),
      ...getOpenTuiNativePackageNames(info('bun-windows-x64', 'win32', 'x64')),
    ]
    expect(new Set(produced).size).toBe(produced.length)
    for (const name of produced) {
      expect(declared).toContain(name)
    }
  })
})

describe('findBinaryEnvLeaks', () => {
  test('clean canonical env yields zero leaks', () => {
    expect(
      findBinaryEnvLeaks(canonicalEnv(), CANONICAL_NEXT_PUBLIC_DEFAULTS),
    ).toEqual([])
  })

  test('flags a dev NEXT_PUBLIC_* value (localhost / personal email / dummy key)', () => {
    // Real-world leak vectors: the build shell and repo .env.local inject dev
    // URLs, personal emails, and dummy keys. NEXT_PUBLIC_CB_ENVIRONMENT is
    // deliberately absent here — main() force-sets it to prod before the
    // overlay, so it can never reach env.json as a dev value.
    const leaked = canonicalEnv()
    leaked.NEXT_PUBLIC_SAVANT_CODE_APP_URL = 'http://localhost:3000'
    leaked.NEXT_PUBLIC_SUPPORT_EMAIL = 'me@example.com'
    leaked.NEXT_PUBLIC_POSTHOG_API_KEY = 'phc_dummy'
    leaked.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_dummy'

    const leaks = findBinaryEnvLeaks(leaked, CANONICAL_NEXT_PUBLIC_DEFAULTS)
    expect(leaks).toHaveLength(4)
    for (const leak of leaks) {
      expect(leak.key).toStartWith('NEXT_PUBLIC_')
      expect(leak.actual).not.toBe(leak.expected)
    }
    const byKey = Object.fromEntries(leaks.map((l) => [l.key, l]))
    expect(byKey.NEXT_PUBLIC_SAVANT_CODE_APP_URL).toEqual({
      key: 'NEXT_PUBLIC_SAVANT_CODE_APP_URL',
      expected: 'https://savant-code.com',
      actual: 'http://localhost:3000',
    })
    expect(byKey.NEXT_PUBLIC_SUPPORT_EMAIL.actual).toBe('me@example.com')
  })

  test('flags every canonical key when the env is entirely absent', () => {
    const leaks = findBinaryEnvLeaks(
      { NODE_ENV: 'production' },
      CANONICAL_NEXT_PUBLIC_DEFAULTS,
    )
    expect(leaks).toHaveLength(
      Object.keys(CANONICAL_NEXT_PUBLIC_DEFAULTS).length,
    )
    for (const leak of leaks) {
      expect(leak.actual).toBe('<unset>')
    }
  })

  test('flags a canonical key that is missing entirely', () => {
    const missing = canonicalEnv()
    delete missing.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

    const leaks = findBinaryEnvLeaks(missing, CANONICAL_NEXT_PUBLIC_DEFAULTS)
    expect(leaks).toHaveLength(1)
    expect(leaks[0]).toEqual({
      key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      expected: 'pk_release_placeholder',
      actual: '<unset>',
    })
  })

  test('flags an unexpected NEXT_PUBLIC_* key not in the canonical set', () => {
    const extra = canonicalEnv()
    extra.NEXT_PUBLIC_SOMETHING_NEW = 'whatever'

    const leaks = findBinaryEnvLeaks(extra, CANONICAL_NEXT_PUBLIC_DEFAULTS)
    expect(leaks).toHaveLength(1)
    expect(leaks[0]).toEqual({
      key: 'NEXT_PUBLIC_SOMETHING_NEW',
      expected: '<none>',
      actual: 'whatever',
    })
  })

  test('ignores non-NEXT_PUBLIC_ keys entirely', () => {
    const env = canonicalEnv()
    env.SAVANT_CODE_CLI_VERSION = '0.0.99'
    env.NODE_ENV = 'test'
    env.PATH = '/usr/bin'

    expect(findBinaryEnvLeaks(env, CANONICAL_NEXT_PUBLIC_DEFAULTS)).toEqual([])
  })
})

describe('evaluateBinaryEnvIntegrity — escape hatches', () => {
  function devLeakedEnv(): Record<string, string> {
    const env = canonicalEnv()
    env.NEXT_PUBLIC_SAVANT_CODE_APP_URL = 'http://localhost:3000'
    env.NEXT_PUBLIC_SUPPORT_EMAIL = 'me@example.com'
    return env
  }

  test('release gate blocks the build when leaks exist and no escape hatch is set', () => {
    const decision = evaluateBinaryEnvIntegrity(
      devLeakedEnv(),
      CANONICAL_NEXT_PUBLIC_DEFAULTS,
    )
    expect(decision.block).toBe(true)
    expect(decision.reason).toBeNull()
    expect(decision.warning).toBeNull()
    expect(decision.leaks.map((l) => l.key)).toEqual([
      'NEXT_PUBLIC_SAVANT_CODE_APP_URL',
      'NEXT_PUBLIC_SUPPORT_EMAIL',
    ])
  })

  test('SAVANT_CODE_BUILD_ENV (dev build) skips the gate and warns', () => {
    const decision = evaluateBinaryEnvIntegrity(
      devLeakedEnv(),
      CANONICAL_NEXT_PUBLIC_DEFAULTS,
      { devBuild: true },
    )
    expect(decision.block).toBe(false)
    expect(decision.reason).toBe('dev-build')
    expect(decision.warning).toContain('2 NEXT_PUBLIC_* override(s) accepted')
    expect(decision.warning).toContain('(dev build)')
    expect(decision.warning).toContain(
      'NEXT_PUBLIC_SAVANT_CODE_APP_URL = "http://localhost:3000"',
    )
    // The warning is what main() logs; the env still ships with the dev
    // value — the escape hatch is explicit, not silent.
    expect(decision.leaks).toHaveLength(2)
  })

  test('SAVANT_CODE_ALLOW_NEXT_PUBLIC_OVERRIDES=1 accepts overrides with an explicit-override warning', () => {
    const decision = evaluateBinaryEnvIntegrity(
      devLeakedEnv(),
      CANONICAL_NEXT_PUBLIC_DEFAULTS,
      { allowOverrides: true },
    )
    expect(decision.block).toBe(false)
    expect(decision.reason).toBe('override')
    expect(decision.warning).toContain('2 NEXT_PUBLIC_* override(s) accepted')
    expect(decision.warning).toContain('(explicit override)')
    expect(decision.warning).not.toContain('(dev build)')
  })

  test('dev build wins over the override label when both are set', () => {
    const decision = evaluateBinaryEnvIntegrity(
      devLeakedEnv(),
      CANONICAL_NEXT_PUBLIC_DEFAULTS,
      { devBuild: true, allowOverrides: true },
    )
    expect(decision.block).toBe(false)
    expect(decision.reason).toBe('dev-build')
    expect(decision.warning).toContain('(dev build)')
  })

  test('clean env with escape hatches set yields no warning', () => {
    const decision = evaluateBinaryEnvIntegrity(
      canonicalEnv(),
      CANONICAL_NEXT_PUBLIC_DEFAULTS,
      { devBuild: true },
    )
    expect(decision.block).toBe(false)
    expect(decision.reason).toBeNull()
    expect(decision.warning).toBeNull()
    expect(decision.leaks).toEqual([])
  })
})
