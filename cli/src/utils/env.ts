/**
 * CLI environment helper for dependency injection.
 *
 * This module provides CLI-specific env helpers that extend the base
 * process env with CLI-specific vars for terminal/IDE detection.
 */

import { getBaseEnv } from '@savant-code/common/env-process'

import type { CliEnv } from '../types/env'

/**
 * Get CLI environment values.
 * Composes from getBaseEnv() + CLI-specific vars.
 */
export const getCliEnv = (): CliEnv => ({
  ...getBaseEnv(),

  // Windows system paths
  SystemRoot: process.env.SystemRoot,

  // Display server detection (Linux headless check)
  DISPLAY: process.env.DISPLAY,
  WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY,

  // Terminal detection (for tmux/screen passthrough)
  TERM: process.env.TERM,
  TMUX: process.env.TMUX,
  STY: process.env.STY,

  // SSH/remote session detection
  SSH_CLIENT: process.env.SSH_CLIENT,
  SSH_TTY: process.env.SSH_TTY,
  SSH_CONNECTION: process.env.SSH_CONNECTION,
  CODESPACES: process.env.CODESPACES,

  // Terminal detection
  KITTY_WINDOW_ID: process.env.KITTY_WINDOW_ID,
  SIXEL_SUPPORT: process.env.SIXEL_SUPPORT,
  ZED_NODE_ENV: process.env.ZED_NODE_ENV,
  ZED_TERM: process.env.ZED_TERM,
  ZED_SHELL: process.env.ZED_SHELL,
  COLORTERM: process.env.COLORTERM,

  // VS Code family detection
  VSCODE_THEME_KIND: process.env.VSCODE_THEME_KIND,
  VSCODE_COLOR_THEME_KIND: process.env.VSCODE_COLOR_THEME_KIND,
  VSCODE_GIT_IPC_HANDLE: process.env.VSCODE_GIT_IPC_HANDLE,
  VSCODE_PID: process.env.VSCODE_PID,
  VSCODE_CWD: process.env.VSCODE_CWD,
  VSCODE_NLS_CONFIG: process.env.VSCODE_NLS_CONFIG,

  // Cursor editor detection
  CURSOR_PORT: process.env.CURSOR_PORT,
  CURSOR: process.env.CURSOR,

  // JetBrains IDE detection
  JETBRAINS_REMOTE_RUN: process.env.JETBRAINS_REMOTE_RUN,
  IDEA_INITIAL_DIRECTORY: process.env.IDEA_INITIAL_DIRECTORY,
  IDE_CONFIG_DIR: process.env.IDE_CONFIG_DIR,
  JB_IDE_CONFIG_DIR: process.env.JB_IDE_CONFIG_DIR,

  // Editor preferences
  VISUAL: process.env.VISUAL,
  EDITOR: process.env.EDITOR,
  SAVANT_CODE_CLI_EDITOR: process.env.SAVANT_CODE_CLI_EDITOR,
  SAVANT_CODE_EDITOR: process.env.SAVANT_CODE_EDITOR,

  // Theme preferences
  OPEN_TUI_THEME: process.env.OPEN_TUI_THEME,
  OPENTUI_THEME: process.env.OPENTUI_THEME,

  // Binary build configuration
  SAVANT_CODE_IS_BINARY: process.env.SAVANT_CODE_IS_BINARY,
  SAVANT_CODE_CLI_VERSION: process.env.SAVANT_CODE_CLI_VERSION,
  SAVANT_CODE_CLI_TARGET: process.env.SAVANT_CODE_CLI_TARGET,
  SAVANT_CODE_RG_PATH: process.env.SAVANT_CODE_RG_PATH,
  SAVANT_CODE_SCROLL_MULTIPLIER: process.env.SAVANT_CODE_SCROLL_MULTIPLIER,
  SAVANT_CODE_PERF_TEST: process.env.SAVANT_CODE_PERF_TEST,
  SAVANT_CODE_TRACE: process.env.SAVANT_CODE_TRACE,
  SAVANT_CODE_SHIP_LOGS: process.env.SAVANT_CODE_SHIP_LOGS,
  SAVANT_FREE_MODE: process.env.SAVANT_FREE_MODE,
  DIRECT_PROVIDER: process.env.DIRECT_PROVIDER,
  INFERENCE_BASE_URL: process.env.INFERENCE_BASE_URL,
})

/**
 * Whether the CLI is running in direct-provider mode (no SavantCode backend).
 * Set DIRECT_PROVIDER=<provider> (e.g. "openrouter") or INFERENCE_BASE_URL
 * to launch against a provider directly. When enabled, the CLI skips backend
 * connection pings and agent/validate calls; agents are bundled locally and
 * inference routes via INFERENCE_BASE_URL. The backend integration path is
 * untouched, so flipping this off (and pointing NEXT_PUBLIC_SAVANT_CODE_APP_URL
 * at a backend) restores full backend mode with zero code rework.
 */
export const isDirectProviderMode = (): boolean => {
  const env = getCliEnv()
  return (
    (env.DIRECT_PROVIDER ?? '').trim().length > 0 ||
    (env.INFERENCE_BASE_URL ?? '').trim().length > 0
  )
}

/**
 * Whether to suppress OpenTUI's OSC 66 explicit-width query.
 *
 * The query leaks a literal "66" artifact into stdout on terminals that do not
 * answer it — most notably Windows Console (legacy conhost). Windows Terminal
 * and other conpty-backed terminals set WT_SESSION; legacy conhost does not, so
 * on win32 a missing WT_SESSION marks the legacy-console floor. Capable
 * terminals keep the query (explicit-width correctness); only the legacy floor
 * opts out.
 */
export const shouldSuppressExplicitWidthQuery = (
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): boolean => platform === 'win32' && !env.WT_SESSION

/**
 * Get the raw system process.env object.
 * Use this when you need to pass the full environment to subprocesses
 * or when you need to set environment variables at runtime.
 */
export const getSystemProcessEnv = (): NodeJS.ProcessEnv => process.env
