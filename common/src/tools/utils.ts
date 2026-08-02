import { toolParams } from './list'
import { $getToolCallString } from './params/utils'

import type { ToolName } from './constants'
import type { JSONValue } from '../types/json'
import type z from 'zod/v4'

export function getToolCallString<T extends ToolName | (string & {})>(
  toolName: T,
  input: T extends ToolName
    ? z.infer<(typeof toolParams)[T]['inputSchema']>
    : Record<string, JSONValue>,
  ...endsAgentStep: T extends ToolName ? [] : [boolean]
): string {
  const endsAgentStepValue =
    toolName in toolParams
      ? toolParams[toolName as keyof typeof toolParams].endsAgentStep
      : (endsAgentStep[0] ?? false)
  return $getToolCallString({
    toolName,
    inputSchema: null,
    input,
    endsAgentStep: endsAgentStepValue,
  })
}
