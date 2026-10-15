import React from 'react'

import { CopyInviteLinkButton } from './referral-copy-button'
import { useTheme } from '../hooks/use-theme'

interface ReferralQuietLineProps {
  children: React.ReactNode
  isCopied: boolean
  focused: boolean
  onCopy: () => void
  width: number
}

/**
 * Quiet one-line referral ad (✦ text + share button): used by both the
 * LIMITED-tier bonus line and the FULL-tier locked state, so the banner stays
 * compact while the reward is still advertised and actionable.
 */
export const ReferralQuietLine = ({
  children,
  isCopied,
  focused,
  onCopy,
  width,
}: ReferralQuietLineProps) => {
  const theme = useTheme()
  return (
    <box
      style={{
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 0,
        marginTop: 1,
        // Never let a height-starved landing column squash the banner — that
        // would draw the bordered copy button on top of the line above it.
        flexShrink: 0,
      }}
    >
      <text style={{ wrapMode: 'word' }}>
        <span fg={theme.muted}>✦ </span>
        {children}
      </text>
      <CopyInviteLinkButton
        isCopied={isCopied}
        focused={focused}
        onCopy={onCopy}
        availableWidth={width}
      />
    </box>
  )
}
