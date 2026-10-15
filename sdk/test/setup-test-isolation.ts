/**
 * Process-wide test isolation for the sdk suite (FID-2026-1007-002).
 *
 * `bun test` loads every file into ONE process, so a module that keeps
 * process-lifetime state leaks across suites: a cached credential refresh, a
 * resolved key or a probed binary that one file established is the one the next
 * file finds, and a suite's verdict then depends on file order. `bun run
 * scripts/module-state-check.ts` enumerates every such binding; this preload
 * calls each reset before every case.
 */
import { beforeEach } from 'bun:test'

import { resetE2eMocks } from '../e2e/utils/e2e-mocks'
import { resetChatGptRefreshPromise } from '../src/credentials'
import { resetChatGptOAuthRateLimit } from '../src/impl/model-provider/oauth-rate-limit'
import { resetOpenRouterApiKeyCache } from '../src/impl/openrouter-key-resolver'
import { resetProbeCache } from '../src/native/ripgrep'
import { resetPathRgCacheForTests } from '../src/native/ripgrep-path-fallback'
import { resetChildProcessRegistryState } from '../src/tools/child-process-registry'

beforeEach(() => {
  resetChatGptRefreshPromise()
  resetChatGptOAuthRateLimit()
  resetOpenRouterApiKeyCache()
  resetProbeCache()
  resetPathRgCacheForTests()
  resetChildProcessRegistryState()
  resetE2eMocks()
})
