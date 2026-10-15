import {
  RenderableEvents,
  ScrollBoxRenderable,
  TextAttributes,
} from '@opentui/core'
import React from 'react'

import {
  isSidebarActivateKey,
  SidebarFocusContext,
} from './right-sidebar-focus'
import { useSidebarTheme as useTheme } from './right-sidebar-theme'

import type { BoxRenderable, Renderable } from '@opentui/core'

/** Reveal against the nearest native scroll viewport, including folded bodies. */
export function revealSidebarControl(control: Renderable) {
  let parent = control.parent
  while (parent) {
    if (parent instanceof ScrollBoxRenderable) {
      const viewport = parent.viewport
      if (control.y < viewport.y) parent.scrollBy(control.y - viewport.y)
      else if (control.y + control.height > viewport.y + viewport.height) {
        parent.scrollBy(
          control.y + control.height - viewport.y - viewport.height,
        )
      }
      return
    }
    parent = parent.parent
  }
}

export function useSidebarControl(id: string, activate: () => void) {
  const controller = React.useContext(SidebarFocusContext)
  const ref = React.useRef<BoxRenderable | null>(null)
  const [focused, setFocused] = React.useState(false)
  const [hovered, setHovered] = React.useState(false)
  React.useEffect(() => {
    const control = ref.current
    if (!control) return undefined
    let revealTimer: ReturnType<typeof setTimeout> | undefined
    const reveal = () => {
      revealSidebarControl(control)
      clearTimeout(revealTimer)
      revealTimer = setTimeout(() => {
        if (control.focused) revealSidebarControl(control)
      }, 16)
    }
    const onFocus = () => {
      setFocused(true)
      reveal()
    }
    const onBlur = () => setFocused(false)
    control.on(RenderableEvents.FOCUSED, onFocus)
    control.on(RenderableEvents.BLURRED, onBlur)
    const unregister = controller?.register({
      id,
      renderable: () => ref.current,
      focus: () => {
        reveal()
        control.focus()
      },
      blur: () => control.blur(),
    })
    return () => {
      unregister?.()
      clearTimeout(revealTimer)
      control.off(RenderableEvents.FOCUSED, onFocus)
      control.off(RenderableEvents.BLURRED, onBlur)
    }
  }, [controller, id])
  return {
    ref,
    focused,
    hovered,
    onMouseOver: () => setHovered(true),
    onMouseOut: () => setHovered(false),
    onMouseDown: activate,
    onKeyDown: (
      key: Parameters<typeof isSidebarActivateKey>[0] & {
        preventDefault?: () => void
        stopPropagation?: () => void
      },
    ) => {
      if (!isSidebarActivateKey(key)) return
      key.preventDefault?.()
      key.stopPropagation?.()
      activate()
    },
  }
}

export function SidebarFoldButton({
  id,
  label,
  onActivate,
}: {
  id: string
  label: string
  onActivate: () => void
}) {
  const theme = useTheme()
  const { focused, hovered, ...events } = useSidebarControl(id, onActivate)
  return (
    <box
      {...events}
      id={`${id}-button`}
      focusable
      borderStyle="rounded"
      borderColor={hovered || focused ? theme.primary : theme.border}
      focusedBorderColor={theme.primary}
      paddingLeft={1}
      paddingRight={1}
      alignItems="center"
      backgroundColor={theme.surface}
    >
      <text
        fg={focused || hovered ? theme.primary : theme.muted}
        attributes={
          focused
            ? TextAttributes.BOLD | TextAttributes.UNDERLINE
            : TextAttributes.BOLD
        }
      >
        {label}
      </text>
    </box>
  )
}
