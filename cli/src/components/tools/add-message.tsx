import { defineToolComponent, getString } from './types'
import { createMarkdownPalette } from '../../utils/theme-system'
import { renderContentWithMarkdown } from '../blocks/content-with-markdown'
import { renderMarkdownContent } from '../blocks/markdown-content'
import {
  TRAFFIC_PANEL_WIDTH_ALLOWANCE,
  TrafficLightPanel,
} from '../traffic-light-panel'

import type { ToolRenderConfig } from './types'

const PREVIEW_MAX_LENGTH = 160

function truncateSingleLine(value: string): string {
  const line = value.replace(/\s+/g, ' ').trim()
  return line.length > PREVIEW_MAX_LENGTH
    ? `${line.slice(0, PREVIEW_MAX_LENGTH - 1)}…`
    : line
}

/**
 * UI component for `add_message`.
 *
 * FID-2026-0822-011: previously unregistered, so tmux-cli narration calls
 * fell through to the generic collapsed fallback (header-only, pre-chrome).
 * The meaningful content is the INPUT message (the handler's output is a
 * static "Message added." ack), so this renders `input.content` as markdown
 * inside the shared TrafficLightPanel chrome with a role label.
 */
export const AddMessageComponent = defineToolComponent({
  toolName: 'add_message',

  render(toolBlock, theme, options): ToolRenderConfig {
    const input = toolBlock.input ?? {}
    const content = getString(input, 'content')
    if (!content || !content.trim()) {
      return { content: null }
    }

    const role = getString(input, 'role')
    const roleLabel = role === 'user' ? 'User message' : 'Assistant message'

    const firstLine = content.split('\n').find((l) => l.trim()) ?? ''
    const collapsedPreview = truncateSingleLine(`${roleLabel} — ${firstLine}`)

    const markdown = `**${roleLabel}**\n\n${content}`

    return {
      collapsedPreview,
      content: (
        <TrafficLightPanel>
          {renderMarkdownContent({
            value: renderContentWithMarkdown({
              content: markdown,
              isStreaming: false,
              // Full panel chrome allowance — border + padding (FID-2026-
              // 0822-009 pattern): wrapped lines must stay inside the true
              // interior width.
              codeBlockWidth: Math.max(
                1,
                options.availableWidth - TRAFFIC_PANEL_WIDTH_ALLOWANCE,
              ),
              palette: createMarkdownPalette(theme),
            }),
            theme,
            getAttributes: (extra = 0) =>
              (theme.messageTextAttributes ?? 0) | extra,
            textColor: theme.foreground,
            keyPrefix: 'add-message-content',
          })}
        </TrafficLightPanel>
      ),
    }
  },
})
