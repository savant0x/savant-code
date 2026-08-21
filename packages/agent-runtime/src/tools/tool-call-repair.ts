import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { JSONValue } from '@savant-code/common/types/json'

export type ToolCallError = {
  toolName?: string
  input: JSONValue
  error: string
} & Pick<SavantCodeToolCall, 'toolCallId'>

const bareStringFieldRepairAllowlist: Partial<
  Record<string, readonly string[]>
> = {
  code_search: ['pattern'],
  find_files: ['prompt'],
  glob: ['pattern'],
  list_directory: ['path'],
  lookup_agent_info: ['agentId'],
  read_files: ['paths'],
  read_subtree: ['paths'],
  read_url: ['url'],
  skill: ['name'],
  web_search: ['query'],
}

function repairBareStringFieldObject(
  input: string,
  toolName: string,
): Record<string, string> | undefined {
  const allowedFields = bareStringFieldRepairAllowlist[toolName]
  if (!allowedFields) {
    return undefined
  }

  const match = input
    .trim()
    .match(
      /^\{\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*:\s*([^"{}[\],][^{}[\],]*)\s*\}$/,
    )
  if (!match) {
    return undefined
  }

  const [, field, rawValue] = match
  if (!allowedFields.includes(field)) {
    return undefined
  }

  const value = rawValue.trim()
  if (!value || value === 'null' || value === 'undefined') {
    return undefined
  }

  return { [field]: value }
}

export function parseStringifiedToolInput(
  input: JSONValue,
  toolName: string,
): { input: JSONValue; parseError?: string } {
  let parsed = input
  let parseError: string | undefined

  // Some providers/models double-encode tool arguments, for example an input
  // value like "\"{\\\"path\\\":\\\"file.ts\\\"}\"". Repeated JSON.parse
  // handles that before falling back to narrow, tool-specific repairs.
  for (let i = 0; i < 3 && typeof parsed === 'string'; i++) {
    const stringInput = parsed
    try {
      parsed = JSON.parse(stringInput)
      parseError = undefined
    } catch (error) {
      const repaired = repairBareStringFieldObject(stringInput, toolName)
      if (repaired !== undefined) {
        parsed = repaired
        parseError = undefined
      } else {
        parseError = error instanceof Error ? error.message : String(error)
      }
      break
    }
  }

  return { input: parsed, parseError }
}

export function stringInputError(
  toolName: string,
  toolCallId: string,
  parseError?: string,
): ToolCallError {
  const parseDetails = parseError
    ? ` Parsing as JSON failed: ${parseError}. The arguments may be malformed or incomplete.`
    : ' Parsing succeeded, but the parsed value was still a string.'
  return {
    toolName,
    toolCallId,
    input: {},
    error: `Invalid parameters for ${toolName}: expected the tool arguments to be an object, but received a string.${parseDetails} Re-issue the tool call with the full arguments object and properly escaped string values.`,
  }
}

export function summarizeMissingReplacementFields(
  toolName: string,
  issues: Array<{
    expected?: string | string[]
    code?: string
    path?: PropertyKey[]
    message?: string
  }>,
): string | undefined {
  if (toolName !== 'str_replace' && toolName !== 'propose_str_replace') {
    return undefined
  }

  const missingFields = issues.flatMap((issue) => {
    const [root, index, field] = issue.path ?? []
    const isMissingReplacementString =
      issue.code === 'invalid_type' &&
      issue.expected === 'string' &&
      issue.message?.includes('received undefined') &&
      root === 'replacements' &&
      typeof index === 'number' &&
      (field === 'oldString' || field === 'newString')

    return isMissingReplacementString ? [`replacements[${index}].${field}`] : []
  })

  if (missingFields.length !== issues.length || missingFields.length === 0) {
    return undefined
  }

  return [
    'Missing required replacement fields:',
    ...missingFields.map((field) => `- ${field}`),
    '',
    'If the intent is deletion, set "newString": "" explicitly.',
  ].join('\n')
}

export function getToolValidationHint(toolName: string): string | undefined {
  if (toolName === 'str_replace' || toolName === 'propose_str_replace') {
    return 'Expected shape: { "path": string, "replacements": [{ "oldString": string, "newString": string, "allowMultiple"?: boolean }] }.'
  }
  if (toolName === 'write_file' || toolName === 'propose_write_file') {
    return 'Expected shape: { "path": string, "instructions": string, "content": string }. Quote string values and escape newlines/quotes inside content.'
  }
  if (toolName === 'spawn_agents') {
    return 'Expected shape: { "agents": [{ "agent_type": string, "prompt"?: string, "params"?: object }] }. The top-level value must be an object; "agents" must be an array of objects (not a string).'
  }
  return undefined
}
