// FID-2026-1010-004: the preview sidebar's section component and its static
// mark table, extracted verbatim from hud-preview-components.tsx after that
// file crossed the 300-line quality ceiling. Behavior is unchanged: the same
// props, the same three design branches, the same fold affordance. The public
// types stay re-exported from hud-preview-components.tsx so existing importers
// (hud-preview.tsx, hud-preview-marks.tsx) are untouched.
import { TextAttributes } from '@opentui/core'
import React from 'react'

import {
  HOLO_PANEL_BORDER,
  HOLO_PANEL_FILL,
  HOLO_TITLE,
} from './hud-preview-holo'
import { HudMark } from './hud-preview-marks'
import { useTheme } from '../src/hooks/use-theme'

import type { SavantIconName } from '../src/constants/savant-icons'

export type HudDesign = 'circuit' | 'holographic' | 'holo'
export type HudArt = 'blocks' | 'text'

export type HudMarkSpec = {
  title: string
  icon: SavantIconName
  count: string
}

export const HUD_MARKS: HudMarkSpec[] = [
  { title: 'Active agents', icon: 'ICON_CmdAgents', count: '2' },
  { title: 'Session', icon: 'ICON_SidebarSession', count: '' },
  { title: 'Loop', icon: 'ICON_SidebarLoop', count: '' },
  { title: 'Trust Matrix', icon: 'ICON_SidebarTrustMatrix', count: '1' },
  { title: 'Tools', icon: 'ICON_ActivityTool', count: '8' },
  { title: 'Files', icon: 'ICON_ObjFile', count: '+1 / ~2' },
  { title: 'Active FIDs', icon: 'ICON_SidebarFid', count: '4' },
  { title: 'History', icon: 'ICON_SidebarHistory', count: '12' },
]

export function PreviewSection({
  title,
  icon,
  count,
  design,
  art,
  expanded,
  toggle,
}: HudMarkSpec & {
  design: HudDesign
  art: HudArt
  expanded: boolean
  toggle: () => void
}) {
  const theme = useTheme()
  const holo = design === 'holo'
  return (
    <box flexDirection="column" flexShrink={0}>
      <box
        id={`preview-section-${title}`}
        flexDirection="row"
        alignItems="center"
        gap={1}
        focusable
        onMouseDown={toggle}
        onKeyDown={(key) => {
          if (['return', 'enter', 'space'].includes(key.name)) toggle()
        }}
        {...(design === 'holographic'
          ? { border: ['bottom'] as const, borderColor: theme.border }
          : holo
            ? {
                border: true as const,
                borderStyle: 'rounded' as const,
                borderColor: HOLO_PANEL_BORDER,
                paddingLeft: 1,
                paddingRight: 1,
                marginTop: 1,
              }
            : { border: false })}
        backgroundColor={
          design === 'holographic'
            ? theme.surfaceHover
            : holo
              ? HOLO_PANEL_FILL
              : undefined
        }
      >
        <text fg={holo ? HOLO_TITLE : theme.primary}>
          {expanded ? '[-]' : '[+]'}
        </text>
        <HudMark name={icon} art={art} />
        <text
          fg={holo ? HOLO_TITLE : theme.foreground}
          attributes={TextAttributes.BOLD}
          flexShrink={1}
        >
          {title}
        </text>
        <text marginLeft="auto" fg={theme.muted}>
          {count}
        </text>
      </box>
      {expanded && (
        <box
          paddingLeft={holo ? 1 : 4}
          flexDirection="column"
          {...(holo
            ? {
                border: true as const,
                borderStyle: 'rounded' as const,
                borderColor: HOLO_PANEL_BORDER,
                backgroundColor: HOLO_PANEL_FILL,
                marginTop: 1,
              }
            : {})}
        >
          {title === 'Active agents' ? (
            <>
              <box flexDirection="row" alignItems="center" gap={1}>
                <HudMark name="ICON_Forge" art={art} />
                <text fg={theme.foreground}>Forge</text>
                <text marginLeft="auto" fg={theme.success}>
                  active
                </text>
              </box>
              <box flexDirection="row" alignItems="center" gap={1}>
                <HudMark name="ICON_VerifierBold" art={art} />
                <text fg={theme.foreground}>Verifier</text>
                <text marginLeft="auto" fg={theme.muted}>
                  waiting
                </text>
              </box>
            </>
          ) : (
            <text fg={theme.muted}>Synthetic {title.toLowerCase()} detail</text>
          )}
        </box>
      )}
    </box>
  )
}
