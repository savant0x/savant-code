import { SimpleToolCallItem } from './tool-call-item'
import { defineToolComponent } from './types'

import type { ToolRenderConfig } from './types'

interface GlobInput {
  pattern?: string
  cwd?: string
}

interface GlobErrorOutput {
  type: 'json'
  value: { errorMessage?: string }
}

/**
 * UI component for glob tool.
 * Displays a single line showing the glob pattern and number of matching files.
 * Does not support expand/collapse - always shows as a single line.
 */
export const GlobComponent = defineToolComponent({
  toolName: 'glob',

  render(toolBlock): ToolRenderConfig {
    const input = (toolBlock.input ?? {}) as GlobInput
    const pattern = input.pattern ?? ''
    const cwd = input.cwd ?? ''

    // Parse output to check for errors
    let hasError = false

    if (toolBlock.output) {
      const outputArray = Array.isArray(toolBlock.output)
        ? (toolBlock.output as unknown[])
        : [toolBlock.output as unknown]

      for (const item of outputArray) {
        if (item && typeof item === 'object' && 'type' in item) {
          const output = item as GlobErrorOutput
          if (output.type === 'json' && output.value?.errorMessage) {
            hasError = true
          }
        }
      }
    }

    if (!pattern) {
      return { content: null }
    }

    // Build single-line summary
    let summary = pattern

    if (cwd) {
      summary += ` in ${cwd}`
    }

    if (hasError) {
      summary += ' (error)'
    }
    // TODO(James): Reenable when we pass tool results as an object
    //  else {
    //   summary += ` (${fileCount} file${fileCount === 1 ? '' : 's'})`
    // }

    return {
      content: <SimpleToolCallItem name="Glob" description={summary} />,
    }
  },
})
