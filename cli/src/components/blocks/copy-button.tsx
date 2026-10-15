import { TextAttributes } from '@opentui/core'
import React, { memo, useCallback, useEffect, useRef, useState } from 'react'

import { useTheme } from '../../hooks/use-theme'
import { copyToClipboard } from '../../utils/clipboard'
import { Clickable } from '../clickable'

interface CopyButtonProps {
  /** Callback that returns the text to copy when clicked */
  getCopyText: () => string
  /** Optional icon override (default: clipboard) */
  icon?: string
  /** Tooltip / aria-label */
  label?: string
}

/**
 * CopyButton — universal copy affordance.
 *
 * Renders a small inline copy icon. Supports idle, hover, copied, and failed
 * states. Uses the existing terminal-safe clipboard utility.
 *
 * FID-2026-0725-087
 */
export const CopyButton = memo(function CopyButton({
  getCopyText,
  icon = '⎘',
  label = 'Copy to clipboard',
}: CopyButtonProps) {
  const theme = useTheme()
  const [state, setState] = useState<'idle' | 'hovering' | 'copied' | 'failed'>(
    'idle',
  )
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseOver = useCallback(() => {
    setState((prev) => (prev === 'idle' ? 'hovering' : prev))
  }, [])

  const handleMouseOut = useCallback(() => {
    setState((prev) => (prev === 'hovering' ? 'idle' : prev))
  }, [])

  const handleClick = useCallback(async () => {
    if (state === 'copied' || state === 'failed') return

    const text = getCopyText()
    if (!text) return

    const success = await copyToClipboard(text)
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current)
    }
    const nextState = success ? 'copied' : 'failed'
    setState(nextState)
    resetTimerRef.current = setTimeout(() => {
      resetTimerRef.current = null
      setState('idle')
    }, 600)
  }, [getCopyText, state])

  useEffect(
    () => () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current)
        resetTimerRef.current = null
      }
    },
    [],
  )

  let displayIcon = icon
  let fg: string = theme.muted
  let attributes = TextAttributes.DIM

  switch (state) {
    case 'hovering':
      fg = theme.info ?? theme.primary
      attributes = TextAttributes.UNDERLINE
      break
    case 'copied':
      displayIcon = '✓'
      // FID-2026-0822-007: the hex fallback was dead code — success is
      // always defined on ChatTheme.
      fg = theme.success
      attributes = 0
      break
    case 'failed':
      displayIcon = '✗'
      fg = theme.error
      attributes = 0
      break
  }

  return (
    <Clickable
      as="text"
      onMouseDown={handleClick}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      style={{ fg }}
      title={label}
      attributes={attributes}
    >
      <span>{displayIcon}</span>
    </Clickable>
  )
})
