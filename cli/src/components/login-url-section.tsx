import React, { useState } from 'react'

import { Button } from './button'
import { IS_SAVANT_FREE } from '../utils/constants'

import type { ChatTheme } from '../types/theme-system'

type LoginUrlSectionProps = {
  loginUrl: string
  loginUrlLines: string[]
  loginUrlWrapped: boolean
  justCopied: boolean
  hasSelection: boolean
  isVerySmall: boolean
  isNarrow: boolean
  isRemote: boolean
  contentMaxWidth: number
  sectionMarginBottom: number
  theme: ChatTheme
  onCopy: (text: string) => void
}

/**
 * The "after pressing enter" login section: the wrapped URL rows, the
 * wrapped-link warning, the copy button, and the waiting/remote-session tip.
 * Extracted from LoginModal so the component file stays under the line bar
 * (FID-2026-0819-005 quality ratchet: Loop 123).
 */
export const LoginUrlSection = ({
  loginUrl,
  loginUrlLines,
  loginUrlWrapped,
  justCopied,
  hasSelection,
  isVerySmall,
  isNarrow,
  isRemote,
  contentMaxWidth,
  sectionMarginBottom,
  theme,
  onCopy,
}: LoginUrlSectionProps) => {
  // Track hover state for copy button
  const [isCopyButtonHovered, setIsCopyButtonHovered] = useState(false)

  return (
    <box
      style={{
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: sectionMarginBottom,
        maxWidth: contentMaxWidth,
        flexShrink: 0,
        gap: isVerySmall ? 0 : 1,
      }}
    >
      <text style={{ wrapMode: 'word' }}>
        <span fg={theme.foreground}>
          {isNarrow
            ? 'Open this URL to login:'
            : 'Open this URL in your browser to login:'}
        </span>
      </text>
      <box
        style={{
          width: '100%',
          flexShrink: 0,
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        {loginUrlLines.map((line, index) => (
          <text key={index} style={{ wrapMode: 'none' }}>
            <span
              fg={
                justCopied
                  ? theme.success
                  : hasSelection
                    ? theme.info
                    : theme.primary
              }
            >
              {line}
            </span>
          </text>
        ))}
      </box>
      {loginUrlWrapped && (
        <text style={{ wrapMode: 'word' }}>
          <span fg={theme.warning}>
            ⚠ The link wraps across lines — clicking it will cut it off. Press c
            to copy the full link instead.
          </span>
        </text>
      )}
      <box
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          flexShrink: 0,
        }}
      >
        <Button
          onClick={() => onCopy(loginUrl)}
          onMouseOver={() => setIsCopyButtonHovered(true)}
          onMouseOut={() => setIsCopyButtonHovered(false)}
        >
          <text>
            <span
              fg={
                justCopied
                  ? theme.foreground
                  : isCopyButtonHovered
                    ? theme.foreground
                    : theme.primary
              }
            >
              {justCopied ? '[ ✓ Copied! ]' : '[ Copy link (c) ]'}
            </span>
          </text>
        </Button>
      </box>
      <box
        style={{
          marginTop: isVerySmall ? 1 : 2,
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          flexShrink: 0,
        }}
      >
        <text style={{ wrapMode: 'none' }}>
          <span fg={theme.secondary}>Waiting for login...</span>
        </text>
        {isRemote && !isVerySmall && (
          <text style={{ wrapMode: 'word' }}>
            <span fg={theme.secondary}>Tip: Can't copy? Exit and run </span>
            <span fg={theme.primary}>
              {IS_SAVANT_FREE ? 'savant-free' : 'savant-code'} login
            </span>
            <span fg={theme.secondary}> instead.</span>
          </text>
        )}
      </box>
    </box>
  )
}
