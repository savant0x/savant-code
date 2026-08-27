import { CORE_SLASH_COMMANDS } from './slash-command-core'
import { FEATURE_SLASH_COMMANDS } from './slash-command-feature'
import {
  AGENT_MODES,
  IS_SAVANT_FREE,
  MODE_DESCRIPTIONS,
} from '../utils/constants'

import type { SkillsMap } from '@savant-code/common/types/skill'

export interface SlashCommand {
  id: string
  label: string
  description: string
  aliases?: string[]
  /**
   * If true, this command can be invoked without a leading slash when the
   * input matches the command id exactly (no arguments).
   */
  implicitCommand?: boolean
  /**
   * If set, selecting this command inserts this text into the input field
   * instead of executing a command. Useful for agent shortcuts.
   */
  insertText?: string
}

// Generate mode commands from the AGENT_MODES constant (excluded in SavantFree)
// FID-2026-0805-001: HYBRID keeps the legacy `mode:edit` alias so muscle memory
// and scripts that use the pre-rename command keep working.
// The descriptions are the MODE_DESCRIPTIONS one-line contracts (single source
// of truth shared with the mode-toggle hovertip), so the STRICT ceremony
// contract is visible in the slash menu, not just on hover.
const MODE_COMMANDS: SlashCommand[] = IS_SAVANT_FREE
  ? []
  : [
      {
        id: 'mode',
        label: 'mode',
        description:
          'List execution modes with their contracts, or switch: /mode <name>',
      },
      ...AGENT_MODES.map((mode) => ({
        id: `mode:${mode.toLowerCase()}`,
        label: `mode:${mode.toLowerCase()}`,
        description: MODE_DESCRIPTIONS[mode],
        aliases: [
          `model:${mode.toLowerCase()}`,
          // Legacy pre-rename spellings still resolve to HYBRID.
          ...(mode === 'HYBRID' ? ['mode:edit', 'model:edit'] : []),
        ],
      })),
    ]

// FID-007 D1: `init` was listed here (menu-only removal) while the command
// registry still registered it in free builds — free users could run an
// undiscoverable command. Aligned to the registry: `/init` is available in
// free builds, so it stays in the menu.
// FID-007 V4: exported for the gating-parity test.
export const SAVANT_FREE_REMOVED_COMMAND_IDS = new Set([
  'ads:enable',
  'ads:disable',
  'usage',
  'subscribe',
  'image',
  'publish',
  'release',
])

export const SAVANT_FREE_ONLY_COMMAND_IDS = new Set([
  'connect',
  'plan',
  'end-session',
])

// FID-2026-0821-001 P1-4: first-class manual compaction. Selecting the
// entry dispatches the literal `/compact` prompt; the savant handleSteps
// generator intercepts it — force context-pruner spawn, compact-and-stop.
const COMPACT_COMMANDS: SlashCommand[] = [
  {
    id: 'compact',
    label: 'compact',
    description: 'Summarize older turns now to free context window, then pause',
  },
]

// The mode commands are spliced between the core and feature groups, matching
// their original position in the flat menu array. The compact command rides
// between modes and features (FID-2026-0821-001 P1-4).
const ALL_SLASH_COMMANDS: SlashCommand[] = [
  ...CORE_SLASH_COMMANDS,
  ...MODE_COMMANDS,
  ...COMPACT_COMMANDS,
  ...FEATURE_SLASH_COMMANDS,
]

export const SLASH_COMMANDS = IS_SAVANT_FREE
  ? ALL_SLASH_COMMANDS.filter(
      (cmd) => !SAVANT_FREE_REMOVED_COMMAND_IDS.has(cmd.id),
    )
  : ALL_SLASH_COMMANDS.filter(
      (cmd) => !SAVANT_FREE_ONLY_COMMAND_IDS.has(cmd.id),
    )

export const SLASHLESS_COMMAND_IDS = new Set(
  SLASH_COMMANDS.filter((cmd) => cmd.implicitCommand).map((cmd) =>
    cmd.id.toLowerCase(),
  ),
)

/** Maximum description length for skill commands in the slash menu */
const SKILL_MENU_DESCRIPTION_MAX_LENGTH = 50

function truncateDescription(description: string): string {
  if (description.length <= SKILL_MENU_DESCRIPTION_MAX_LENGTH) {
    return description
  }
  return description.slice(0, SKILL_MENU_DESCRIPTION_MAX_LENGTH - 1) + '…'
}

/**
 * Returns SLASH_COMMANDS merged with skill commands.
 * Skills become slash commands that users can invoke directly.
 */
export function getSlashCommandsWithSkills(skills: SkillsMap): SlashCommand[] {
  const skillCommands: SlashCommand[] = Object.values(skills).map((skill) => ({
    id: `skill:${skill.name}`,
    label: `skill:${skill.name}`,
    description: truncateDescription(skill.description),
  }))

  const commands = [...SLASH_COMMANDS, ...skillCommands]

  return commands
}
