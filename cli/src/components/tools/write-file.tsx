import { TextAttributes } from '@opentui/core'

import { defineToolComponent, getString } from './types'
import { isCreateFile } from '../../utils/implementor-helpers'
import { createMarkdownPalette } from '../../utils/theme-system'
import { renderContentWithMarkdown } from '../blocks/content-with-markdown'
import { renderMarkdownContent } from '../blocks/markdown-content'
import { Button } from '../button'
import { CollapseButton } from '../collapse-button'
import {
  TRAFFIC_PANEL_WIDTH_ALLOWANCE,
  TrafficLightPanel,
} from '../traffic-light-panel'

import type { ToolRenderConfig } from './types'
import type { ReactNode } from 'react'

/** Language hint used for the code-block fence of non-markdown targets. */
function codeLanguageFromPath(path: string): string {
  const ext = path.split('.').pop() ?? ''
  return /^[a-zA-Z0-9_+-]+$/.test(ext) ? ext : ''
}

/**
 * UI component for `write_file`.
 *
 * FID-2026-0823-006: `write_file` is a whole-file replace, not a line edit —
 * the old str_replace delegation rendered the entire document as an
 * all-additions `+`-prefixed diff (a "wall of unorganized text" for long
 * markdown docs like FIDs). This renderer shows a compact traffic-light
 * summary by default (operation + path + line count) and reveals the full
 * content only on expansion: markdown targets (`.md`/`.markdown`) render as
 * formatted markdown, everything else as a code block. `str_replace` keeps
 * its real per-line diff.
 */
export const WriteFileComponent = defineToolComponent({
  toolName: 'write_file',

  render(toolBlock, theme, options): ToolRenderConfig {
    const input = toolBlock.input ?? {}
    const path = getString(input, 'path') ?? ''
    const content = getString(input, 'content') ?? ''

    const operationLabel = isCreateFile(toolBlock) ? 'Create' : 'Write'
    const lineCount = content.length === 0 ? 0 : content.split('\n').length
    const isMarkdownTarget = /\.(md|markdown)$/i.test(path)

    // FID-2026-0823-006: collapse state + toggle come from ToolBranch; when
    // absent (direct renders), default to the compact summary with no
    // expand affordance rather than an unreadable wall.
    const isCollapsed = options.isCollapsed ?? true
    const onToggle = options.onToggle
    const toggleLabel = onToggle ? (isCollapsed ? '▸ ' : '▾ ') : ''

    const showBody = !isCollapsed && content.length > 0

    let body: ReactNode = null
    if (showBody) {
      const codeBlockWidth = Math.max(
        1,
        options.availableWidth - TRAFFIC_PANEL_WIDTH_ALLOWANCE,
      )
      const markdown = isMarkdownTarget
        ? content
        : `\`\`\`${codeLanguageFromPath(path)}\n${content}\n\`\`\``
      body = renderMarkdownContent({
        value: renderContentWithMarkdown({
          content: markdown,
          isStreaming: false,
          codeBlockWidth,
          palette: createMarkdownPalette(theme),
        }),
        theme,
        getAttributes: (extra = 0) =>
          (theme.messageTextAttributes ?? 0) | extra,
        textColor: theme.foreground,
        keyPrefix: 'write-file-content',
      })
    }

    return {
      collapsedPreview: `${operationLabel} ${path} (${lineCount} lines)`,
      content: (
        <TrafficLightPanel>
          <box style={{ flexDirection: 'column', gap: 0 }}>
            <Button
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingLeft: 1,
                paddingRight: 1,
                paddingTop: 0,
                paddingBottom: 0,
                width: '100%',
              }}
              onClick={onToggle}
            >
              <text style={{ wrapMode: 'none' }}>
                <span key="toggle" fg={theme.foreground}>
                  {toggleLabel}
                </span>
                <span
                  key="operation"
                  fg={theme.foreground}
                  attributes={TextAttributes.BOLD}
                >
                  {operationLabel}
                </span>
                <span key="path" fg={theme.foreground}>{` ${path}`}</span>
                {lineCount > 0 ? (
                  <span key="count" fg={theme.muted}>
                    {` (${lineCount} lines)`}
                  </span>
                ) : null}
              </text>
            </Button>
            {showBody ? (
              <box
                style={{
                  flexDirection: 'column',
                  gap: 0,
                  paddingLeft: 1,
                  paddingRight: 1,
                  paddingTop: 0,
                  paddingBottom: 0,
                }}
              >
                {body}
              </box>
            ) : null}
            {showBody && onToggle ? (
              <CollapseButton onClick={onToggle} />
            ) : null}
          </box>
        </TrafficLightPanel>
      ),
    }
  },
})
