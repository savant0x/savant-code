import { TextAttributes } from '@opentui/core'
import React from 'react'

import { HudMark } from './hud-preview-marks'
import { TrafficLightPanel } from '../src/components/traffic-light-panel'
import { useTheme } from '../src/hooks/use-theme'

import type { SavantIconName } from '../src/constants/savant-icons'

export { HudMark } from './hud-preview-marks'

export type HudDesign = 'circuit' | 'holographic'
export type HudArt = 'blocks' | 'text'

const marks: Array<{ title: string; icon: SavantIconName; count: string }> = [
  { title: 'Active agents', icon: 'ICON_CmdAgents', count: '2' },
  { title: 'Session', icon: 'ICON_SidebarSession', count: '' },
  { title: 'Loop', icon: 'ICON_SidebarLoop', count: '' },
  { title: 'Trust Matrix', icon: 'ICON_SidebarTrustMatrix', count: '1' },
  { title: 'Tools', icon: 'ICON_ActivityTool', count: '8' },
  { title: 'Files', icon: 'ICON_ObjFile', count: '+1 / ~2' },
  { title: 'Active FIDs', icon: 'ICON_SidebarFid', count: '4' },
  { title: 'History', icon: 'ICON_SidebarHistory', count: '12' },
]

function PreviewSection({
  title,
  icon,
  count,
  design,
  art,
  expanded,
  toggle,
}: (typeof marks)[number] & {
  design: HudDesign
  art: HudArt
  expanded: boolean
  toggle: () => void
}) {
  const theme = useTheme()
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
          : { border: false })}
        backgroundColor={
          design === 'holographic' ? theme.surfaceHover : undefined
        }
      >
        <text fg={theme.primary}>{expanded ? '[-]' : '[+]'}</text>
        <HudMark name={icon} art={art} />
        <text
          fg={theme.foreground}
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
        <box paddingLeft={4} flexDirection="column">
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
      <box flexDirection="row" alignItems="center" flexShrink={0}>
        <HudMark name="ICON_LogoS" art={art} large={holographic && !folded} />
        {!folded && (
          <box flexDirection="column" flexGrow={1}>
            <text fg={theme.primary} attributes={TextAttributes.BOLD}>
              SAVANT
            </text>
            <text fg={theme.muted}>
              {holographic ? 'HOLOGRAPHIC OPS' : 'CIRCUIT COMMAND'}
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
        contentOptions={{ flexDirection: 'column', gap: holographic ? 1 : 0 }}
      >
        {folded ? (
          marks.map((mark) => (
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
              border={holographic ? true : ['left']}
              borderStyle={holographic ? 'rounded' : 'single'}
              borderColor={theme.secondary}
              paddingLeft={1}
              paddingRight={1}
              flexShrink={0}
            >
              <box flexDirection="row" alignItems="center" gap={1}>
                <HudMark name="ICON_ActivityTool" art={art} />
                <box flexDirection="column">
                  <text fg={theme.foreground} attributes={TextAttributes.BOLD}>
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
            {marks.map((mark) => (
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
        borderColor={theme.border}
        flexShrink={0}
      >
        <text fg={theme.muted}>v0.0.35</text>
        {!folded && <text fg={theme.foreground}>Context · 70/100 · 70%</text>}
        <text fg={theme.warning}>
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
