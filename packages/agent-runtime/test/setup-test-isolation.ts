/**
 * Process-wide test isolation for the agent-runtime suite.
 *
 * `bun test` loads every file into ONE process, so any module that keeps
 * process-lifetime state leaks across suites. The provider circuit breaker
 * registry is the one that bit us: it caches one breaker per connection key,
 * and because the shared test fixtures reuse a constant `clientSessionId`,
 * every suite without an injected breaker shares the `legacy:<session>` key.
 * A suite that drives three transient failures therefore opens the circuit for
 * the rest of the run, and later turns are blocked at the boundary before any
 * physical request — 76 failures across the loop-agent-steps, read-docs and
 * web-search families, none of which reproduce when their file runs alone
 * (FID-2026-1007-001).
 *
 * FID-2026-1007-002 widened this from the one registry that bit us to every
 * module-scope registry in the workspace: `bun run scripts/module-state-check.ts`
 * enumerates them, and this file is where each reset is actually called.
 * Resetting before every case keeps the production sharing semantics intact (a
 * single case can still observe state it opened itself) while making each case
 * start from the module's declared initial state.
 */
import { beforeEach } from 'bun:test'

import { resetEnforcementInstances } from '../src/echo/enforcement/factory'
import { __resetYagniEnforcedCacheForTests } from '../src/echo/yagni-pre-write-gate'
import { resetRetentionRegistry } from '../src/evidence/retention-registry'
import { resetEngineCache } from '../src/hooks/engine'
import { resetSessionInstances } from '../src/provenance/registry'
import { resetUnknownShapeLog } from '../src/provider-boundary/classified-stream-retry'
import { resetProviderCircuitBreakers } from '../src/provider-boundary/provider-circuit-breaker'
import { resetLastEmittedCompactionStatus } from '../src/run-agent-step/context-tokens'
import { resetLastEmittedMicroSummary } from '../src/run-agent-step/context-tokens-compaction'
import { resetRunProgrammaticStepState } from '../src/run-programmatic-step/state'
import { resetRulesSourceCache } from '../src/steering/rules-source'
import { resetCheckpointStoreState } from '../src/tools/handlers/tool/checkpoint-store'
import { resetSqliteDatabaseCtor } from '../src/tools/handlers/tool/database/sqlite-adapter'
import { resetProposedContentByRunId } from '../src/tools/handlers/tool/proposed-content-store'
import { resetMaxIterationsCache } from '../src/tools/handlers/tool/transition-phase'
import { clearThinkerConvergenceStateForTests } from '../src/tools/thinker-convergence-gate'
import { resetThoughtSessions } from '../src/tools/thought-session-store'
import { resetFileMutationLanes } from '../src/tools/tool-executor/file-mutation-queue'
import { resetToolOutcomes } from '../src/tools/tool-executor/tool-outcome-state'
import { resetTrustedDefinitions } from '../src/tools/tool-executor/trusted-custom-tool-definitions'
import { resetCacheDebugCounter } from '../src/util/cache-debug'
import { resetCavemanConfigCache } from '../src/util/caveman-rules'
import { resetTokenCounterState } from '../src/util/token-counter'

beforeEach(() => {
  resetProviderCircuitBreakers()
  resetUnknownShapeLog()
  resetEnforcementInstances()
  __resetYagniEnforcedCacheForTests()
  resetEngineCache()
  resetSessionInstances()
  resetRetentionRegistry()
  resetLastEmittedMicroSummary()
  resetLastEmittedCompactionStatus()
  resetRunProgrammaticStepState()
  resetRulesSourceCache()
  resetCheckpointStoreState()
  resetSqliteDatabaseCtor()
  resetProposedContentByRunId()
  resetMaxIterationsCache()
  clearThinkerConvergenceStateForTests()
  resetThoughtSessions()
  resetFileMutationLanes()
  resetToolOutcomes()
  resetTrustedDefinitions()
  resetCacheDebugCounter()
  resetCavemanConfigCache()
  resetTokenCounterState()
})
