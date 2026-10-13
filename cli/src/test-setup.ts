import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Must evaluate before any module that imports common/env (analytics below):
// pins NEXT_PUBLIC_CB_ENVIRONMENT away from prod so the config-dir override
// stays effective even when tests run under the release-gate profile.
import './test-env'
import { beforeEach } from 'bun:test'

import { resetLogoCache } from './branding/constants'
import { resetRefreshInFlight } from './chat/provider-notification-lifecycle'
import { resetWorkerClassPromise } from './commands/graph-export/elk-worker'
import { resetToolComponentRegistry } from './components/tools/registry'
import { resetActivityQueryCache } from './hooks/activity-query/cache'
import { resetRetryState } from './hooks/activity-query/retry-state'
import { resetHintedErrors } from './hooks/helpers/send-message/fallback-hints'
import { resetExitHandlerRegistered } from './hooks/use-exit-handler'
import { resetPollController } from './hooks/use-savant-free-session/session-state'
import { resetUseThemeState } from './hooks/use-theme'
import { resetUseToastState } from './hooks/use-toast'
import { resetRgPathCache } from './native/ripgrep'
import { resetProjectFilesState } from './project-files'
import { resetPresenceState } from './state/presence'
import { resetTeacherOverrides } from './teacher/runtime'
import { resetActiveRun } from './utils/active-run'
import { resetActivityTracker } from './utils/activity-tracker'
import { disableAnalytics } from './utils/analytics'
import { resetLoggerModulePromise } from './utils/analytics/debug-log'
import { resetAnalyticsErrorLogger } from './utils/analytics/errors'
import { resetAnalyticsConsentListener } from './utils/analytics/state'
import { resetAnonymousIdCache } from './utils/anonymous-id'
import { resetThinkingIdCounter } from './utils/block-operations/thinking-id'
import { resetChatgptOauthState } from './utils/chatgpt-oauth'
import { resetClipboardState } from './utils/clipboard'
import { resetRegisteredRenderer } from './utils/clipboard-renderer'
import { resetFidPathsCache } from './utils/create-run-config'
import { resetCachedShell } from './utils/detect-shell'
import { resetEngagementState } from './utils/engagement'
import { resetFingerprintState } from './utils/fingerprint'
import { resetRefreshInFlight as resetFreeOptionsRefresh } from './utils/free-options'
import { resetTimestampFormatter } from './utils/helpers'
import { resetLogShipperState } from './utils/log-shipper'
import { resetFileSinkState } from './utils/logger/file-sink'
import { clearModelAutoWire } from './utils/model-picker-autowire'
import { resetOllamaOnboardingState } from './utils/ollama-onboarding'
import { resetCustomCatalogState } from './utils/openrouter-models/custom-catalog'
import { __resetOpenRouterModelsCacheForTest } from './utils/openrouter-models/gateway'
import { resetGatewayCoverageState } from './utils/openrouter-models/gateway-coverage'
import { resetPendingAttachmentsState } from './utils/pending-attachments'
import { resetProviderMonitoringState } from './utils/provider-monitoring'
import { resetProviderMonitoringEventsState } from './utils/provider-monitoring-events'
import { resetProviderOffersState } from './utils/provider-offers'
import { resetProviderSetupState } from './utils/provider-setup'
import { resetWizardSession } from './utils/provider-wizard'
import { resetWizardReplayGuard } from './utils/provider-wizard-replay'
import { resetRendererCleanupState } from './utils/renderer-cleanup'
import { resetActiveResearchKeyService } from './utils/research-key-store'
import { resetApiClient } from './utils/savant-code-api/singleton'
import { resetSavantCodeClient } from './utils/savant-code-client'
import { resetLastKnownReferral } from './utils/savant-free-referral-cache'
import { resetRootStreamPublisherState } from './utils/sdk-event-handlers/root-stream-publisher'
import { __resetSkillRegistryForTests } from './utils/skill-registry'
import { resetEmptySyntaxStyleFallback } from './utils/syntax-theme'
import { resetReturnKeySeenForTests } from './utils/terminal-enter-detection'
import { resetCachedProtocol } from './utils/terminal-images'
import { resetTerminalWatchdogState } from './utils/terminal-watchdog'
import { resetThemeConfig } from './utils/theme-config'
import { resetTruecolorSupport } from './utils/theme-system'
import { resetWatcherState } from './utils/theme-system/watcher'
import { resetCachedVersion } from './utils/version'
import { resetAsyncWriteQueues } from './utils/write-file-atomic'

/**
 * Global test setup for the CLI workspace.
 *
 * The repository's local dev environment often has `DIRECT_PROVIDER` and/or
 * `INFERENCE_BASE_URL` set so the app boots in direct-provider mode. Most unit
 * tests, however, exercise the SavantCode API client against a mocked backend
 * and expect backend-mode behavior. This setup clears those variables before
 * every test so that `isDirectProviderMode()` and the SDK's dev-mode bypass
 * return false by default.
 *
 * Tests that specifically want to verify direct-provider behavior can still
 * set these variables in their own `beforeEach`, which runs after this global
 * setup.
 *
 * Telemetry is disabled for the same reason: `trackEvent` intentionally throws
 * in production when it fires before `initAnalytics` establishes a client, and
 * several startup paths (agent-definition loading, direnv, health/init flows)
 * call it before initialization depending on worker scheduling. Disabling
 * analytics here makes the suite deterministic — no test file can crash on an
 * uninitialized telemetry client — while analytics-focused tests still control
 * their own state via `resetAnalyticsState`/`initAnalytics`.
 */
/**
 * FID-2026-1007-006: own the config directory for the whole CLI test process.
 *
 * Isolation used to be opt-in — a per-file harness set
 * `SAVANT_CODE_CONFIG_DIR` for the cases that remembered to, and every other
 * file resolved the operator's own `~/.savant-code-dev` (the suffix
 * `getConfigDir()` appends at `NEXT_PUBLIC_CB_ENVIRONMENT=dev`). The preload is
 * the only place every file inherits, so the override is set once, here, before
 * any test file loads. `registerGatewayCatalogLifecycle()` still narrows it per
 * case and restores whatever this set. The directory is removed on exit.
 */
const testConfigDir = fs.mkdtempSync(
  path.join(os.tmpdir(), 'savant-cli-test-config-'),
)
process.env.SAVANT_CODE_CONFIG_DIR = testConfigDir
process.on('exit', () => {
  fs.rmSync(testConfigDir, { recursive: true, force: true })
})

beforeEach(() => {
  process.env.DIRECT_PROVIDER = ''
  process.env.INFERENCE_BASE_URL = ''
  disableAnalytics()
  resetUseToastState()
  resetLogoCache()
  resetRefreshInFlight()
  resetFreeOptionsRefresh()
  resetWorkerClassPromise()
  resetToolComponentRegistry()
  resetHintedErrors()
  resetExitHandlerRegistered()
  resetPollController()
  resetRgPathCache()
  resetProjectFilesState()
  resetPresenceState()
  resetTeacherOverrides()
  resetActiveRun()
  resetActivityTracker()
  resetActivityQueryCache()
  resetRetryState()
  resetLoggerModulePromise()
  resetAnalyticsErrorLogger()
  resetAnalyticsConsentListener()
  resetAnonymousIdCache()
  resetThinkingIdCounter()
  resetChatgptOauthState()
  resetRegisteredRenderer()
  resetClipboardState()
  resetFidPathsCache()
  resetCachedShell()
  resetEngagementState()
  resetFingerprintState()
  resetTimestampFormatter()
  resetLogShipperState()
  resetFileSinkState()
  clearModelAutoWire()
  resetOllamaOnboardingState()
  resetCustomCatalogState()
  resetGatewayCoverageState()
  __resetOpenRouterModelsCacheForTest()
  resetRootStreamPublisherState()
  resetPendingAttachmentsState()
  resetProviderMonitoringEventsState()
  resetProviderMonitoringState()
  resetProviderOffersState()
  resetProviderSetupState()
  resetWizardReplayGuard()
  resetWizardSession()
  resetRendererCleanupState()
  resetActiveResearchKeyService()
  resetApiClient()
  resetSavantCodeClient()
  resetLastKnownReferral()
  __resetSkillRegistryForTests()
  resetEmptySyntaxStyleFallback()
  resetReturnKeySeenForTests()
  resetCachedProtocol()
  resetTerminalWatchdogState()
  resetThemeConfig()
  resetUseThemeState()
  resetWatcherState()
  resetTruecolorSupport()
  resetCachedVersion()
  resetAsyncWriteQueues()
})
