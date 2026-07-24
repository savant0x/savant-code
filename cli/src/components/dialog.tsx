/**
 * Dialog (FID-2026-0720-033d Phase D Step 2)
 *
 * Reusable overlay modal primitive. Designed to replace the 4 ad-hoc modal
 * patterns cataloged in FID-033d Step 2 (Law 7 — search before create):
 *   - login-modal.tsx (auth flow)
 *   - review-screen.tsx (publish review)
 *   - publish-confirmation.tsx (publish confirm)
 *   - ask-user/ (multi-choice form)
 *
 * This is the foundational primitive; migration of each ad-hoc pattern to use
 * `<Dialog>` is incremental and tracked separately.
 *
 * Law 11 (follow discovered patterns): the overlay container pattern (full-
 * width box, surface background, border, centered content) mirrors the
 * existing `login-modal.tsx` and `chat-input-bar.tsx` ask-user container.
 *
 * Law 14 (error paths): Dialog is a pure layout container — it never crashes.
 * If children render nothing, Dialog renders an empty bordered box (not a
 * blank screen). Escape always calls `onClose` so the user is never trapped.
 */

import { useKeyboard } from '@opentui/react'
import React from 'react'


import { useTheme } from '../hooks/use-theme'

interface DialogProps {
  /** Title shown in the dialog header (optional). */
  title?: string
  /** Dialog content. */
  children: React.ReactNode
  /** Called when the user presses Escape. Required — prevents modal traps. */
  onClose: () => void
  /** Optional footer content (e.g. action buttons). */
  footer?: React.ReactNode
  /** Width of the dialog (default '80%'). Matches OpenTUI box style width type. */
  width?: number | 'auto' | `${number}%`
  /** Border style (default 'single'). Matches OpenTUI borderStyle options. */
  borderStyle?: 'single' | 'double' | 'rounded'
}

export const Dialog = ({
  title,
  children,
  onClose,
  footer,
  width = '80%',
  borderStyle = 'single',
}: DialogProps) => {
  const theme = useTheme()

  // Escape closes the dialog — prevents modal traps (Law 14).
  useKeyboard(
    (event) => {
      if (event.name === 'escape') {
        onClose()
      }
    },
    { release: false },
  )

  return (
    <box
      style={{
        width,
        flexDirection: 'column',
        backgroundColor: theme.surface,
        borderStyle,
        borderColor: theme.primary,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      {/* Header */}
      {title && (
        <box
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 1,
            paddingBottom: 0,
          }}
        >
          <text fg={theme.primary}>{title}</text>
          <box style={{ flexGrow: 1 }} />
          <text fg={theme.muted}>{'ESC'}</text>
        </box>
      )}

      {/* Content */}
      <box style={{ flexDirection: 'column', flexGrow: 1 }}>
        {children}
      </box>

      {/* Footer */}
      {footer && (
        <box
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 1,
            paddingTop: 0,
          }}
        >
          {footer}
        </box>
      )}
    </box>
  )
}
