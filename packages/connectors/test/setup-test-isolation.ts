/**
 * Process-wide test isolation for the connectors suite (FID-2026-1007-002).
 *
 * `bun test` loads every file into ONE process, so a module that keeps
 * process-lifetime state leaks across suites: a compiled normalization or a
 * connector bundle one file built is the one the next file finds, and a suite's
 * verdict then depends on file order. `bun run
 * scripts/module-state-check.ts` enumerates every such binding; this preload
 * calls each reset before every case.
 */
import { beforeEach } from 'bun:test'

import { resetNormalizeCache } from '../src/compiler/normalize'
import { resetBundleCache } from '../src/runtime'

beforeEach(() => {
  resetNormalizeCache()
  resetBundleCache()
})
