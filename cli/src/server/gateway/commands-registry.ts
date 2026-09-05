// FID-2026-0905-004 — gateway decomposition: command-registry surface.
//
// FID-2026-0901-005: the server-side command surface — the FULL CLI slash
// registry (the same one the TUI autocomplete shows). Commands whose handlers
// are TUI-local (pickers, overlays that need a terminal) are marked 'client'
// so the desktop can show them honestly or skip them; everything else
// dispatches as prompt text through the run path, where the runtime's
// command-shaped-prompt interception (e.g. /compact) makes it real.

import { SLASH_COMMANDS } from '../../data/slash-commands'
import { success } from '../json-rpc'

import type { GatewayCommandDescriptor } from './types'

const TUI_ONLY_COMMAND_IDS = new Set([
  // Pure-TUI overlays: they open pickers/menus that cannot exist in a
  // renderer and have no prompt-shaped fallback.
  'review',
  'rewind',
  'history',
  'permissions',
  'diagnostics',
  'teacher',
  'contribute',
  'design',
  'design-authoring',
  'auto-drive',
  'fid',
  'graph',
])

export function defaultListCommands(): GatewayCommandDescriptor[] {
  return SLASH_COMMANDS.map((command) => ({
    id: command.id,
    description: command.description,
    dispatch: TUI_ONLY_COMMAND_IDS.has(command.id) ? 'client' : 'agent',
  }))
}

/** Serve the registry to the desktop palette. */
export function handleListCommands(
  send: (data: string) => void,
  id: number | string,
  commands: GatewayCommandDescriptor[],
): void {
  send(JSON.stringify(success(id, { commands })))
}
