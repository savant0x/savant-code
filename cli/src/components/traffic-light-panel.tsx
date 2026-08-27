import React from 'react'

import { TrafficLights } from './traffic-lights'
import { useTheme } from '../hooks/use-theme'

import type { ReactNode } from 'react'

/**
 * FID-2026-0822-009: total horizontal columns the panel chrome consumes
 * around its content — rounded border (1 left + 1 right) plus the content
 * box's horizontal padding (1 left + 1 right). Content renderers mounted
 * inside the panel MUST subtract this from their available width before
 * wrapping, or wrapText emits rows wider than the true interior and OpenTUI
 * re-wraps the residue onto the border row (live-smoke border bleed).
 */
export const TRAFFIC_PANEL_WIDTH_ALLOWANCE = 4

/**
 * FID-2026-0822-005: shared TrafficLights panel chrome — the bordered surface
 * panel with the right-aligned glowing title bar established by
 * TerminalCommandDisplay and CompactionSignal (FID-2026-0817-001 lineage).
 *
 * Width model follows CompactionSignal (`width: '100%'`) rather than
 * TerminalCommandDisplay's numeric model: tool content renders inside agent
 * grid cells that clamp near 24 columns, and a percentage-width box shrinks
 * with its parent cell instead of overflowing it.
 */
export function TrafficLightPanel({ children }: { children?: ReactNode }) {
  const theme = useTheme()

  return (
    <box
      style={{
        width: '100%',
        flexDirection: 'column',
        backgroundColor: theme.surface,
        border: true,
        borderStyle: 'rounded',
        borderColor: theme.border,
      }}
    >
      {/* Title bar — traffic lights, right-aligned, glowing. */}
      <box
        style={{
          width: '100%',
          paddingLeft: 1,
          paddingRight: 1,
          flexDirection: 'row',
          justifyContent: 'flex-end',
        }}
      >
        <TrafficLights />
      </box>
      <box
        style={{
          width: '100%',
          paddingLeft: 1,
          paddingRight: 1,
          paddingBottom: 0,
        }}
      >
        {children}
      </box>
    </box>
  )
}
