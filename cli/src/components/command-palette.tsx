import { useKeyboard } from '@opentui/react'
import React from 'react'

import { Button } from './button'
import { useTheme } from '../hooks/use-theme'
import { KeyHint } from './savant-ui/primitives/key-hint'

import type { SuggestionItem } from './suggestion-menu'

interface CommandPaletteProps {
  /** Filtered slash commands (already filtered by use-suggestion-engine). */
  items: SuggestionItem[]
  /** Prefix shown before each label ("/" for slash, "@" for mentions). */
  prefix?: string
  /** Index of the currently selected item (driven by useChatKeyboard). */
  selectedIndex: number
  /** Called when a command is selected (Enter or click). Receives the item. */
  onSelect: (item: SuggestionItem) => void
  /** Called when the user presses Escape. Clears the slash query upstream. */
  onClose: () => void
  /** Optional title shown at the top of the palette. */
  title?: string
}

/**
 * Overlay command palette that replaces the inline slash-command SuggestionMenu.
 *
 * Previously used OpenTUI's native `<select>`, but that element handles its own
 * keyboard navigation internally and ended up fighting with the global
 * `useChatKeyboard` dispatcher. We now render a fully controlled list: keyboard
 * navigation is driven by the parent's `slashSelectedIndex` and executed by
 * `useChatKeyboard`, while this component only renders the highlighted state and
 * handles click/Escape.
 *
 * Law 7 (search before create): reuses the existing `SuggestionItem` type from
 * `suggestion-menu.tsx` — does NOT redefine a parallel command type.
 *
 * Law 11 (follow discovered patterns): mirrors the overlay pattern used by
 * `login-modal.tsx` (full-width box, theme surface background, centered).
 *
 * Law 14 (error paths): if `items` is empty, renders a muted "no matches"
 * message rather than crashing with an empty options array.
 *
 * Rendered INLINE above the chat input (not as an early-return overlay that
 * hides the input box) — so the user can keep typing to refine the filter.
 */
export const CommandPalette = ({
  items,
  prefix = '/',
  selectedIndex,
  onSelect,
  onClose,
  title = 'Commands',
}: CommandPaletteProps) => {
  const theme = useTheme()

  // Escape closes the palette. We intentionally do NOT handle Up/Down/Enter
  // here; those are owned by useChatKeyboard so navigation stays in sync with
  // the input's slashSelectedIndex.
  useKeyboard(
    (event) => {
      if (event.name === 'escape') {
        onClose()
      }
    },
    { release: false },
  )

  const clampedIndex = Math.min(
    Math.max(selectedIndex, 0),
    Math.max(items.length - 1, 0),
  )

  return (
    <box
      style={{
        width: '100%',
        flexDirection: 'column',
        backgroundColor: theme.surface,
        borderStyle: 'single',
        borderColor: theme.primary,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      {/* Title bar */}
      <box
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 1,
          paddingTop: 0,
          paddingBottom: 0,
        }}
      >
        <text fg={theme.primary}>{title}</text>
        <text fg={theme.muted}>{`${items.length} match${
          items.length === 1 ? '' : 'es'
        }`}</text>
        <box style={{ flexGrow: 1 }} />
        <KeyHint shortcut="ESC" label="to close" />
      </box>

      {/* Command list — fully controlled, no internal keyboard handling. */}
      {items.length > 0 ? (
        <box style={{ flexDirection: 'column', width: '100%' }}>
          {items.map((item, index) => {
            const isSelected = index === clampedIndex
            return (
              <Button
                key={item.id}
                onClick={() => onSelect(item)}
                style={{
                  width: '100%',
                  paddingLeft: 1,
                  paddingRight: 1,
                  paddingTop: 0,
                  paddingBottom: 0,
                  backgroundColor: isSelected
                    ? theme.surfaceHover
                    : theme.surface,
                  flexDirection: 'row',
                  gap: 1,
                  alignItems: 'center',
                }}
              >
                {/* Marker + command */}
                <box style={{ flexDirection: 'row', flexShrink: 0, gap: 0 }}>
                  <text fg={theme.primary} wrapMode="none" selectable={false}>
                    {isSelected ? '› ' : '  '}
                  </text>
                  <text
                    fg={theme.foreground}
                    attributes={isSelected ? 1 : 0}
                    wrapMode="none"
                    selectable={false}
                  >
                    {`${prefix}${item.label}`}
                  </text>
                </box>
                {/* Description */}
                <box style={{ flexGrow: 1, minWidth: 0 }}>
                  <text fg={theme.muted} wrapMode="char" selectable={false}>
                    {item.description}
                  </text>
                </box>
                {/* Key hint for the selected item */}
                {isSelected && (
                  <box style={{ flexShrink: 0 }}>
                    <KeyHint shortcut="Enter" />
                  </box>
                )}
              </Button>
            )
          })}
        </box>
      ) : (
        <box style={{ paddingLeft: 1, paddingRight: 1, paddingBottom: 1 }}>
          <text fg={theme.muted}>No matching command</text>
        </box>
      )}
    </box>
  )
}
