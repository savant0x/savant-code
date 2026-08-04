import type { AgentStep } from './agent-runner'
import type { JSONValue } from '@savant-code/common/types/json'
import type { ToolResultOutput } from '@savant-code/common/types/messages/content-part'

/**
 * Truncate trace data to save tokens while preserving structure
 * - read_files: Replace file content with '[TRUNCATED - file was read]'
 * - run_terminal_command/code_search: Truncate stdout to 500 chars
 */

// FID-2026-0803-007 EV-8: the tool-result output items are JSON blobs; narrow
// with the real union + a JSON-object guard instead of `any`.
function isJsonObject(value: JSONValue): value is Record<string, JSONValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function truncateTrace(trace: AgentStep[]): AgentStep[] {
  return trace.map((step) => {
    if (step.type === 'tool_result') {
      const output = Array.isArray(step.output) ? step.output : [step.output]

      if (step.toolName === 'read_files') {
        const truncatedOutput = output.map((item: ToolResultOutput) => {
          if (item.type === 'json' && Array.isArray(item.value)) {
            return {
              ...item,
              value: item.value.map((file) => {
                if (isJsonObject(file)) {
                  const path = file.path
                  const content = file.content
                  if (
                    typeof path === 'string' &&
                    typeof content === 'string' &&
                    path.length > 0 &&
                    content.length > 0
                  ) {
                    return {
                      path,
                      content: '[TRUNCATED - file was read]',
                      referencedBy: file.referencedBy,
                    }
                  }
                }
                return file
              }),
            }
          }
          return item
        })
        return { ...step, output: truncatedOutput }
      }

      if (
        step.toolName === 'run_terminal_command' ||
        step.toolName === 'code_search'
      ) {
        const truncatedOutput = output.map((item: ToolResultOutput) => {
          if (item.type === 'json' && isJsonObject(item.value)) {
            const stdout = item.value.stdout
            if (typeof stdout === 'string') {
              return {
                ...item,
                value: {
                  ...item.value,
                  stdout:
                    stdout.length > 500
                      ? stdout.slice(0, 500) + '... [TRUNCATED]'
                      : stdout,
                },
              }
            }
          }
          return item
        })
        return { ...step, output: truncatedOutput }
      }
    }
    return step
  })
}
