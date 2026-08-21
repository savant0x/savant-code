import React, { useState } from 'react'

import { Button } from './button'
import { useTheme } from '../hooks/use-theme'
import { LOGIN_WEBSITE_URL } from '../login/constants'
import { BORDER_CHARS } from '../utils/ui-constants'

/** Build a friend's share link from the referral code. Points at the
 *  /get-started page (CLI install walkthrough + hero + FAQs) rather than the
 *  bare landing page; the `?ref=` code is still captured into the attribution
 *  cookie there via the root layout's ReferralCodeCapture. When we know the
 *  inviter's name we pass `?referrer=` too so the page greets the friend with
 *  "X invited you to try SavantFree!". */
export function referralLink(
  code: string,
  referrerName: string | null,
): string {
  const params = new URLSearchParams({ ref: code })
  if (referrerName) params.set('referrer', referrerName)
  return `${LOGIN_WEBSITE_URL}/get-started?${params.toString()}`
}

// Navigation ids for the banner's keyboard-focusable buttons. The model
// selector owns the landing keyboard handler and appends these after its rows.
export const COPY_FOCUS_ID = '__savant_free_referral_copy__'
export const GLM_FOCUS_ID = '__savant_free_referral_glm__'
export const BUTTON_HORIZONTAL_CHROME = 6 // two border + four padding columns

export interface SavantFreeReferralFocusTarget {
  id: string
  activate: () => void
}

/** Below this menu width, the two unlocked-card actions no longer fit beside
 * each other. */
export const shouldStackSavantFreeReferralActions = (width: number): boolean =>
  width < 62

export const firstLabelThatFits = (
  availableWidth: number,
  labels: readonly string[],
): string =>
  labels.find(
    (label) => label.length + BUTTON_HORIZONTAL_CHROME <= availableWidth,
  ) ?? labels.at(-1)!

/**
 * A bordered, button-styled "copy invite link" control. Reads as clickable
 * (rounded border + hover/keyboard-focus highlight) and flips to an accent
 * "✔ Copied!" confirmation for a couple seconds after a successful copy.
 * Presentational: the copy action and copied flag are owned by the banner so
 * the same action can be fired by keyboard navigation from the model picker.
 */
export const CopyInviteLinkButton: React.FC<{
  isCopied: boolean
  focused: boolean
  onCopy: () => void
  availableWidth: number
  labels?: readonly string[]
}> = ({
  isCopied,
  focused,
  onCopy,
  availableWidth,
  labels = ['⎘ Copy invite link', '⎘ Copy link', '⎘ Copy'],
}) => {
  const theme = useTheme()
  const [isHovered, setIsHovered] = useState(false)
  const label = firstLabelThatFits(availableWidth, labels)
  const copiedLabel = firstLabelThatFits(availableWidth, ['✔ Copied!', '✔'])
  // Keyboard focus and mouse hover share the highlighted look; a keyboard-
  // focused row gets the brighter accent border so it matches the picker's
  // focused-row treatment above it.
  const borderColor = isCopied
    ? theme.primary
    : focused
      ? theme.primary
      : isHovered
        ? theme.foreground
        : theme.border
  const fg = isCopied
    ? theme.primary
    : focused || isHovered
      ? theme.foreground
      : theme.muted

  return (
    <Button
      id={COPY_FOCUS_ID}
      onClick={onCopy}
      onMouseOver={() => setIsHovered(true)}
      onMouseOut={() => setIsHovered(false)}
      border
      borderStyle="rounded"
      borderColor={borderColor}
      customBorderChars={BORDER_CHARS}
      style={{
        paddingLeft: 2,
        paddingRight: 2,
        backgroundColor: 'transparent',
        // Hug the label and never let a width-constrained row squash the
        // bordered box (which would clip the label and mangle the border).
        flexShrink: 0,
      }}
    >
      <text style={{ wrapMode: 'none' }}>
        <span fg={fg}>{isCopied ? copiedLabel : label}</span>
      </text>
    </Button>
  )
}
