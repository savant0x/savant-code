import { CHATGPT_OAUTH_ENABLED } from '@savant-code/common/constants/chatgpt-oauth'

import { IS_SAVANT_FREE } from '../utils/constants'

import type { SlashCommand } from './slash-commands'

/**
 * Core slash-command menu entries (help through release). The mode commands
 * (`...MODE_COMMANDS`) are spliced in by the parent at their original
 * position, and the feature commands live in `slash-command-feature.ts`.
 */
export const CORE_SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'help',
    label: 'help',
    description: 'Display keyboard shortcuts and tips',
    aliases: ['h', '?'],
    implicitCommand: true,
  },
  {
    id: 'diagnostics',
    label: 'diagnostics',
    description: 'Show local CLI resource usage and terminal tool process IDs',
    aliases: ['diag', 'processes'],
  },
  {
    id: 'health',
    label: 'health',
    description: 'Show CLI and backend health status',
    aliases: ['status', 'check'],
  },
  ...(CHATGPT_OAUTH_ENABLED
    ? [
        {
          id: 'connect',
          label: 'connect',
          description: 'Connect your ChatGPT account',
          aliases: ['connect:chatgpt', 'chatgpt'],
        },
      ]
    : []),

  {
    id: 'ads:enable',
    label: 'ads:enable',
    description: 'Enable contextual ads',
  },
  {
    id: 'ads:disable',
    label: 'ads:disable',
    description: 'Disable contextual ads',
  },
  {
    id: 'telemetry',
    label: 'telemetry',
    description: 'Show or change remote analytics consent',
    aliases: ['analytics'],
  },
  {
    id: 'presence',
    label: 'presence',
    description:
      'Show or change Discord Rich Presence: /presence [status|enable|disable]',
    aliases: ['discord'],
  },
  {
    id: 'init',
    label: 'init',
    description: 'Create a starter knowledge.md file',
    implicitCommand: true,
  },

  {
    id: 'usage',
    label: 'usage',
    description: 'View credits and subscription quota',
    aliases: ['credits'],
  },
  {
    id: 'subscribe',
    label: 'subscribe',
    description: 'Subscribe to get more usage',
    aliases: ['strong', 'sub', 'buy-credits'],
  },
  {
    id: 'auto-drive',
    label: 'auto-drive',
    description:
      'Auto Drive: clarify, plan, and approve a goal, then run it to completion autonomously',
    aliases: ['auto', 'drive', 'autodrive'],
  },
  {
    id: 'interview',
    label: 'interview',
    description:
      'AI asks a series of questions to flesh out request into a spec',
  },
  {
    id: 'plan',
    label: 'plan',
    description: 'Create a plan for how to implement a request',
  },
  {
    id: 'review',
    label: 'review',
    description: 'Review code changes',
  },
  {
    id: 'new',
    label: 'new',
    description: 'Clear the conversation history and start a new chat',
    aliases: ['n', 'clear', 'c', 'reset'],
    implicitCommand: true,
  },
  {
    id: 'design',
    label: 'design',
    description:
      'List, select, create, edit, or reset the active design system',
    aliases: ['ds'],
  },
  {
    id: 'history',
    label: 'history',
    description: 'Browse and resume past conversations',
    aliases: ['chats'],
  },
  {
    id: 'copy',
    label: 'copy',
    description:
      'Copy the full conversation (messages + tool results) to the clipboard',
    aliases: ['copy-chat'],
  },
  {
    id: 'export',
    label: 'export',
    description:
      'Write a self-contained branded HTML report of the conversation',
    aliases: ['save'],
  },
  {
    id: 'graph-export',
    label: 'graph-export',
    description:
      'Write a self-contained branded HTML report of the code knowledge graph',
    aliases: ['graph:export', 'gexport'],
  },
  {
    id: 'graph-refresh',
    label: 'graph refresh',
    description: 'Re-index the code knowledge graph and show summary stats',
    aliases: ['graph:refresh', 'graph'],
  },
  {
    id: 'attest',
    label: 'attest',
    description:
      'Export signed ZTAP provenance as authoritative JSON plus an offline trust-receipt HTML view',
    aliases: ['ztap', 'trust-receipt'],
  },
  {
    id: 'learn',
    label: 'learn',
    description:
      'Open the Agent-Steering Teacher: practice directing and reviewing an AI coding agent',
    aliases: ['teacher'],
  },

  {
    id: 'feedback',
    label: 'feedback',
    description: IS_SAVANT_FREE
      ? 'Share general feedback about SavantFree'
      : 'Share general feedback about SavantCode',
  },
  {
    id: 'bash',
    label: 'bash',
    description: 'Enter bash mode ("!" at beginning enters bash mode)',
    aliases: ['!'],
  },
  {
    id: 'image',
    label: 'image',
    description: 'Attach an image file (or Ctrl+V to paste from clipboard)',
    aliases: ['img', 'attach'],
  },
  {
    id: 'publish',
    label: 'publish',
    description: 'Publish an agent to the registry',
  },
  {
    id: 'release',
    label: 'release',
    description:
      'Run the public release flow: /release preview | diagnose | go | resume | status',
  },
]
