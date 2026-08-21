import { TextAttributes } from '@opentui/core'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useTheme } from '../../hooks/use-theme'
import { safeOpen } from '../../utils/open-url'
import { Button } from '../button'

import type { RenderUIButtonVariant } from './render-ui-widget-types'
import type { RenderUIButtonWidget } from '@savant-code/common/tools/params/tool/render-ui'

// ---- Button widget (unchanged logic) ---------------------------------------

const getButtonColors = (
  theme: ReturnType<typeof useTheme>,
  variant: RenderUIButtonVariant,
) => {
  const accent = variant === 'secondary' ? theme.secondary : theme.primary
  return {
    backgroundColor: undefined,
    foregroundColor: accent,
    borderColor: accent,
  }
}

const CLICK_FLASH_DURATION_MS = 150

export const RenderUIButton = ({
  widget,
}: {
  widget: RenderUIButtonWidget
}) => {
  const theme = useTheme()
  const [isHovered, setIsHovered] = useState(false)
  const [isClicked, setIsClicked] = useState(false)
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const variant = widget.variant ?? 'primary'
  const { backgroundColor, foregroundColor, borderColor } = getButtonColors(
    theme,
    variant,
  )

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current)
      }
    }
  }, [])

  const handleClick = useCallback(() => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current)
    }
    setIsClicked(true)
    safeOpen(widget.link)
    clickTimeoutRef.current = setTimeout(
      () => setIsClicked(false),
      CLICK_FLASH_DURATION_MS,
    )
  }, [widget.link])

  const textAttributes = isClicked
    ? TextAttributes.DIM
    : isHovered
      ? TextAttributes.BOLD | TextAttributes.UNDERLINE
      : TextAttributes.BOLD

  return (
    <box
      style={{
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Button
        onClick={handleClick}
        onMouseOver={() => setIsHovered(true)}
        onMouseOut={() => setIsHovered(false)}
        style={{
          backgroundColor,
          borderStyle: 'rounded',
          borderColor,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text>
          <span fg={foregroundColor} attributes={textAttributes}>
            {widget.text}
          </span>
          <span fg={foregroundColor} attributes={textAttributes}>
            {' ↗'}
          </span>
        </text>
      </Button>
    </box>
  )
}
