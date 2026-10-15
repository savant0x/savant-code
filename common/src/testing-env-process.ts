import type { BaseEnv, ProcessEnv } from './types/contracts/env'

/**
 * Test-only helpers for process env snapshots.
 * Keep production code using `@savant-code/common/env-process`.
 */
export const createTestBaseEnv = (
  overrides: Partial<BaseEnv> = {},
): BaseEnv => ({
  SHELL: undefined,
  COMSPEC: undefined,
  HOME: '/home/test',
  USERPROFILE: undefined,
  APPDATA: undefined,
  XDG_CONFIG_HOME: undefined,
  TERM: 'xterm-256color',
  TERM_PROGRAM: undefined,
  TERM_BACKGROUND: undefined,
  TERMINAL_EMULATOR: undefined,
  COLORFGBG: undefined,
  NODE_ENV: 'test',
  NODE_PATH: undefined,
  PATH: '/usr/bin',
  ...overrides,
})

export const createTestProcessEnv = (
  overrides: Partial<ProcessEnv> = {},
): ProcessEnv => ({
  ...createTestBaseEnv(),

  // Terminal-specific
  KITTY_WINDOW_ID: undefined,
  SIXEL_SUPPORT: undefined,
  ZED_NODE_ENV: undefined,

  // VS Code family detection
  VSCODE_THEME_KIND: undefined,
  VSCODE_COLOR_THEME_KIND: undefined,
  VSCODE_GIT_IPC_HANDLE: undefined,
  VSCODE_PID: undefined,
  VSCODE_CWD: undefined,
  VSCODE_NLS_CONFIG: undefined,

  // Cursor editor detection
  CURSOR_PORT: undefined,
  CURSOR: undefined,

  // JetBrains IDE detection
  JETBRAINS_REMOTE_RUN: undefined,
  IDEA_INITIAL_DIRECTORY: undefined,
  IDE_CONFIG_DIR: undefined,
  JB_IDE_CONFIG_DIR: undefined,

  // Editor preferences
  VISUAL: undefined,
  EDITOR: undefined,
  SAVANT_CODE_CLI_EDITOR: undefined,
  SAVANT_CODE_EDITOR: undefined,

  // Theme preferences
  OPEN_TUI_THEME: undefined,
  OPENTUI_THEME: undefined,

  // SavantCode CLI-specific
  SAVANT_CODE_IS_BINARY: undefined,
  SAVANT_CODE_CLI_VERSION: undefined,
  SAVANT_CODE_CLI_TARGET: undefined,
  SAVANT_CODE_RG_PATH: undefined,
  SAVANT_CODE_WASM_DIR: undefined,

  // Build/CI flags
  VERBOSE: undefined,
  OVERRIDE_TARGET: undefined,
  OVERRIDE_PLATFORM: undefined,
  OVERRIDE_ARCH: undefined,
  ...overrides,
})
