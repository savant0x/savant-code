/**
 * Process-wide test isolation for the code-map suite (FID-2026-1007-002).
 *
 * `bun test` loads every file into ONE process, so a module that keeps
 * process-lifetime state leaks across suites: the custom WASM directory and the
 * one-shot init-failure warning one file set are what the next file inherits,
 * and a suite's verdict then depends on file order. `bun run
 * scripts/module-state-check.ts` enumerates every such binding; this preload
 * calls each reset before every case.
 */
import { beforeEach } from 'bun:test'

import { resetLanguagesState } from '../src/languages'

beforeEach(() => {
  resetLanguagesState()
})
