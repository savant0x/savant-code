import { askUserParams } from '@savant-code/common/tools/params/tool/ask-user'
import { toolDisplayName } from '@savant-code/common/util/tool-display'
import { AskUserBridge } from '@savant-code/common/utils/ask-user-bridge'
import { SavantCodeClient } from '@savant-code/sdk'

import { getCliEnv, getSystemProcessEnv } from './env'
import { loadAgentDefinitions } from './local-agent-registry'
import { logger } from './logger'
import { createTraceWriter } from './trace-writer'
import { getRgPath } from '../native/ripgrep'
import { getProjectRoot } from '../project-files'

import type { JSONValue } from '@savant-code/common/types/json'

let clientInstance: SavantCodeClient | null = null

/**
 * Recursively removes undefined values from an object to ensure clean JSON serialization.
 * This prevents issues with APIs that don't accept explicit undefined values.
 */
function removeUndefinedValues<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedValues) as T
  }
  if (typeof obj === 'object') {
    const result: Record<string, JSONValue> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        result[key] = removeUndefinedValues(value) as JSONValue
      }
    }
    return result as T
  }
  return obj
}

/**
 * Reset the cached SavantCodeClient instance.
 * This should be called after login to ensure the client is re-initialized with new credentials.
 */
export function resetSavantCodeClient(): void {
  clientInstance = null
}

export async function getSavantCodeClient(options?: {
  headless?: boolean
}): Promise<SavantCodeClient | null> {
  if (!clientInstance) {
    const projectRoot = getProjectRoot()

    // Set up ripgrep path for SDK to use
    const env = getCliEnv()
    if (env.SAVANT_CODE_IS_BINARY) {
      try {
        const rgPath = await getRgPath()
        // Note: We still set process.env here because SDK reads from it
        getSystemProcessEnv().SAVANT_CODE_RG_PATH = rgPath
      } catch (error) {
        logger.error(error, 'Failed to set up ripgrep binary for SDK')
      }
    }

    try {
      const agentDefinitions = loadAgentDefinitions()
      // FID-2026-0929-005 (gut the backend): the client takes no credential.
      // The old gate (no token → null + a "run the login flow or set
      // SAVANT_CODE_API_KEY" warning) gated a backend identity that no longer
      // exists; direct mode is the only mode.
      clientInstance = new SavantCodeClient({
        cwd: projectRoot,
        agentDefinitions,
        logger,
        traceWriter: createTraceWriter(),
        overrideTools: {
          ask_user: async (input: Record<string, JSONValue>) => {
            // Headless mode (FID-2026-0806-011): there is no TUI bridge to
            // answer an ask_user question, so always skip. Interactive CLI
            // sessions keep the AskUserBridge flow below.
            if (options?.headless) {
              return [
                {
                  type: 'json',
                  value: { answers: [], skipped: true },
                },
              ]
            }
            const { questions } = askUserParams.inputSchema.parse(input)
            const askUserResponse = await AskUserBridge.request(
              'cli-override',
              questions,
            )
            const response = askUserResponse as {
              answers?: Array<{ questionIndex: number; selectedOption: string }>
              skipped?: boolean
            }
            return [
              {
                type: 'json',
                value: removeUndefinedValues(response),
              },
            ]
          },
        },
      })
    } catch (error) {
      logger.error(error, 'Failed to initialize SavantCodeClient')
      return null
    }
  }

  return clientInstance
}

export function getToolDisplayInfo(toolName: string): {
  name: string
  type: string
} {
  // FID-2026-1013-011 W2-1: the Title-Case label (list_directory override +
  // MCP `server__tool` stripping) is canonical in
  // `@savant-code/common/util/tool-display`; this wrapper keeps the CLI's
  // `{ name, type }` shape for its two callers.
  return { name: toolDisplayName(toolName), type: 'tool' }
}

function toYaml(value: JSONValue, indent = 0): string {
  const spaces = '  '.repeat(indent)

  if (value === null || value === undefined) {
    return 'null'
  }

  if (typeof value === 'string') {
    if (value.includes('\n')) {
      const lines = value.split('\n')
      return (
        '|\n' + lines.map((line) => '  '.repeat(indent + 1) + line).join('\n')
      )
    }
    return value.includes(':') || value.includes('#') ? `"${value}"` : value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return (
      '\n' +
      value
        .map((item) => spaces + '- ' + toYaml(item, indent + 1).trimStart())
        .join('\n')
    )
  }

  const entries = Object.entries(value)
  if (entries.length === 0) return '{}'

  return entries
    .map(([key, entryValue]) => {
      const yamlValue = toYaml(entryValue, indent + 1)
      if (
        typeof entryValue === 'object' &&
        entryValue !== null &&
        !Array.isArray(entryValue) &&
        Object.keys(entryValue).length > 0
      ) {
        return `${spaces}${key}:\n${yamlValue}`
      }
      return `${spaces}${key}: ${yamlValue}`
    })
    .join('\n')
}

export function formatToolOutput(output: JSONValue): string {
  if (!output) return ''

  if (Array.isArray(output)) {
    return output
      .map((item: JSONValue) => {
        const typedItem = item as {
          type: 'json' | 'text'
          value?: JSONValue
          text?: string
        }
        if (typedItem.type === 'json') {
          // Handle errorMessage in the value object
          if (
            typedItem.value &&
            typeof typedItem.value === 'object' &&
            'errorMessage' in typedItem.value
          ) {
            return String(
              (typedItem.value as Record<string, JSONValue>).errorMessage,
            )
          }
          return toYaml(typedItem.value ?? null)
        }
        if (typedItem.type === 'text') {
          return typedItem.text || ''
        }
        return String(item)
      })
      .join('\n')
  }

  if (typeof output === 'string') {
    return output
  }

  return toYaml(output)
}
