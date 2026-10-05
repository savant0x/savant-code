/**
 * Sidebar keyboard focus cycle (FID-2026-1005-002).
 *
 * OpenTUI 0.5.3 has no Tab traversal, so `focusable` controls are only
 * reachable by keyboard if something moves focus for them. The right sidebar
 * provides that parent control: its interactive controls (section headers,
 * FID-card title rows) register a `{ focus, blur }` handle here, and a global
 * Ctrl+G (input unfocused or empty — same guard as the Ctrl+B fold) cycles
 * focus through them. Each control also activates on Enter/Space via its own
 * `onKeyDown`, the OpenTUI focus/button pattern. Mouse behavior is unchanged.
 *
 * The cycle logic is pure and unit-tested (sidebar-collapse.test.tsx); live
 * focus traversal is a NEEDS-REVIEW boundary pending native captures.
 */
import { createContext } from 'react'

import type { KeyEvent } from '@opentui/core'

/** A focusable sidebar control's imperative handle. */
export interface SidebarFocusHandle {
  focus: () => void
  blur: () => void
}

export interface SidebarFocusController {
  /** Register a control; returns its unregister function. */
  register: (handle: SidebarFocusHandle) => () => void
  /** Advance the cycle: blur the current control, focus the next (or first);
   *  advancing past the last rests in the unfocused state. */
  focusNext: () => void
}

/** Context through which sidebar controls reach the controller. Sections
 *  render fine without a provider (no-op registration). */
export const SidebarFocusContext = createContext<SidebarFocusController | null>(
  null,
)

/**
 * Next index in a wrap-around cycle over `count` controls. `current === -1`
 * (nothing focused) starts at 0; advancing past the last returns -1 so the
 * cycle rests unfocused instead of looping forever.
 */
export function nextFocusIndex(current: number, count: number): number {
  if (count <= 0) return -1
  if (current < 0) return 0
  const next = current + 1
  return next >= count ? -1 : next
}

/** Activation keys for a sidebar control (Enter or Space), matching the
 *  app-wide key naming (`model-picker.tsx`, `provider-picker.tsx`). */
export function isSidebarActivateKey(key: Pick<KeyEvent, 'name'>): boolean {
  return key.name === 'return' || key.name === 'enter' || key.name === 'space'
}

/** The sidebar focus-cycle shortcut: plain Ctrl+G (no meta/option). */
export function isSidebarFocusCycleKey(
  key: Pick<KeyEvent, 'ctrl' | 'meta' | 'option' | 'name'>,
): boolean {
  return key.ctrl && !key.meta && !key.option && key.name === 'g'
}

/** Create the controller the right sidebar provides via context. Handles
 *  unregistering while focused so the cycle never points at an unmounted
 *  control. */
export function createSidebarFocusController(): SidebarFocusController {
  const handles: SidebarFocusHandle[] = []
  let current = -1
  return {
    register(handle) {
      handles.push(handle)
      return () => {
        const index = handles.indexOf(handle)
        if (index === -1) return
        handles.splice(index, 1)
        if (index < current) {
          current -= 1
        } else if (index === current) {
          current = -1
        }
      }
    },
    focusNext() {
      if (handles.length === 0) return
      if (current >= 0) handles[current]?.blur()
      current = nextFocusIndex(current, handles.length)
      if (current >= 0) handles[current]?.focus()
    },
  }
}
