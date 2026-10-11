import React from 'react'

import { agentIcon } from './agent-icons'
import { savantRasterDataUri } from '../../../hooks/use-savant-raster'
import { glyph } from '../../../utils/glyphs'
import {
  renderInlineImage,
  supportsInlineImages,
} from '../../../utils/terminal-images'
import { useSidebarTheme as useTheme } from '../../right-sidebar-theme'

import type { SavantIconName } from '../../../constants/savant-icons'

export interface AgentStackAgent {
  name: string
  active?: boolean
}

export interface AgentStackProps {
  agents: AgentStackAgent[]
}

/**
 * Normalize a raw agent ID to a display-friendly name.
 *
 *   - 'savant' and 'main-agent' both render as 'Savant'.
 *   - Other kebab-case IDs render in Title Case.
 *   - Already-formatted names are returned unchanged.
 */
function formatAgentName(name: string): string {
  if (name === 'savant' || name === 'main-agent') return 'Savant'
  return name
    .split('-')
    .map((word) =>
      word.length === 0 ? word : word[0].toUpperCase() + word.slice(1),
    )
    .join(' ')
}

/**
 * Family icon for an agent id, as an inline-image sequence when the terminal
 * supports one AND the id maps to the roster (Law 14: any miss — unsupported
 * terminal, unmapped id, missing constant — degrades to `null` and the row
 * renders the existing status glyph exactly as before).
 */
function rosterIconSequence(rawName: string): {
  sequence: string | null
  icon: SavantIconName | null
} {
  const icon = agentIcon(rawName)
  if (!icon) return { sequence: null, icon: null }
  if (!supportsInlineImages()) return { sequence: null, icon }
  const base64 = savantRasterDataUri(icon)
  if (!base64) return { sequence: null, icon }
  const sequence = renderInlineImage(
    base64.replace(/^data:image\/png;base64,/, ''),
    {
      width: 2, // single-line row footprint — same cells the glyph occupies
      height: 1,
    },
  )
  return { sequence, icon }
}

/**
 * Renders a stack of agents as a clean bullet list.
 *
 * Roster agents (Detective, Forge, Orchestrator, …) surface the icon family's
 * echo-agent marks inline on image-capable terminals; every other row and
 * every degraded terminal keeps the theme-aware status glyph (FID-2026-1009-004
 * glyph-fallback design). Active agents are highlighted with the primary
 * theme color; inactive agents use the foreground color.
 */
export function AgentStack({ agents }: AgentStackProps) {
  const theme = useTheme()

  return (
    <box flexDirection="column" focusable={false} selectable={false}>
      {agents.map((agent, i) => {
        const isActive = agent.active ?? false
        const { sequence } = rosterIconSequence(agent.name)
        return (
          <box
            key={i}
            flexDirection="row"
            gap={1}
            alignItems="center"
            focusable={false}
            selectable={false}
          >
            {sequence ? (
              <text selectable={false}>{sequence}</text>
            ) : (
              <text
                fg={isActive ? theme.primary : theme.muted}
                selectable={false}
              >
                {glyph(isActive ? 'statusActive' : 'statusInactive')}
              </text>
            )}
            <text
              fg={isActive ? theme.foreground : theme.muted}
              wrapMode="word"
              flexShrink={1}
              selectable={false}
            >
              {formatAgentName(agent.name)}
            </text>
          </box>
        )
      })}
    </box>
  )
}
