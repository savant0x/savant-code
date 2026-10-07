/**
 * Process-wide test isolation for the common suite (FID-2026-1007-002).
 *
 * `bun test` loads every file into ONE process, so a module that keeps
 * process-lifetime state leaks across suites: the state one file leaves behind
 * is the state the next file starts with, and a suite's verdict then depends on
 * file order. `bun run scripts/module-state-check.ts` enumerates every such
 * binding in the workspace and requires a reset; this preload is where each one
 * is called, before every case.
 *
 * This workspace had NO preload at all before this file — `bun run
 * --cwd=common test` does not load the root `bunfig.toml` preload, so every
 * registry below was shared by every common test file with nothing clearing it.
 */
import { beforeEach } from 'bun:test'

import { resetAnalyticsClient } from '../src/analytics'
import { resetRawEnv } from '../src/env'
import { resetClientState } from '../src/mcp/client'
import { resetObservedAvailability } from '../src/providers/availability-state'
import { resetCustomProviders } from '../src/providers/custom-providers'
import { resetProviderAccountRevisions } from '../src/providers/provider-account-revisions'
import { resetExplicitlyDefinedModels } from '../src/util/model-utils'
import { resetAskUserBridgeState } from '../src/utils/ask-user-bridge'

beforeEach(() => {
  resetRawEnv()
  resetAnalyticsClient()
  resetClientState()
  resetObservedAvailability()
  resetCustomProviders()
  resetProviderAccountRevisions()
  resetExplicitlyDefinedModels()
  resetAskUserBridgeState()
})
