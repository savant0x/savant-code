#!/usr/bin/env bun

// Load repo-root .env.local into process.env BEFORE any @savant-code/common import
// triggers environment validation. Required because `bun dev` runs with `--cwd ..`,
// which disables Bun's dotenv auto-loader. See cli/src/pre-init/load-dev-env.ts.
import './pre-init/load-dev-env'

// Embed tree-sitter.wasm into the bun-compile binary at a bunfs path the runtime
// can find. Without this, web-tree-sitter resolves the wasm via require.resolve,
// which (since 0.25.10's split exports map) returns the build-time absolute path
// of tree-sitter.cjs and fails on user machines. Must run before the SDK / code-map
// import chain triggers Parser.init.
import './pre-init/tree-sitter-wasm'

import os from 'os'

import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import { QueryClientProvider } from '@tanstack/react-query'
import { cyan, green, red, yellow } from 'picocolors'

import { loadPackageVersion, parseArgs } from './cli-args'
import {
  detectAndApplyOscTheme,
  discloseAnalyticsNoticeOnce,
} from './cli-boot-steps'
import { dispatchCommandsAndHeadless } from './cli-command-dispatch'
import { handleDesignInput } from './cli-design-input'
import { runTreeSitterSmokeCheck } from './cli-smoke-tree-sitter'
import { handlePublish } from './commands/publish'
import { AppWithAsyncAuth } from './components/app-with-async-auth'
import { ErrorBoundary } from './components/error-boundary'
import { initializeApp } from './init/init-app'
import { getProjectRoot } from './project-files'
import { createQueryClient } from './query-client-setup'
import { trackEvent } from './utils/analytics'
import { getAuthToken } from './utils/auth'
import { trimOversizedChatLogs } from './utils/chat-history'
import { IS_SAVANT_FREE } from './utils/constants'
import { startEngagementTracking } from './utils/engagement'
import { shouldSuppressExplicitWidthQuery } from './utils/env'
import { initializeAgentRegistry } from './utils/local-agent-registry'
import { clearLogFile, logger } from './utils/logger'
import {
  applyPersistedDirectProviderSettings,
  detectOllamaAndConfigureDirectProvider,
} from './utils/ollama-onboarding'
import { fetchGatewayModels } from './utils/openrouter-models'
import { applyPostProcessing } from './utils/post-processing'
import { shouldShowProjectPicker } from './utils/project-picker'
import {
  applyPersistedProviderApiKeys,
  applyPersistedResearchApiKeys,
  configureDefaultDirectProvider,
} from './utils/provider-setup'
import {
  createEarlyFatalHandler,
  installProcessCleanupHandlers,
} from './utils/renderer-cleanup'
import { setApiClientAuthToken } from './utils/savant-code-api'
import { initializeSkillRegistry } from './utils/skill-registry'
import { startTerminalWatchdog } from './utils/terminal-watchdog'

async function main(): Promise<void> {
  // Handle --version / -v early — before Commander and before any
  // initialization. Commander uses process.stdout.write() which buffers
  // in piped/non-TTY environments; process.exit(0) then kills the process
  // before the buffer flushes. console.log() is synchronous and safe.
  // This also skips the prebuild step overhead for a trivial output.
  if (process.argv.includes('--version') || process.argv.includes('-v')) {
    // eslint-disable-next-line no-console
    console.log(loadPackageVersion())
    process.exit(0)
  }

  // CI gate: `<binary> --smoke-tree-sitter` proves the embedded wasm boots
  // through Parser.init end-to-end. Has to live BEFORE commander.parse() —
  // an earlier attempt put this in a pre-init module with top-level await,
  // and on Windows that didn't actually pause module evaluation (commander
  // still ran first and rejected the unknown flag).
  if (process.argv.includes('--smoke-tree-sitter')) {
    await runTreeSitterSmokeCheck()
  }

  await detectAndApplyOscTheme()

  const args = parseArgs()
  const {
    initialPrompt,
    command,
    agent,
    clearLogs,
    continue: continueChat,
    continueId,
    cwd,
    initialMode,
    initialPermissionMode,
    designInput,
  } = args

  if (designInput) {
    await handleDesignInput(designInput)
  }

  const isPublishCommand = command === 'publish'
  const hasAgentOverride = Boolean(agent?.trim())

  await initializeApp({ cwd })

  // Load persisted direct-provider keys first. Explicit environment variables
  // remain authoritative, and a saved gateway key must win over an older
  // auto-configured Ollama setting.
  applyPersistedProviderApiKeys()

  // Load persisted research BYOK keys (Serper/Context7/Parallel/Tavily/Exa/
  // Firecrawl). Explicit environment variables remain authoritative.
  applyPersistedResearchApiKeys()

  // Restore any persisted direct-provider choice (e.g. local Ollama) only when
  // no saved provider key or explicit shell provider already selected a mode.
  applyPersistedDirectProviderSettings()

  // Auto-detect Ollama on first run and route inference to the local daemon
  // when no backend token or explicit direct provider is configured.
  await detectOllamaAndConfigureDirectProvider()

  // Keep the first-run default model usable without forcing a backend login.
  // Ollama wins when available; otherwise the selected gateway runs in direct
  // mode and reports its exact /provider setup instruction if keyless.
  configureDefaultDirectProvider()

  // Set the auth token for the API client
  setApiClientAuthToken(getAuthToken())

  // Command + headless dispatch (login, release, --auto, --print/piped/CI).
  // Handled invocations terminate or return; false falls through to the
  // interactive path below.
  if (await dispatchCommandsAndHeadless(args)) {
    return
  }

  discloseAnalyticsNoticeOnce()

  // Show project picker only when user starts at the home directory or an ancestor
  const projectRoot = getProjectRoot()
  const homeDir = os.homedir()
  const startCwd = process.cwd()
  const showProjectPicker = shouldShowProjectPicker(startCwd, homeDir)

  // Requires analytics to be initialized, which is done in initializeApp
  trackEvent(AnalyticsEvent.APP_LAUNCHED, {
    version: loadPackageVersion(),
    platform: process.platform,
    arch: process.arch,
    hasInitialPrompt: Boolean(initialPrompt),
    hasAgentOverride: hasAgentOverride,
    continueChat,
    initialMode: initialMode ?? 'HYBRID',
    isSavantFree: IS_SAVANT_FREE,
  })

  // Initialize agent registry (loads user agents via SDK).
  // When --agent is provided, skip local .agents to avoid overrides.
  if (isPublishCommand || !hasAgentOverride) {
    await initializeAgentRegistry()
  }

  // Initialize skill registry (loads skills from .agents/skills)
  await initializeSkillRegistry()

  // Warm the gateway model catalog in the background so the model picker and
  // agent model-info block have fresh metadata. Non-blocking: if it fails,
  // the app continues and the placeholder falls back to the model id.
  fetchGatewayModels().catch(() => {})

  // Handle publish command before rendering the app
  if (isPublishCommand) {
    const publishIndex = process.argv.indexOf('publish')
    const agentIds = process.argv.slice(publishIndex + 1)
    const result = await handlePublish(agentIds)

    if (result.success && result.publisherId && result.agents) {
      logger.info(green('✅ Successfully published:'))
      for (const agent of result.agents) {
        logger.info(
          cyan(
            `  - ${agent.displayName} (${result.publisherId}/${agent.id}@${agent.version})`,
          ),
        )
      }
      process.exit(0)
    } else {
      logger.error(red('❌ Publish failed'))
      if (result.error) logger.error(red(`Error: ${result.error}`))
      if (result.details) logger.error(red(result.details))
      if (result.hint) logger.warn(yellow(`Hint: ${result.hint}`))
      process.exit(1)
    }
  }

  if (clearLogs) {
    clearLogFile()
  }

  // Reclaim disk from oversized debug logs left by older versions that logged
  // the full conversation to log.jsonl. Deferred to keep the stat sweep over
  // chat directories off the startup path.
  setTimeout(trimOversizedChatLogs, 0)

  const queryClient = createQueryClient()

  // Install early error handlers BEFORE renderer creation.
  // If the renderer crashes during init, these ensure the error is visible
  // by exiting the alternate screen buffer before printing the error.
  const earlyFatalHandler = createEarlyFatalHandler()
  process.on('uncaughtException', earlyFatalHandler)
  process.on('unhandledRejection', earlyFatalHandler)

  // Last line of defense for uncatchable deaths (SIGKILL, native crashes,
  // kill sweeps that also take out the npm wrapper): a detached process
  // (sh on POSIX, PowerShell on Windows) that resets the terminal when this
  // process disappears. Started before the renderer begins enabling terminal
  // modes; the clean-shutdown path (renderer-cleanup) disarms it.
  startTerminalWatchdog()

  // Windows Console (legacy conhost) does not answer OpenTUI's OSC 66
  // explicit-width query, so the escape sequence leaks a literal "66" artifact
  // into stdout. Suppress the query on the legacy-console floor before the
  // renderer arms it; conpty-backed terminals (WT_SESSION set) keep it.
  if (shouldSuppressExplicitWidthQuery()) {
    process.env.OPENTUI_FORCE_EXPLICIT_WIDTH = 'false'
  }

  const renderer = await createCliRenderer({
    // React's AppShell paints the resolved theme after initializeApp; keep the
    // renderer transparent only as the infrastructure fallback before mount.
    backgroundColor: 'transparent',
    exitOnCtrlC: false,
    screenMode: 'alternate-screen',
    postProcessFns: [applyPostProcessing],
  })

  // Remove early handlers — proper cleanup handlers (with renderer access) take over
  process.removeListener('uncaughtException', earlyFatalHandler)
  process.removeListener('unhandledRejection', earlyFatalHandler)
  installProcessCleanupHandlers(renderer)

  // Start the engaged-time heartbeat only once the interactive TUI is actually
  // live — reaching renderer creation means this is a real session (the
  // login/publish/smoke-test commands all exit earlier). SavantFree-only, matching
  // the MESSAGE_SENT DAU signal. Stopped in exitSavantFreeCleanly().
  if (IS_SAVANT_FREE) {
    startEngagementTracking()
  }

  createRoot(renderer).render(
    <QueryClientProvider client={queryClient}>
      {/* FID-2026-0815-015: a render error anywhere below the root must
          degrade to a visible fallback, not escape to the process-level
          uncaughtException handler (which kills the whole terminal). */}
      <ErrorBoundary
        fallback={
          <text fg="red">
            An unexpected error occurred. The session was stopped safely — run
            `savant-code --continue` to resume.
          </text>
        }
        componentName="AppRoot"
      >
        <AppWithAsyncAuth
          initialPrompt={initialPrompt}
          agentId={agent}
          continueChat={continueChat}
          continueChatId={continueId ?? undefined}
          initialMode={initialMode}
          initialPermissionMode={initialPermissionMode}
          projectRoot={projectRoot}
          showProjectPicker={showProjectPicker}
        />
      </ErrorBoundary>
    </QueryClientProvider>,
  )
}

void main()
