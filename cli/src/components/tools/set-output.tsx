import { TrafficLightPanel } from '../traffic-light-panel'
import {
  isEmptyValue,
  isPlainObject,
  summarizePayload,
  SUMMARY_MAX_LENGTH,
} from './structured-card/classify'
import { StructuredCard } from './structured-card/StructuredCard'
import { defineToolComponent } from './types'

import type { ToolRenderConfig } from './types'
import type { JSONValue } from '@savant-code/common/types/json'

/**
 * Extract the meaningful payload a `set_output` call carries.
 *
 * Mirrors the no-schema path of
 * `packages/agent-runtime/src/tools/handlers/tool/set-output.ts`: when the
 * agent wrapped its output in `data` (the only input key), unwrap it;
 * otherwise the top-level fields are the output.
 */
function extractSetOutputPayload(
  input: Record<string, JSONValue> | undefined,
): JSONValue | undefined {
  if (!input) return undefined
  const keys = Object.keys(input)
  if (keys.length === 0) return undefined
  if (keys.length === 1 && keys[0] === 'data') return input.data
  return input
}

function truncateSingleLine(value: string): string {
  const line = value.replace(/\s+/g, ' ').trim()
  return line.length > SUMMARY_MAX_LENGTH
    ? `${line.slice(0, SUMMARY_MAX_LENGTH - 1)}…`
    : line
}

/**
 * UI component for `set_output`.
 *
 * FID-2026-0821-006: `set_output` previously had no renderer, so it fell into
 * the generic tool fallback, which collapsed by default and previewed the last
 * line of the JSON *input* (a bare `}`). This component reads the actual
 * payload — the `data` field when wrapped, else the top-level fields.
 * FID-2026-0822-014: it renders through the shape-detected structured cards
 * inside the unchanged TrafficLightPanel chrome; the raw payload classifies
 * directly (no YAML serialization anywhere in the display path).
 */
export const SetOutputComponent = defineToolComponent({
  toolName: 'set_output',

  render(toolBlock, theme, _options): ToolRenderConfig {
    const payload = extractSetOutputPayload(toolBlock.input)
    if (payload === undefined || isEmptyValue(payload)) {
      return { content: null }
    }

    const summary =
      isPlainObject(payload) && typeof payload.message === 'string'
        ? payload.message
        : summarizePayload(payload)

    return {
      collapsedPreview:
        summary !== undefined ? truncateSingleLine(summary) : undefined,
      content: (
        <TrafficLightPanel>
          <StructuredCard parts={payload} theme={theme} />
        </TrafficLightPanel>
      ),
    }
  },
})
