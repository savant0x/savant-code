import { defineToolComponent, getString } from './types'
import { createMarkdownPalette } from '../../utils/theme-system'
import { renderContentWithMarkdown } from '../blocks/content-with-markdown'
import { renderMarkdownContent } from '../blocks/markdown-content'
import {
  TRAFFIC_PANEL_WIDTH_ALLOWANCE,
  TrafficLightPanel,
} from '../traffic-light-panel'

import type { ToolRenderConfig } from './types'
import type { JSONValue } from '@savant-code/common/types/json'

const PREVIEW_MAX_LENGTH = 160

/**
 * Coerce a block-level input value to a positive integer. The raw print-mode
 * payload may carry stringified numbers (mirrors the params schema's
 * `z.coerce.number().int().min(1)`).
 */
function asPositiveInt(value: JSONValue | undefined): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1) {
    return value
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number(value)
    if (Number.isInteger(n) && n >= 1) return n
  }
  return undefined
}

/** Coerce a block-level boolean (mirrors the params schema's coercedBoolean). */
function asBoolean(value: JSONValue | undefined): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

function truncateSingleLine(value: string): string {
  const line = value.replace(/\s+/g, ' ').trim()
  return line.length > PREVIEW_MAX_LENGTH
    ? `${line.slice(0, PREVIEW_MAX_LENGTH - 1)}…`
    : line
}

/**
 * UI component for `sequentialthinking`.
 *
 * FID-2026-0821-008: the Thinker's structured reasoning tool had no renderer,
 * so each thought showed only a header. The meaningful content is
 * `input.thought` (the handler's output is metadata counters only), so this
 * renders the thought inline as markdown with a short position label.
 * FID-2026-0822-006: framed in the shared TrafficLightPanel chrome so the
 * reasoning stream speaks the same design language as every result card.
 */
export const SequentialThinkingComponent = defineToolComponent({
  toolName: 'sequentialthinking',

  render(toolBlock, theme, options): ToolRenderConfig {
    const input = toolBlock.input ?? {}
    const thought = getString(input, 'thought')
    if (!thought || !thought.trim()) {
      return { content: null }
    }

    const thoughtNumber = asPositiveInt(input.thoughtNumber)
    const totalThoughts = asPositiveInt(input.totalThoughts)
    const isRevision = asBoolean(input.isRevision) === true
    const revisesThought = asPositiveInt(input.revisesThought)
    const branchId = getString(input, 'branchId')

    let label = '💭 Thought'
    if (thoughtNumber !== undefined) label += ` ${thoughtNumber}`
    if (totalThoughts !== undefined) label += `/${totalThoughts}`
    if (isRevision) {
      label = '↩️ Revising thought'
      if (revisesThought !== undefined) label += ` #${revisesThought}`
    }
    if (branchId) label += ` · ${branchId}`

    const firstLine = thought.split('\n').find((l) => l.trim()) ?? ''
    const collapsedPreview = truncateSingleLine(`${label} — ${firstLine}`)

    const markdown = `**${label}**\n\n${thought}`

    return {
      collapsedPreview,
      content: (
        <TrafficLightPanel>
          {renderMarkdownContent({
            value: renderContentWithMarkdown({
              content: markdown,
              isStreaming: false,
              // Full panel chrome allowance — border + padding (FID-2026-
              // 0822-009): wrapped lines must stay inside the true interior
              // width or OpenTUI re-wraps residue onto the border row.
              codeBlockWidth:
                Math.max(
                  1,
                  options.availableWidth - TRAFFIC_PANEL_WIDTH_ALLOWANCE,
                ),
              palette: createMarkdownPalette(theme),
            }),
            theme,
            getAttributes: (extra = 0) =>
              (theme.messageTextAttributes ?? 0) | extra,
            textColor: theme.foreground,
            keyPrefix: 'sequential-thinking-content',
          })}
        </TrafficLightPanel>
      ),
    }
  },
})
