import { publisher } from '../constants'

import type { SecretAgentDefinition } from '../types/secret-agent-definition'
import type { JSONObject, JSONValue } from '../types/util-types'

interface ListDirectoryQuery {
  path: string
}

const paramsSchema = {
  type: 'object' as const,
  properties: {
    directories: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          path: { type: 'string' as const },
        },
        required: ['path'],
      },
      description: 'Array of directory paths to list',
    },
  },
  required: ['directories'],
}

const directoryLister: SecretAgentDefinition = {
  id: 'directory-lister',
  displayName: 'Directory Lister',
  spawnerPrompt:
    'Mechanically lists multiple directories and returns their contents',
  model: 'anthropic/claude-sonnet-4.5',
  publisher,
  includeMessageHistory: false,
  outputMode: 'structured_output',
  toolNames: ['list_directory', 'set_output'],
  spawnableAgents: [],
  inputSchema: {
    params: paramsSchema,
  },
  handleSteps: function* ({ params }) {
    function isJSONObject(value: JSONValue): value is JSONObject {
      return (
        value !== null && typeof value === 'object' && !Array.isArray(value)
      )
    }
    function asListDirectoryQueryArray(value: JSONValue): ListDirectoryQuery[] {
      if (!Array.isArray(value)) return []
      const result: ListDirectoryQuery[] = []
      for (const item of value) {
        if (!isJSONObject(item)) continue
        const path = item.path
        if (typeof path !== 'string') continue
        result.push({ path })
      }
      return result
    }
    const p = params ?? {}
    const directories = asListDirectoryQueryArray(p.directories)

    const toolResults: JSONValue[] = []
    for (const directory of directories) {
      const { toolResult } = yield {
        toolName: 'list_directory',
        input: {
          path: directory.path,
        },
      }
      if (toolResult) {
        toolResults.push(
          ...toolResult
            .filter((result) => result.type === 'json')
            .map((result) => ({
              path: directory.path,
              ...(isJSONObject(result.value) ? result.value : {}),
            })),
        )
      }
    }

    yield {
      toolName: 'set_output',
      input: {
        results: toolResults,
      },
      includeToolCall: false,
    }
  },
}

export default directoryLister
