// Shared harness for the RenderUIComponent test family.
// Sibling of the Loop 332 decomposition (suite files all import these).
// initializeThemeStore() runs at module import, matching the original
// monolith's module-scope initialization.

import { initializeThemeStore } from '../../../hooks/use-theme'

initializeThemeStore()

import type { ToolBlock } from '../types'
import type { JSONValue } from '@savant-code/common/types/json'

export const createToolBlock = (
  input: Record<string, JSONValue> | undefined,
): ToolBlock & { toolName: 'render_ui' } => ({
  type: 'tool',
  toolName: 'render_ui',
  toolCallId: 'test-render-ui-call-id',
  input: input ?? {},
})

export const renderOptions = {
  availableWidth: 80,
  indentationOffset: 0,
  labelWidth: 10,
}
