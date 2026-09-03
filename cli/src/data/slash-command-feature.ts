import { IS_SAVANT_FREE } from '../utils/constants'

import type { SlashCommand } from './slash-commands'

/**
 * Feature slash-command menu entries (theme:toggle through rewind). The core
 * entries live in `slash-command-core.ts`; the parent splices the mode
 * commands between the two groups.
 */
export const FEATURE_SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'theme:toggle',
    label: 'theme:toggle',
    description: 'Toggle between light and dark mode',
  },
  {
    id: 'end-session',
    label: 'end-session',
    description: 'End your free session (lets you switch model)',
    aliases: ['model'],
  },
  ...(IS_SAVANT_FREE
    ? []
    : [
        {
          id: 'model',
          label: 'model',
          description:
            'Switch the active model (e.g. /model anthropic/claude-opus-4.6)',
          aliases: ['switch-model'],
        },
        {
          id: 'provider',
          label: 'provider',
          description:
            'Configure a provider API key (stored locally and masked)',
        },
        {
          id: 'research-keys',
          label: 'research-keys',
          description:
            'Configure research API keys (Serper/Context7/Parallel/Tavily/Exa/Firecrawl)',
          aliases: ['research-key'],
        },
      ]),
  // FID-2026-0901-006 P21 command audit: auth is a backend surface — in
  // direct-provider mode /login dead-ends with an error, so it is hidden.
  {
    id: 'login',
    label: 'login',
    description: 'Open the login screen',
    aliases: ['signin'],
    implicitCommand: true,
    requiresBackend: true,
  },
  {
    id: 'logout',
    label: 'logout',
    description: 'Sign out of your session',
    aliases: ['signout'],
    implicitCommand: true,
    requiresBackend: true,
  },
  {
    id: 'exit',
    label: 'exit',
    description: 'Quit the CLI',
    aliases: ['quit', 'q'],
    implicitCommand: true,
  },
  {
    id: 'goal',
    label: 'goal',
    description:
      'Run agent until a condition is met (e.g. /goal all tests pass)',
    aliases: ['g'],
  },
  {
    id: 'loop',
    label: 'loop',
    description: 'Run a prompt on a cadence (e.g. /loop 1h "check staging")',
    aliases: ['repeat'],
  },
  {
    id: 'contribute',
    label: 'contribute',
    description:
      'Add yourself to CONTRIBUTORS.md and open a PR (e.g. /contribute <username>)',
  },
  {
    id: 'verify',
    label: 'verify',
    description:
      'Run typechecks across all workspaces (or one: sdk, common, agent-runtime, cli)',
    aliases: ['typecheck', 'check'],
  },
  {
    id: 'permissions',
    label: 'permissions',
    description:
      'Show or set the sandbox permission mode: /permissions [safe|prompt|unsafe]',
    aliases: ['sandbox', 'safety'],
  },
  {
    id: 'rewind',
    label: 'rewind',
    description:
      'Restore files and/or conversation to before a previous turn (/rewind, /rewind 2, /rewind 2 fork)',
    aliases: ['undo', 'checkpoint'],
  },
]
