import { Button } from '../button'
import { TrafficLightPanel } from '../traffic-light-panel'
import { summarizePayload, unwrapParts } from './structured-card/classify'
import { StructuredCard } from './structured-card/StructuredCard'
import { defineToolComponent } from './types'
import { getToolDisplayInfo } from '../../utils/savant-code-client'

/** Shared chrome for any namespaced MCP result, without per-server registration. */
export const McpResultComponent = defineToolComponent({
  toolName: 'deep_research',
  render(block, theme, options) {
    const value = unwrapParts(block.outputRaw ?? block.output)
    const summary = summarizePayload(value)
    const loading = options.isStreaming || block.output === undefined
    return {
      collapsedPreview: summary,
      content: (
        <TrafficLightPanel>
          <Button onClick={options.onToggle}>
            <text fg={theme.foreground} style={{ wrapMode: 'word' }}>
              {options.isCollapsed ? '▸ ' : '▾ '}
              {getToolDisplayInfo(block.toolName).name}
              {loading ? ' — running' : ''}
            </text>
          </Button>
          {loading ? (
            <text fg={theme.muted}>Waiting for the tool result…</text>
          ) : options.isCollapsed ? (
            <text fg={theme.muted} style={{ wrapMode: 'word' }}>
              {summary ?? 'No results returned.'}
            </text>
          ) : value === undefined ? (
            <text fg={theme.muted}>No results returned.</text>
          ) : (
            <StructuredCard parts={value} theme={theme} />
          )}
        </TrafficLightPanel>
      ),
    }
  },
})
