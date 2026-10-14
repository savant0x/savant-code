/**
 * Process-wide test isolation for the desktop suite (FID-2026-1007-002).
 *
 * `bun test` loads every file into ONE process, so a module that keeps
 * process-lifetime state leaks across suites: a shared driver or client one
 * file connected is the one the next file finds, and a suite's verdict then
 * depends on file order. `bun run scripts/module-state-check.ts` enumerates
 * every such binding; this preload calls each reset before every case.
 *
 * Two bindings are named `activeInstances` in different modules, so the import
 * is aliased per module rather than renamed at the source.
 */
import { beforeEach } from 'bun:test'

import { resetSharedDriver } from '../src/floor/driver/deck-live-driver'
import { resetTextureCache } from '../src/floor/office/procedural-textures/machinery'
import { resetTemplateCache } from '../src/floor/office/robot-cast'
import { resetHoveredAgentCursorCount } from '../src/floor/office/scene-agent-ui'
import { resetActiveInstances as resetActivityOverlayInstances } from '../src/floor/stage/activity-overlay'
import { resetDeckRobotsLoaderState } from '../src/floor/stage/deck-robots-loader'
import { resetActiveInstances as resetPerfHudActiveInstances } from '../src/floor/stage/perf-hud'
import { resetSharedClient } from '../src/hooks/use-gateway'

beforeEach(() => {
  resetSharedDriver()
  resetSharedClient()
  resetTextureCache()
  resetTemplateCache()
  resetDeckRobotsLoaderState()
  resetHoveredAgentCursorCount()
  resetActivityOverlayInstances()
  resetPerfHudActiveInstances()
})
