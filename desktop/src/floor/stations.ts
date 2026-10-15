/**
 * FID-2026-0822-012 P3+P5 — deck station registry: the six pedestals, the
 * pure toolName => tool-class routing that sends walkers to them, and the
 * SHARED accent maps consumed by BOTH projections (WebGL stage and analytical
 * SVG) so they can never disagree about styling (audit finding).
 *
 * Stations are AMENDMENT-FREE: routing keys on `printModeToolCall.toolName`,
 * which exists on today's union (Loop 1 evidence). Positions form a hexagon
 * around the central console so every pedestal is equidistant from Savant.
 *
 * Routing is two-stage: exact-name sets first (the canonical vocabulary),
 * then conservative keyword heuristics for tool names the registry has never
 * seen. Unclassifiable names land on the Cartography Table (documented v1
 * default — unclassified work is still work worth showing).
 */

import { DECK_TOKENS } from './deck-tokens.generated'

import type { PadPosition } from './adapter/floor-adapter'

export const STATION_IDS = [
  'file-forge',
  'command-spire',
  'signal-array',
  'cartography-table',
  'external-gate',
  'approval-gate',
] as const

export type StationId = (typeof STATION_IDS)[number]

export const STATION_COUNT = STATION_IDS.length
/** Hexagon radius in world units — inside the pad ring (16), outside console. */
export const STATION_RING_RADIUS = 9

/** Display names for the station chips (single truth for nameplates). */
export const STATION_LABELS: Readonly<Record<StationId, string>> = {
  'file-forge': 'File Forge',
  'command-spire': 'Command Spire',
  'signal-array': 'Signal Array',
  'cartography-table': 'Cartography Table',
  'external-gate': 'External Gate',
  'approval-gate': 'Approval Gate',
}

/** Per-station accents from the generated contract-token subset — order
 * mirrors STATION_IDS: forge=warning heat, spire=primary cyan, array=inline
 * cyan, map table=success green, external gate=muted, approval=error red.
 * Single truth for both projections (P5 audit: the SVG fallback previously
 * diverged by painting every pedestal warning-colored). */
export const STATION_ACCENTS: readonly string[] = [
  DECK_TOKENS.warning,
  DECK_TOKENS.primary,
  DECK_TOKENS.inlineCodeFg,
  DECK_TOKENS.success,
  DECK_TOKENS.muted,
  DECK_TOKENS.error,
]

/** Contract-token accent per known G2 FSM phase; unknown/idle render muted.
 * Shared single truth for the WebGL aura and the analytical SVG ring. */
const PHASE_ACCENTS: Readonly<Record<string, string>> = {
  idle: DECK_TOKENS.muted,
  red: DECK_TOKENS.error,
  green: DECK_TOKENS.success,
  audit: DECK_TOKENS.warning,
  adversarial: DECK_TOKENS.error,
  self_correct: DECK_TOKENS.primary,
  complete: DECK_TOKENS.success,
  unknown: DECK_TOKENS.muted,
}

/** Accent for a G2-paired FSM phase; unknown phases render muted. */
export function phaseAccent(phase: string): string {
  return PHASE_ACCENTS[phase] ?? DECK_TOKENS.muted
}

const FILE_FORGE_TOOLS = [
  'write_file',
  'propose_write_file',
  'str_replace',
  'apply_patch',
  'read_files',
  'read_subtree',
  'edit',
] as const

const COMMAND_SPIRE_TOOLS = [
  'run_terminal_command',
  'run_readonly_command',
  'basher',
  'tmux-cli',
  'tmux_cli',
] as const

const SIGNAL_ARRAY_TOOLS = [
  'transition_phase',
  'spawn_agents',
  'set_output',
  'update_goal',
  'get_goal',
  'sequentialthinking',
] as const

const CARTOGRAPHY_TOOLS = [
  'code_search',
  'glob',
  'list_directory',
  'query_blast_radius',
  'query_node_edges',
  'query_domain_clusters',
  'deep_research',
] as const

const EXTERNAL_GATE_TOOLS = [
  'web_search',
  'read_url',
  'github',
  'database',
  'browser-use',
  'browser_use',
  'gravity_index',
] as const

const APPROVAL_GATE_TOOLS = ['ask_user'] as const

const EXACT_ROUTES: Readonly<Record<StationId, readonly string[]>> = {
  'file-forge': FILE_FORGE_TOOLS,
  'command-spire': COMMAND_SPIRE_TOOLS,
  'signal-array': SIGNAL_ARRAY_TOOLS,
  'cartography-table': CARTOGRAPHY_TOOLS,
  'external-gate': EXTERNAL_GATE_TOOLS,
  'approval-gate': APPROVAL_GATE_TOOLS,
}

/**
 * Keyword ladder — ORDER MATTERS: more-specific classes are tested before
 * broader ones so e.g. `glob_files` lands on the Cartography Table (its
 * `glob` token) instead of being swept up by the broad `/file/` pattern.
 */
const KEYWORD_ROUTES: readonly (readonly [
  pattern: RegExp,
  station: StationId,
])[] = [
  [/phase|spawn|goal|thinking|output/, 'signal-array'],
  [/web|url|github|browser|gravity|database/, 'external-gate'],
  [/search|glob|graph|map|cluster|blast|research/, 'cartography-table'],
  [/terminal|command|shell|bash/, 'command-spire'],
  [/file|write|edit|patch/, 'file-forge'],
]

/** Deterministic hexagon geometry: station i sits at angle i·60°. */
export function stationPosition(index: number): PadPosition {
  const slot = ((index % STATION_COUNT) + STATION_COUNT) % STATION_COUNT
  const angle = (slot / STATION_COUNT) * Math.PI * 2
  return {
    x: Math.sin(angle) * STATION_RING_RADIUS,
    z: Math.cos(angle) * STATION_RING_RADIUS,
  }
}

export function stationIndex(id: StationId): number {
  return STATION_IDS.indexOf(id)
}

/**
 * Route a toolName onto its pedestal. Exact registry match wins, then
 * keyword heuristics, then the Cartography Table default. Never throws.
 */
export function routeToolClass(toolName: string | undefined): StationId {
  const normalized = toolName?.trim().toLowerCase() ?? ''
  if (normalized.length === 0) return 'cartography-table'
  for (const id of STATION_IDS) {
    if (EXACT_ROUTES[id].includes(normalized)) return id
  }
  for (const [pattern, station] of KEYWORD_ROUTES) {
    if (pattern.test(normalized)) return station
  }
  return 'cartography-table'
}
