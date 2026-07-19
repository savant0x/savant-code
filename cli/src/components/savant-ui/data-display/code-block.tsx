import React from 'react'

import { TextAttributes } from '@opentui/core'

import { useTheme } from '../../../hooks/use-theme'

export interface CodeBlockProps {
  code: string
  language?: string
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const theme = useTheme()

  return (
    <box flexDirection="column">
      {language && (
        <text fg={theme.muted} attributes={TextAttributes.DIM}>
          {language}
        </text>
      )}
      <box border={true} borderStyle="rounded" borderColor={theme.border} paddingLeft={1} paddingRight={1}>
        <text fg={theme.foreground}>{code}</text>
      </box>
    </box>
  )
}
