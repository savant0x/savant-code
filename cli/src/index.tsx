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

import fs from 'fs'
import os from 'os'
import path from 'path'

import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import { isCI } from '@savant-code/common/env-ci'
import { getProjectFileTree } from '@savant-code/common/project-file-tree'
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from '@tanstack/react-query'
import { cyan, green, red, yellow } from 'picocolors'
import React from 'react'

import { App } from './app'
import { loadPackageVersion, parseArgs } from './cli-args'
import { handlePublish } from './commands/publish'
import { runStandaloneRelease } from './commands/release/release-command'
import { normalizeReleaseCommand } from './commands/release/release-runner'
import { ErrorBoundary } from './components/error-boundary'
import { runHeadlessPrint } from './headless-run'
import { initializeApp } from './init/init-app'
import { runPlainLogin } from './login/plain-login'
import { getProjectRoot, setProjectRoot } from './project-files'
import { trackEvent } from './utils/analytics'
import { getAuthToken, getAuthTokenDetails } from './utils/auth'
import { runHeadlessAutoDrive } from './utils/auto-drive-headless'
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
import { saveRecentProject } from './utils/recent-projects'
import { installProcessCleanupHandlers } from './utils/renderer-cleanup'
import { setApiClientAuthToken } from './utils/savant-code-api'
import { resetSavantCodeClient } from './utils/savant-code-client'
import {
  hasAnalyticsNoticeBeenShown,
  loadAnalyticsEnabled,
  markAnalyticsNoticeShown,
} from './utils/settings'
import { initializeSkillRegistry } from './utils/skill-registry'
import { detectTerminalTheme } from './utils/terminal-color-detection'
import { TERMINAL_RESET_SEQUENCES } from './utils/terminal-reset-sequences'
import {
  startTerminalWatchdog,
  stopTerminalWatchdog,
} from './utils/terminal-watchdog'
import { setOscDetectedTheme } from './utils/theme-system'

import type { FileTreeNode } from '@savant-code/common/util/file'

// Configure TanStack Query's focusManager for terminal environments
// This is required because there's no browser visibility API in terminal apps
// Without this, refetchInterval won't work because TanStack Query thinks the app is "unfocused"
focusManager.setEventListener(() => {
  // No-op: no event listeners in CLI environment (no window focus/visibility events)
  return () => {}
})
focusManager.setFocused(true)

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes - auth tokens don't change frequently
        gcTime: 10 * 60 * 1000, // 10 minutes - keep cached data a bit longer
        retry: false, // Don't retry failed auth queries automatically
        refetchOnWindowFocus: false, // CLI doesn't have window focus
        refetchOnReconnect: true, // Refetch when network reconnects
        refetchOnMount: false, // Don't refetch on every mount
      },
      mutations: {
        retry: 1, // Retry mutations once on failure
      },
    },
  })
}

/**
 * FID-2026-0806-011: read all piped stdin (used as the headless prompt when
 * a script pipes into the CLI without a positional prompt). Never rejects —
 * a read failure resolves with whatever was captured.
 */
function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    try {
      process.stdin.setEncoding('utf8')
      process.stdin.on('data', (chunk: string) => {
        data += chunk
      })
      process.stdin.on('end', () => resolve(data))
      process.stdin.on('error', () => resolve(data))
      process.stdin.resume()
    } catch {
      resolve(data)
    }
  })
}

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
    const wasmBinary = (
      globalThis as { __SAVANT_CODE_TREE_SITTER_WASM_BINARY__?: Uint8Array }
    ).__SAVANT_CODE_TREE_SITTER_WASM_BINARY__
    const wasmPath = (
      globalThis as { __SAVANT_CODE_TREE_SITTER_WASM_PATH__?: string }
    ).__SAVANT_CODE_TREE_SITTER_WASM_PATH__

    // Diagnostic dump so CI logs (and bug reports) show exactly what
    // the runtime saw when smoke fails. process.execPath, the
    // siblingPath we expect, and what's actually in that directory.
    const fs = await import('fs')
    const path = await import('path')
    const execDir = path.dirname(process.execPath)
    const siblingPath = path.join(execDir, 'tree-sitter.wasm')
    let dirListing: string[] = []
    try {
      dirListing = fs.readdirSync(execDir)
    } catch (err) {
      dirListing = [
        `<readdir failed: ${err instanceof Error ? err.message : err}>`,
      ]
    }
    // eslint-disable-next-line no-console -- CLI smoke diagnostic; logger is not yet initialized
    console.error(
      `[smoke diag] execPath=${process.execPath}\n` +
        `[smoke diag] execDir=${execDir}\n` +
        `[smoke diag] siblingPath=${siblingPath}\n` +
        `[smoke diag] siblingExists=${fs.existsSync(siblingPath)}\n` +
        `[smoke diag] dir contents (${dirListing.length}): ${dirListing.slice(0, 30).join(', ')}\n` +
        `[smoke diag] globalThis wasmPath=${wasmPath ?? '<unset>'}\n` +
        `[smoke diag] globalThis wasmBinary bytes=${wasmBinary?.byteLength ?? 0}\n`,
    )

    try {
      const { Parser } = await import('web-tree-sitter')
      // Pick the best wasm source available, falling back to the
      // sibling-of-execPath lookup if pre-init couldn't reach it. By
      // main() time process.execPath has stabilized to the disk path
      // even on Windows, where it was the bunfs path during pre-init.
      let effectiveBinary = wasmBinary
      let effectivePath = wasmPath
      if (!effectiveBinary && !effectivePath && fs.existsSync(siblingPath)) {
        effectivePath = siblingPath
        effectiveBinary = new Uint8Array(fs.readFileSync(siblingPath))
      }

      if (effectiveBinary) {
        await Parser.init({ wasmBinary: effectiveBinary })
        // Marker grepped by cli/scripts/smoke-binary.ts — keep this exact text.
        // eslint-disable-next-line no-console -- CLI smoke success marker; logger is not yet initialized
        console.log(
          `tree-sitter smoke ok (wasmBinary, ${effectiveBinary.byteLength} bytes)`,
        )
      } else if (effectivePath) {
        await Parser.init({
          locateFile: (name: string) =>
            name === 'tree-sitter.wasm' ? effectivePath! : name,
        })
        // eslint-disable-next-line no-console -- CLI smoke success marker; logger is not yet initialized
        console.log(`tree-sitter smoke ok (locateFile, path=${effectivePath})`)
      } else {
        // eslint-disable-next-line no-console -- CLI smoke failure; logger is not yet initialized
        console.error(
          'tree-sitter smoke FAIL: no wasm available — pre-init published ' +
            'nothing and the sibling-of-execPath fallback also missed. See ' +
            'the diag above for paths.',
        )
        process.exit(1)
      }
      process.exit(0)
    } catch (err) {
      // eslint-disable-next-line no-console -- CLI smoke failure; logger is not yet initialized
      console.error('tree-sitter smoke FAIL:', err)
      process.exit(1)
    }
  }

  // Run OSC theme detection BEFORE anything else.
  // This MUST happen before OpenTUI starts because OSC responses come through stdin,
  // and OpenTUI also listens to stdin. Running detection here ensures stdin is clean.
  if (process.stdin.isTTY && process.platform !== 'win32') {
    try {
      const oscTheme = await detectTerminalTheme()
      if (oscTheme) {
        setOscDetectedTheme(oscTheme)
      }
    } catch {
      // Silently ignore OSC detection failures
    }
  }

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
    print,
    designInput,
    auto,
    spec,
    planFile,
    approve,
    planOnly,
  } = parseArgs()

  if (designInput) {
    try {
      const source =
        designInput === '-'
          ? await readStdin()
          : await fs.promises.readFile(path.resolve(designInput), 'utf8')
      const parsed = JSON.parse(source) as unknown
      const { saveCustomDesignSystem, validateDesignInput } =
        await import('./utils/design-system-service')
      const validation = validateDesignInput(parsed)
      if (!validation.ok) {
        throw new Error(`${validation.code}: ${validation.message}`)
      }
      const result = saveCustomDesignSystem(
        parsed as Parameters<typeof saveCustomDesignSystem>[0],
      )
      // eslint-disable-next-line no-console -- machine-readable authoring result
      console.log(JSON.stringify({ ok: true, resource: result }))
      process.exit(0)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const code = message.startsWith('INTERACTIVE_INPUT_REQUIRED')
        ? 'INTERACTIVE_INPUT_REQUIRED'
        : 'DESIGN_INPUT_INVALID'
      // eslint-disable-next-line no-console -- machine-readable authoring error
      console.error(JSON.stringify({ ok: false, code, message }))
      process.exit(2)
    }
  }

  const isLoginCommand = command === 'login'
  const isPublishCommand = command === 'publish'
  const isReleaseCommand = command === 'release'
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

  // Handle explicit command invocations before generic non-TTY routing.
  // Login is a command, not a prompt: in smoke tests, CI, and scripted shells
  // stdin is non-TTY, but that must not turn `savant-free login` into a
  // headless `--print` invocation.
  if (isLoginCommand && !print) {
    await runPlainLogin()
    return
  }

  // Release command flow: `savant-code release <op>` runs the public release
  // engine standalone and exits with its result code.
  // Handled before the headless branch so scripted (non-TTY) invocations run
  // the release rather than being treated as a headless prompt.
  if (isReleaseCommand) {
    // parseArgs joins every positional arg into initialPrompt (including the
    // `release` word itself, e.g. `release status` → 'release status'), so the
    // operation is the first token after the command word. A bare `release`
    // shows usage; a known operation runs the release engine. Any other
    // first-word `release …` (e.g. a real prompt like "release the docs")
    // falls through to the normal prompt path instead of being hijacked.
    const releaseOp = initialPrompt?.trim().split(/\s+/).slice(1)[0]
    if (releaseOp === undefined || normalizeReleaseCommand(releaseOp)) {
      const exitCode = await runStandaloneRelease(releaseOp)
      process.exit(exitCode)
    }
  }

  // FID-2026-0818-008: Auto Drive headless entry. `--auto` is a headless mode
  // flag (the TUI `/auto` slash command is the interactive path, child 002) —
  // it runs the full drive cycle with no TUI and no runtime ask_user, emitting
  // an exit code as the completion certificate. Handled before the generic
  // `--print`/stdin/CI branch so an explicit `--auto` never falls through to
  // a single-turn print.
  if (auto !== undefined) {
    const result = await runHeadlessAutoDrive({
      goal: auto,
      spec,
      planFile,
      approve,
      planOnly,
      continueChat,
      continueId,
      projectRoot: getProjectRoot(),
    })
    if (result.output !== undefined) {
      // eslint-disable-next-line no-console -- headless stdout contract
      console.log(result.output)
    }
    if (result.error) {
      // eslint-disable-next-line no-console -- headless stderr contract
      console.error(red(`Error: ${result.error}`))
    }
    process.exit(result.exitCode)
  }

  // Headless / non-interactive mode (FID-2026-0806-011): explicit `--print`,
  // piped stdin, or CI. Runs a single prompt through the SDK and prints the
  // final answer to stdout, exiting non-zero on failure. Never enters the TUI
  // — a piped/scripted invocation that fails must not read as a hang.
  if (print || !process.stdin.isTTY || isCI()) {
    // Piped stdin: `echo "refactor this" | savant-code` uses stdin as the
    // prompt. Only read stdin when it is actually piped — with a TTY we never
    // get here unless --print was passed without a prompt, which is a usage
    // error handled below.
    let headlessPrompt = initialPrompt
    if (!headlessPrompt && !process.stdin.isTTY) {
      headlessPrompt = await readStdin()
    }

    // Local agent overrides only apply in interactive sessions; --agent is
    // honored in headless mode so scripted runs can pin an agent id.
    if (!hasAgentOverride) {
      await initializeAgentRegistry()
    }

    const result = await runHeadlessPrint({
      prompt: headlessPrompt ?? '',
      agentId: hasAgentOverride ? agent : undefined,
      continueChat,
      continueId,
    })

    if (result.output !== undefined) {
      // eslint-disable-next-line no-console -- headless stdout contract
      console.log(result.output)
    }
    if (result.error) {
      // eslint-disable-next-line no-console -- headless stderr contract
      console.error(red(`Error: ${result.error}`))
    }
    process.exit(result.exitCode)
  }

  // FID-2026-0806-015: disclose the default-on analytics once, to brand-new
  // users, before the TUI starts. Printed to stderr so it never corrupts
  // piped stdout; the notice retires after the first show.
  if (loadAnalyticsEnabled() && !hasAnalyticsNoticeBeenShown()) {
    // eslint-disable-next-line no-console -- first-run disclosure banner
    console.error(
      yellow(
        'Note: anonymous usage analytics are enabled by default. Run /telemetry disable to turn them off.',
      ),
    )
    markAnalyticsNoticeShown()
  }

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

  const AppWithAsyncAuth = () => {
    const [requireAuth, setRequireAuth] = React.useState<boolean | null>(null)
    const [hasInvalidCredentials, setHasInvalidCredentials] =
      React.useState(false)
    const [fileTree, setFileTree] = React.useState<FileTreeNode[]>([])
    const [currentProjectRoot, setCurrentProjectRoot] =
      React.useState(projectRoot)
    const [showProjectPickerScreen, setShowProjectPickerScreen] =
      React.useState(showProjectPicker)

    React.useEffect(() => {
      // In direct-provider mode (DIRECT_PROVIDER set + gateway keys), the CLI
      // does not use the SavantCode backend for inference, so backend auth
      // validation is unnecessary and would fail with a stub/dev token.
      // Inline the check to avoid importing the env helper before dotenv is
      // loaded in this early boot module.
      if (process.env.DIRECT_PROVIDER?.trim().length) {
        setRequireAuth(false)
        setHasInvalidCredentials(false)
        return
      }

      const apiKey = getAuthTokenDetails().token ?? ''

      if (!apiKey) {
        setRequireAuth(true)
        setHasInvalidCredentials(false)
        return
      }

      // A token is present in backend mode; show the invalid-credentials
      // banner optimistically. It will be cleared once useAuthQuery succeeds.
      setHasInvalidCredentials(true)
      setRequireAuth(false)
    }, [])

    const loadFileTree = React.useCallback(async (root: string) => {
      try {
        if (root) {
          const tree = await getProjectFileTree({
            projectRoot: root,
            fs: fs.promises,
          })
          setFileTree(tree)
        }
      } catch (error) {
        // Silently fail - fileTree is optional for @ menu
      }
    }, [])

    React.useEffect(() => {
      loadFileTree(currentProjectRoot)
    }, [currentProjectRoot, loadFileTree])

    // Callback for when user selects a new project from the picker
    const handleProjectChange = React.useCallback(
      async (newProjectPath: string) => {
        // Change process working directory
        process.chdir(newProjectPath)

        // Track directory change (avoid logging full paths for privacy)
        const isGitRepo = fs.existsSync(path.join(newProjectPath, '.git'))
        const pathDepth = newProjectPath.split(path.sep).filter(Boolean).length
        trackEvent(AnalyticsEvent.CHANGE_DIRECTORY, {
          isGitRepo,
          pathDepth,
          isHomeDir: newProjectPath === os.homedir(),
        })
        // Update the project root in the module state
        setProjectRoot(newProjectPath)
        // Reset client to ensure tools use the updated project root
        resetSavantCodeClient()
        // Save to recent projects list
        saveRecentProject(newProjectPath)
        // Update local state
        setCurrentProjectRoot(newProjectPath)
        // Reset file tree state to trigger reload
        setFileTree([])
        // Hide the picker and show the chat
        setShowProjectPickerScreen(false)
      },
      [],
    )

    return (
      <App
        initialPrompt={initialPrompt}
        agentId={agent}
        requireAuth={requireAuth}
        hasInvalidCredentials={hasInvalidCredentials}
        fileTree={fileTree}
        continueChat={continueChat}
        continueChatId={continueId ?? undefined}
        initialMode={initialMode}
        initialPermissionMode={initialPermissionMode}
        showProjectPicker={showProjectPickerScreen}
        onProjectChange={handleProjectChange}
      />
    )
  }

  // Install early error handlers BEFORE renderer creation.
  // If the renderer crashes during init, these ensure the error is visible
  // by exiting the alternate screen buffer before printing the error.
  const earlyFatalHandler = (error: unknown) => {
    stopTerminalWatchdog() // we reset the terminal ourselves below
    try {
      if (process.stdin.isTTY && process.stdin.setRawMode) {
        process.stdin.setRawMode(false)
      }
    } catch {
      // stdin may be closed
    }
    try {
      if (process.stdout.isTTY) {
        process.stdout.write(TERMINAL_RESET_SEQUENCES)
      }
    } catch {
      // stdout may be closed
    }
    try {
      // eslint-disable-next-line no-console -- Fatal startup error before logger is available
      console.error('Fatal error during startup:', error)
    } catch {
      // stderr may be closed
    }
    process.exit(1)
  }
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
        <AppWithAsyncAuth />
      </ErrorBoundary>
    </QueryClientProvider>,
  )
}

void main()
