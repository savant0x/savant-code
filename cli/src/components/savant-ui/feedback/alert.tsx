import { TextAttributes } from '@opentui/core'
import React from 'react'

import { useTheme } from '../../../hooks/use-theme'
import { glyph, type GlyphName } from '../../../utils/glyphs'
import { resolveThemeColor, type ThemeColorKey } from '../icon-theme-keys'

export interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  message: string
}

// FID-033b Phase B: alert icons + colors sourced from the centralized glyph
// map + ChatTheme tokens (no hardcoded hex, Law 13).
const ALERT_MAP: Record<
  NonNullable<AlertProps['type']>,
  { glyph: GlyphName; colorKey: ThemeColorKey }
> = {
  info: { glyph: 'alertInfo', colorKey: 'info' },
  success: { glyph: 'alertSuccess', colorKey: 'success' },
  warning: { glyph: 'alertWarning', colorKey: 'warning' },
  error: { glyph: 'alertError', colorKey: 'error' },
}

export function Alert({ type = 'info', title, message }: AlertProps) {
  const theme = useTheme()
  const mapping = ALERT_MAP[type]
  const color = resolveThemeColor(theme, mapping.colorKey)
  const icon = glyph(mapping.glyph)

  return (
    <box flexDirection="row" gap={1}>
      <text fg={color}>{icon}</text>
      <box flexDirection="column">
        {title && (
          <text fg={color} attributes={TextAttributes.BOLD}>
            {title}
          </text>
        )}
        <text>{message}</text>
      </box>
    </box>
  )
}
