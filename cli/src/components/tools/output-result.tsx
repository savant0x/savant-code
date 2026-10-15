import { TrafficLightPanel } from '../traffic-light-panel'
import {
  classifyPayload,
  summarizePayload,
  SUMMARY_MAX_LENGTH,
  unwrapParts,
} from './structured-card/classify'
import { StructuredCard } from './structured-card/StructuredCard'
import { defineToolComponent } from './types'

import type { ToolRenderConfig } from './types'

/**
 * Sanitized single-line collapsed preview derived from the payload's human
 * summary — never from the YAML serialization.
 */
function previewFromSummary(summary: string | undefined): string | undefined {
  if (!summary) return undefined
  const cleaned = summary.replace(/[#*_`~]/g, '').trim()
  if (!cleaned) return undefined
  return cleaned.length > SUMMARY_MAX_LENGTH
    ? `${cleaned.slice(0, SUMMARY_MAX_LENGTH - 1)}…`
    : cleaned
}

/**
 * Shared renderer for result-bearing tools whose meaningful content is the
 * tool result. FID-2026-0821-007 gave these tools their first renderer;
 * FID-2026-0822-014 replaces its YAML code-block fallback with the
 * shape-detected structured cards inside the unchanged TrafficLightPanel
 * chrome (FID-2026-0822-005/006). The raw serialized parts ride
 * `toolBlock.outputRaw` (`updateToolBlockWithOutput` stores them); the
 * formatted `output` string stays untouched for the copy/export paths.
 *
 * `toolName: 'deep_research'` is the representative name; the registry aliases
 * this one component to every result-bearing tool (Law 13 — one renderer, many
 * tools, mirroring `run_readonly_command` → `RunTerminalCommandComponent`).
 */
export const OutputResultComponent = defineToolComponent({
  toolName: 'deep_research',

  render(toolBlock, theme, _options): ToolRenderConfig {
    const parts = toolBlock.outputRaw
    if (parts === undefined || parts === null) {
      return { content: null }
    }
    const value = unwrapParts(parts)
    if (value === undefined || classifyPayload(value) === 'empty') {
      // Empty payload: render nothing at all, panel included — preserves the
      // pre-cards behavior for missing/blank results.
      return { content: null }
    }

    return {
      collapsedPreview: previewFromSummary(summarizePayload(value)),
      content: (
        <TrafficLightPanel>
          <StructuredCard parts={value} theme={theme} />
        </TrafficLightPanel>
      ),
    }
  },
})
