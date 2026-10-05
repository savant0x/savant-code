import { RenderableEvents, TextAttributes } from '@opentui/core'
import React from 'react'

import { useFoldCollapse } from '../../../hooks/use-fold-collapse'
import { useTheme } from '../../../hooks/use-theme'
import {
  isSidebarActivateKey,
  SidebarFocusContext,
} from '../../right-sidebar-focus'

import type { BoxRenderable } from '@opentui/core'

export interface SidebarSectionProps {
  title: string
  defaultExpanded?: boolean
  children: React.ReactNode
}

/**
 * Collapsible sidebar section.
 *
 * Renders a bold primary header with an expand/collapse chevron and a
 * padded body. The header toggles on mouse click (unchanged) and on
 * Enter/Space when focused (FID-2026-1005-002): the header is focusable and
 * registers with the sidebar's Ctrl+G focus cycle, so section controls are
 * keyboard reachable. A focused header inverts its title as the focus
 * indicator (compact, no focus rectangle). Folding tweens the body height
 * to 0 (via `useFoldCollapse`) before unmounting.
 */
export function SidebarSection({
  title,
  defaultExpanded = false,
  children,
}: SidebarSectionProps) {
  const theme = useTheme()
  const { mounted, height, bodyRef, toggle, expanded } =
    useFoldCollapse(defaultExpanded)
  const focusController = React.useContext(SidebarFocusContext)
  const headerRef = React.useRef<BoxRenderable | null>(null)
  const [headerFocused, setHeaderFocused] = React.useState(false)

  // Join the sidebar focus cycle so Ctrl+G can reach this header (FID-
  // 2026-1005-002). No provider mounted (e.g. isolated renders/tests) is a
  // no-op — sections stay usable without the controller.
  React.useEffect(() => {
    if (!focusController) return undefined
    return focusController.register({
      focus: () => headerRef.current?.focus(),
      blur: () => headerRef.current?.blur(),
    })
  }, [focusController])

  // Track focus for the title indicator.
  React.useEffect(() => {
    const header = headerRef.current
    if (!header) return undefined
    const onFocus = () => setHeaderFocused(true)
    const onBlur = () => setHeaderFocused(false)
    header.on(RenderableEvents.FOCUSED, onFocus)
    header.on(RenderableEvents.BLURRED, onBlur)
    return () => {
      header.off(RenderableEvents.FOCUSED, onFocus)
      header.off(RenderableEvents.BLURRED, onBlur)
    }
  }, [])

  return (
    <box flexDirection="column" focusable={false} selectable={false}>
      <box
        ref={headerRef}
        flexDirection="row"
        gap={1}
        alignSelf="flex-start"
        onMouseDown={toggle}
        onKeyDown={(key) => {
          if (isSidebarActivateKey(key)) {
            key.preventDefault?.()
            key.stopPropagation?.()
            toggle()
          }
        }}
        focusable={true}
        selectable={false}
      >
        <text fg={theme.muted} selectable={false}>
          {expanded ? '▼' : '▶'}
        </text>
        <text
          attributes={
            headerFocused
              ? TextAttributes.BOLD | TextAttributes.INVERSE
              : TextAttributes.BOLD
          }
          fg={theme.primary}
          selectable={false}
        >
          {title}
        </text>
      </box>
      {mounted && (
        <box
          ref={bodyRef}
          flexDirection="column"
          paddingLeft={2}
          overflow="hidden"
          height={height}
          focusable={false}
          selectable={false}
        >
          {children}
        </box>
      )}
    </box>
  )
}
