import { TextAttributes } from '@opentui/core'
import React from 'react'

import {
  HOLO_PANEL_BORDER,
  HOLO_PANEL_FILL,
  HOLO_SUBTITLE,
  HOLO_TITLE,
} from './hud-preview-holo'
import { HudMark } from './hud-preview-marks'
import { HUD_MARKS, PreviewSection } from './hud-preview-section'
import { TrafficLightPanel } from '../src/components/traffic-light-panel'
import { useTheme } from '../src/hooks/use-theme'

import type { HudArt, HudDesign } from './hud-preview-section'

export { HudMark } from './hud-preview-marks'
export type { HudArt, HudDesign } from './hud-preview-section'

export function HudSidebar({
  design,
  art,
  folded = false,
  onFold,
  foldState,
}: {
  design: HudDesign
  art: HudArt
  folded?: boolean
  onFold?: () => void
  foldState?: Map<string, boolean>
}) {
  const theme = useTheme()
  const holographic = design === 'holographic'
  const holo = design === 'holo'
  const [folds, setFolds] = React.useState<Record<string, boolean>>({
    'Active agents': true,
  })
  return (
    <box
      id="preview-sidebar"
      width={folded ? 14 : 40}
      height="100%"
      flexShrink={0}
      flexDirection="column"
      backgroundColor={theme.surface}
      border={['left']}
      borderColor={theme.primary}
      paddingLeft={1}
      paddingRight={1}
    >
      <box
        flexDirection={holo ? 'column' : 'row'}
        alignItems="center"
        flexShrink={0}
        gap={holo ? 1 : 0}
      >
        <HudMark
          name="ICON_LogoS"
          art={art}
          large={(holographic || holo) && !folded}
        />
        {!folded && (
          <box
            flexDirection="column"
            flexGrow={holo ? 0 : 1}
            alignItems={holo ? 'center' : undefined}
          >
            <text fg={theme.primary} attributes={TextAttributes.BOLD}>
              SAVANT
            </text>
            <text fg={holo ? HOLO_TITLE : theme.muted}>
              {holographic
                ? 'HOLOGRAPHIC OPS'
                : holo
                  ? HOLO_SUBTITLE
                  : 'CIRCUIT COMMAND'}
            </text>
          </box>
        )}
        <box
          id="preview-fold"
          focusable
          onMouseDown={onFold}
          onKeyDown={(key) => {
            if (['return', 'enter', 'space'].includes(key.name)) onFold?.()
          }}
        >
          <text fg={theme.primary}>{folded ? '[<]' : '[>]'}</text>
        </box>
      </box>
      <scrollbox
        id="preview-details"
        flexGrow={1}
        scrollX={false}
        scrollbarOptions={{ visible: false }}
        contentOptions={{
          flexDirection: 'column',
          gap: holographic || holo ? 1 : 0,
        }}
      >
        {folded ? (
          HUD_MARKS.map((mark) => (
            <box
              key={mark.title}
              alignItems="center"
              flexDirection="column"
              flexShrink={0}
            >
              <HudMark name={mark.icon} art={art} />
              <text fg={theme.foreground}>
                {mark.title === 'Active agents' ? 'Agents' : mark.title}
              </text>
              <text fg={theme.muted}>{mark.count}</text>
            </box>
          ))
        ) : (
          <>
            <box
              flexDirection="column"
              border={holographic || holo ? true : ['left']}
              borderStyle={holographic || holo ? 'rounded' : 'single'}
              borderColor={holo ? HOLO_PANEL_BORDER : theme.secondary}
              backgroundColor={holo ? HOLO_PANEL_FILL : undefined}
              paddingLeft={1}
              paddingRight={1}
              flexShrink={0}
            >
              <box flexDirection="row" alignItems="center" gap={1}>
                <HudMark name="ICON_ActivityTool" art={art} />
                <box flexDirection="column">
                  <text
                    fg={holo ? HOLO_TITLE : theme.foreground}
                    attributes={TextAttributes.BOLD}
                  >
                    Activity detail
                  </text>
                  <text fg={theme.primary}>Reading files</text>
                </box>
              </box>
              <text fg={theme.muted}>cli/src/components/…</text>
              <text fg={theme.warning}>ECHO · AUDIT</text>
              <text fg={theme.foreground}>{'Model   synthetic/model'}</text>
              <text fg={theme.muted}>{'Mode    HYBRID · $0.25'}</text>
            </box>
            {HUD_MARKS.map((mark) => (
              <PreviewSection
                key={mark.title}
                {...mark}
                design={design}
                art={art}
                expanded={
                  foldState?.get(mark.title) ?? folds[mark.title] ?? false
                }
                toggle={() => {
                  const current =
                    foldState?.get(mark.title) ?? folds[mark.title] ?? false
                  foldState?.set(mark.title, !current)
                  setFolds((previous) => ({
                    ...previous,
                    [mark.title]: !current,
                  }))
                }}
              />
            ))}
          </>
        )}
      </scrollbox>
      <box
        id="preview-footer"
        flexDirection="column"
        alignItems="center"
        border={['top']}
        borderColor={holo ? HOLO_PANEL_BORDER : theme.border}
        flexShrink={0}
      >
        <text fg={theme.muted}>v0.0.35</text>
        {!folded && <text fg={theme.foreground}>Context · 70/100 · 70%</text>}
        <text fg={holo ? HOLO_TITLE : theme.warning}>
          {folded ? '[|||||..]' : '[||||||||||||||......]'}
        </text>
        <text fg={theme.muted}>
          {folded ? '70% demo' : 'Window source · catalog'}
        </text>
      </box>
    </box>
  )
}

export function HudScene(props: Parameters<typeof HudSidebar>[0]) {
  const theme = useTheme()
  return (
    <box height="100%" flexDirection="row" backgroundColor={theme.background}>
      <box flexGrow={1} flexDirection="column" padding={2} gap={1}>
        <text fg={theme.primary} attributes={TextAttributes.BOLD}>
          SYNTHETIC DESIGN PREVIEW
        </text>
        <text fg={theme.muted}>
          Not a live agent run. Production sidebar unchanged.
        </text>
        <TrafficLightPanel>
          <box flexDirection="row" alignItems="center" gap={1}>
            <HudMark name="ICON_ToolBash" art={props.art} />
            <text fg={theme.foreground} attributes={TextAttributes.BOLD}>
              TERMINAL
            </text>
          </box>
          <text fg={theme.foreground}>$ bun test src/example.test.ts</text>
          <box flexDirection="row" gap={1} alignItems="center">
            <HudMark name="ICON_ObjFolder" art={props.art} />
            <text fg={theme.muted}>/synthetic/project</text>
          </box>
          <text fg={theme.success}>✓ success · example output only</text>
          <text fg={theme.muted}>3 pass / 0 fail (synthetic fixture)</text>
        </TrafficLightPanel>
        <text fg={theme.muted}>Arrows/folds are prototype visuals.</text>
        <text fg={theme.muted}>
          Mouse wheel scrolls details; click [+]/[-] toggles.
        </text>
      </box>
      <HudSidebar {...props} />
    </box>
  )
}
