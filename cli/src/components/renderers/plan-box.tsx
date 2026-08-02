import { memo } from 'react'

import { useTheme } from '../../hooks/use-theme'
import { PLAN_BOX_HORIZONTAL_INSET } from '../../utils/chat-layout'
import {
  renderMarkdown,
  type MarkdownPalette,
} from '../../utils/markdown-renderer'
import { BORDER_CHARS } from '../../utils/ui-constants'
import { renderMarkdownContent } from '../blocks/markdown-content'
import { BuildModeButtons } from '../build-mode-buttons'

interface PlanBoxProps {
  planContent: string
  availableWidth: number
  markdownPalette: MarkdownPalette
  onBuildFast: () => void
  onBuildMax: () => void
  onBuildLite: () => void
}

export const PlanBox = memo(
  ({
    planContent,
    availableWidth,
    markdownPalette,
    onBuildFast,
    onBuildMax,
    onBuildLite,
  }: PlanBoxProps) => {
    const theme = useTheme()

    return (
      <box
        style={{
          flexDirection: 'column',
          gap: 1,
          width: '100%',
          borderStyle: 'single',
          borderColor: theme.secondary,
          paddingLeft: 1,
          paddingRight: 1,
          paddingTop: 0,
          paddingBottom: 1,
        }}
        customBorderChars={BORDER_CHARS}
      >
        {renderMarkdownContent({
          value: renderMarkdown(planContent, {
            codeBlockWidth: Math.max(
              1,
              availableWidth - PLAN_BOX_HORIZONTAL_INSET,
            ),
            palette: markdownPalette,
          }),
          theme,
          getAttributes: () => undefined,
          textColor: theme.foreground,
          keyPrefix: 'plan-content',
        })}
        <BuildModeButtons
          theme={theme}
          onBuildFast={onBuildFast}
          onBuildMax={onBuildMax}
          onBuildLite={onBuildLite}
        />
      </box>
    )
  },
)
