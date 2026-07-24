/**
 * CLI-specific environment variable types.
 *
 * Extends base types from common with CLI-specific vars for:
 * - Terminal/IDE detection
 * - Editor preferences
 * - Binary build configuration
 */

import type {
  BaseEnv,
  ClientEnv,
} from '@savant-code/common/types/contracts/env'

/**
 * CLI-specific env vars for terminal/IDE detection and editor preferences.
 */
export type CliEnv = BaseEnv & {
  // Windows system paths
  SystemRoot?: string

  // Terminal detection (for tmux/screen passthrough)
  TERM?: string
  TMUX?: string
  STY?: string

  // SSH/remote session detection
  SSH_CLIENT?: string
  SSH_TTY?: string
  SSH_CONNECTION?: string
  CODESPACES?: string

  // Display server detection (Linux headless check)
  DISPLAY?: string
  WAYLAND_DISPLAY?: string

  // Terminal-specific
  KITTY_WINDOW_ID?: string
  SIXEL_SUPPORT?: string
  ZED_NODE_ENV?: string
  ZED_TERM?: string
  ZED_SHELL?: string
  COLORTERM?: string

  // VS Code family detection
  VSCODE_THEME_KIND?: string
  VSCODE_COLOR_THEME_KIND?: string
  VSCODE_GIT_IPC_HANDLE?: string
  VSCODE_PID?: string
  VSCODE_CWD?: string
  VSCODE_NLS_CONFIG?: string

  // Cursor editor detection
  CURSOR_PORT?: string
  CURSOR?: string

  // JetBrains IDE detection
  JETBRAINS_REMOTE_RUN?: string
  IDEA_INITIAL_DIRECTORY?: string
  IDE_CONFIG_DIR?: string
  JB_IDE_CONFIG_DIR?: string

  // Editor preferences
  VISUAL?: string
  EDITOR?: string
  SAVANT_CODE_CLI_EDITOR?: string
  SAVANT_CODE_EDITOR?: string

  // Theme preferences
  OPEN_TUI_THEME?: string
  OPENTUI_THEME?: string

  // SavantCode CLI-specific (set during binary build)
  SAVANT_CODE_IS_BINARY?: string
  SAVANT_CODE_CLI_VERSION?: string
  SAVANT_CODE_CLI_TARGET?: string
  SAVANT_CODE_RG_PATH?: string
  SAVANT_CODE_SCROLL_MULTIPLIER?: string
  SAVANT_CODE_PERF_TEST?: string
  SAVANT_CODE_TRACE?: string
  // Toggle for mirroring CLI logs to the server's /api/logs sink (Axiom).
  SAVANT_CODE_SHIP_LOGS?: string
  SAVANT_FREE_MODE?: string
  // Direct-provider mode: launch without the SavantCode backend, routing
  // inference straight to the provider named here (e.g. "openrouter").
  // When set, the CLI skips backend connection pings and agent/validate
  // calls — agents are bundled locally and inference goes via
  // INFERENCE_BASE_URL. Keeps the backend seam intact for later.
  DIRECT_PROVIDER?: string
  // Optional direct inference endpoint URL (e.g. OpenRouter API).
  // If set, the CLI also operates in direct-provider mode even when
  // DIRECT_PROVIDER is not explicitly set.
  INFERENCE_BASE_URL?: string
}

/**
 * Full CLI env deps combining client env and CLI env.
 */
export type CliEnvDeps = {
  clientEnv: ClientEnv
  env: CliEnv
}

/**
 * Function type for getting CLI env values.
 */
export type GetCliEnvFn = () => CliEnv
