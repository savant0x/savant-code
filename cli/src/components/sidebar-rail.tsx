import { TextAttributes } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import { useCallback, useState } from 'react'

import { RightSidebar } from './right-sidebar'
import { useTheme } from '../hooks/use-theme'
import { getVersion } from '../utils/version'
import { Branding } from './savant-ui/branding'

import type { RightSidebarProps } from './right-sidebar'
import type { KeyEvent } from '@opentui/core'

/** Width of the collapsed icon rail (FID-2026-0816-007 step 1). */
const RAIL_WIDTH = 14

/**
 * Section names surfaced on the collapsed rail. These mirror the full
 * sidebar's sections so the governance data (FIDs, FSM, trust matrix) stays
 * one hover away; the actual live content is rendered by `RightSidebar` when
 * the rail expands.
 */
const RAIL_SECTIONS = [
  'Status',
  'Session',
  'Loop',
  'Tools',
  'Files',
  'FIDs',
  'History',
]

/**
 * SidebarRail — the collapsed form of the right sidebar.
 *
 * At narrow widths the 40-column sidebar would starve the chat column, so the
 * sidebar collapses to a compact rail (FID-2026-0816-007 step 1). It is also
 * the manual-fold target at any width (FID-2026-0816-010 follow-up).
 *
 * Two distinct folded states (operator feedback 2026-08-16):
 * - **Width-based auto-collapse** (no `onUnfold`, <60 cols): hovering the rail
 *   expands it in place to the full `RightSidebar`; Escape (or Ctrl+C)
 *   restores the rail. This is the responsive peek affordance.
 * - **Manual fold** (`onUnfold` provided, any width): the fold is STICKY —
 *   moving the mouse over the rail never auto-expands it. The only restore
 *   affordances are Ctrl+B and the raised `«` button that sits on the rail's
 *   left edge (overlapping the fold line), plus Escape/Ctrl+C after the rail
 *   was peek-expanded.
 *
 * **Click-to-expand** (operator feedback 2026-08-16): clicking any rail item
 * expands the rail in place to the full `RightSidebar` — the condensed rail
 * can't fit section content, so the click opens the full surface instead of
 * doing nothing. Works in both folded states; Escape/Ctrl+C (or the `«` in
 * the expanded chrome) folds back.
 *
 * Items in the rail are center-aligned, and hovering an item highlights it in
 * the brand cyan.
 */
export const SidebarRail = ({
  onUnfold,
  ...props
}: RightSidebarProps & { onUnfold?: () => void }) => {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(false)
  const [hoveredSection, setHoveredSection] = useState<number | null>(null)
  const [unfoldHovered, setUnfoldHovered] = useState(false)
  const [collapseHovered, setCollapseHovered] = useState(false)

  const collapse = useCallback(() => setExpanded(false), [])

  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        if (
          expanded &&
          (key.name === 'escape' || (key.ctrl && key.name === 'c'))
        ) {
          key.preventDefault?.()
          key.stopPropagation?.()
          collapse()
        }
      },
      [expanded, collapse],
    ),
  )

  if (expanded) {
    return (
      <box
        style={{
          flexDirection: 'column',
          width: 40,
          height: '100%',
          flexShrink: 0,
          backgroundColor: theme.background,
          // Positioning context for the collapse button (matches
          // RightSidebar's fold-handle trick, operator feedback round 3).
          position: 'relative',
        }}
        focusable={false}
        selectable={false}
      >
        {/* Raised `«` collapse button — the SAME design as the rail's
            manual-fold unfold button (operator feedback round 4: the old
            flat top-right arrow and the white focus stroke are gone). Folds
            back to the rail; Escape/Ctrl+C also work. left -3 centers the
            glyph on the fold line (round-6). */}
        <box
          style={{ position: 'absolute', left: -3, top: 0, zIndex: 10 }}
          borderStyle="rounded"
          borderColor={collapseHovered ? theme.primary : theme.border}
          backgroundColor={theme.surface}
          paddingLeft={1}
          paddingRight={1}
          onMouseOver={() => setCollapseHovered(true)}
          onMouseOut={() => setCollapseHovered(false)}
          onMouseDown={collapse}
          focusable={false}
          selectable={false}
        >
          <text
            fg={collapseHovered ? theme.primary : theme.muted}
            attributes={TextAttributes.BOLD}
            selectable={false}
          >
            {'«'}
          </text>
        </box>
        <RightSidebar {...props} />
      </box>
    )
  }

  // Manual fold (onUnfold present) is sticky: hover must never auto-expand it.
  const isManualFold = onUnfold !== undefined

  return (
    <box
      onMouseMove={isManualFold ? undefined : () => setExpanded(true)}
      style={{
        flexDirection: 'column',
        width: RAIL_WIDTH,
        height: '100%',
        flexShrink: 0,
        paddingTop: 1,
        paddingBottom: 1,
        gap: 1,
        backgroundColor: theme.background,
      }}
      // focusable={false}: clicking a rail item must not focus the root and
      // paint the default white focusedBorderColor rectangle around the rail
      // (operator feedback round 4: "weird big rectangle with a white
      // stroke"). Keyboard collapse (Escape/Ctrl+C) is handled globally via
      // useKeyboard and does not need a focusable root.
      focusable={false}
      selectable={false}
    >
      {/* Manual-fold unfold button (operator feedback 2026-08-16): a raised,
          bordered `«` button sitting on the rail's LEFT edge and overlapping
          the fold line into the chat column — a button, not a flat arrow. Only
          shown when ChatSidebar passes onUnfold (manual fold at a wide
          terminal); at narrow widths hover-expand is the only affordance.
          marginLeft -3 centers the glyph ON the fold line (rail edge at 106,
          glyph at 106 — round-6 operator feedback: "center the icon on the
          edge"). */}
      {onUnfold && (
        <box
          alignSelf="flex-start"
          marginLeft={-3}
          borderStyle="rounded"
          borderColor={unfoldHovered ? theme.primary : theme.border}
          backgroundColor={theme.surface}
          paddingLeft={1}
          paddingRight={1}
          onMouseOver={() => setUnfoldHovered(true)}
          onMouseOut={() => setUnfoldHovered(false)}
          onMouseDown={onUnfold}
          focusable={false}
          selectable={false}
        >
          <text
            fg={unfoldHovered ? theme.primary : theme.muted}
            attributes={TextAttributes.BOLD}
            selectable={false}
          >
            {'«'}
          </text>
        </box>
      )}
      {/* Centered brand mark (operator feedback 2026-08-16). The 3-col S
          glyph in the 14-col rail centers with a ceil bias (left margin 6 vs
          right 5), reading as shifted right next to the floor-centered
          labels. A 1-col marginRight on the glyph wrapper makes the flex
          centering use the 4-col margin box → left margin 5, glyph at
          cols 112-114, mathematically centered (round-5 nudge). */}
      <box width="100%" alignItems="center" selectable={false}>
        <box marginRight={1} selectable={false}>
          <Branding font="tiny" text="S" color="primary" />
        </box>
      </box>
      {/* Center-aligned rail items with cyan hover highlight (operator
          feedback 2026-08-16). Clicking an item expands the rail in place to
          the full sidebar (operator feedback 2026-08-16 round 2: a condensed
          rail can't fit section content, so the click opens the full surface
          rather than doing nothing). */}
      {RAIL_SECTIONS.map((section, i) => (
        <box
          key={section}
          width="100%"
          alignItems="center"
          onMouseOver={() => setHoveredSection(i)}
          onMouseOut={() => setHoveredSection(null)}
          onMouseDown={() => setExpanded(true)}
          focusable={false}
          selectable={false}
        >
          <text
            fg={hoveredSection === i ? theme.primary : theme.muted}
            attributes={hoveredSection === i ? TextAttributes.BOLD : undefined}
            wrapMode="none"
            selectable={false}
          >
            {section}
          </text>
        </box>
      ))}
      <box marginTop="auto" width="100%" alignItems="center" selectable={false}>
        <text fg={theme.muted} wrapMode="none" selectable={false}>
          {`v${getVersion()}`}
        </text>
      </box>
      {!isManualFold && (
        <text
          fg={theme.muted}
          attributes={TextAttributes.DIM}
          wrapMode="none"
          selectable={false}
        >
          hover »
        </text>
      )}
    </box>
  )
}
