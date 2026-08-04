import { endsAgentStepParam } from '@savant-code/common/tools/constants'
import { toolParams } from '@savant-code/common/tools/list'
import { AVAILABLE_SKILLS_PLACEHOLDER } from '@savant-code/common/tools/params/tool/skill'
import { getToolCallString } from '@savant-code/common/tools/utils'
import { buildArray } from '@savant-code/common/util/array'
import { formatAvailableSkillsXml } from '@savant-code/common/util/skills'
import { pluralize } from '@savant-code/common/util/string'
import { cloneDeep } from 'lodash'
import z from 'zod/v4'
import { convertJsonSchemaToZod } from 'zod-from-json-schema'

import type { ToolName } from '@savant-code/common/tools/constants'
import type { JSONValue } from '@savant-code/common/types/json'
import type { SkillsMap } from '@savant-code/common/types/skill'
import type { CustomToolDefinitions } from '@savant-code/common/util/file'
import type { ToolSet } from 'ai'

/**
 * Ensures the inputSchema is a Zod schema. If it's a JSON Schema object
 * (from SDK custom tools that were serialized), converts it to Zod.
 */
export function ensureZodSchema(
  schema: z.ZodType | Record<string, JSONValue>,
): z.ZodType {
  // Check if it's already a Zod schema by looking for the safeParse method
  if (
    schema &&
    typeof (schema as { safeParse?: unknown }).safeParse === 'function'
  ) {
    return schema as z.ZodType
  }
  // JSON Schema object - convert to Zod
  return convertJsonSchemaToZod(schema as Record<string, JSONValue>)
}

/**
 * FID-2026-0802-005 L4: single source of truth for JSON-Schema-compatibility
 * guarding — previously duplicated verbatim in templates/prompts.ts.
 */
export function ensureJsonSchemaCompatible(schema: z.ZodType): z.ZodType {
  try {
    z.toJSONSchema(schema, { io: 'input' })
    return schema
  } catch {
    const fallback = z.object({}).passthrough()
    return schema.description ? fallback.describe(schema.description) : fallback
  }
}

function toJsonSchemaSafe(schema: z.ZodType): Record<string, JSONValue> {
  try {
    return z.toJSONSchema(schema, { io: 'input' }) as Record<string, JSONValue>
  } catch {
    return { type: 'object', properties: {} }
  }
}

function hasMeaningfulJsonSchema(
  jsonSchema: Record<string, JSONValue>,
): boolean {
  const properties = jsonSchema.properties
  if (
    properties &&
    typeof properties === 'object' &&
    Object.keys(properties).length > 0
  ) {
    return true
  }

  for (const key of ['allOf', 'anyOf', 'oneOf']) {
    const value = jsonSchema[key]
    if (Array.isArray(value) && value.length > 0) {
      return true
    }
  }

  const required = jsonSchema.required
  if (Array.isArray(required) && required.length > 0) {
    return true
  }

  return false
}

function paramsSection(params: { schema: z.ZodType; endsAgentStep: boolean }) {
  const { schema, endsAgentStep } = params
  const safeSchema = ensureJsonSchemaCompatible(schema)
  const schemaWithEndsAgentStepParam = endsAgentStep
    ? safeSchema.and(
        z.object({
          [endsAgentStepParam]: z
            .literal(endsAgentStep)
            .describe('Easp flag must be set to true'),
        }),
      )
    : safeSchema
  const jsonSchema = toJsonSchemaSafe(schemaWithEndsAgentStepParam)
  delete jsonSchema.description
  delete jsonSchema['$schema']
  const paramsDescription = hasMeaningfulJsonSchema(jsonSchema)
    ? JSON.stringify(jsonSchema, null, 2)
    : 'None'

  let paramsSection = ''
  if (paramsDescription.length === 1 && paramsDescription[0] === 'None') {
    paramsSection = 'Params: None'
  } else if (paramsDescription.length > 0) {
    paramsSection = `Params: ${paramsDescription}`
  }
  return paramsSection
}

// Helper function to build the full tool description markdown
export function buildToolDescription(params: {
  toolName: string
  schema: z.ZodType
  description?: string
  endsAgentStep: boolean
  exampleInputs?: JSONValue[]
}): string {
  const {
    toolName,
    schema,
    description = '',
    endsAgentStep,
    exampleInputs = [],
  } = params
  const descriptionWithExamples = buildArray(
    description,
    exampleInputs.length > 0
      ? `${pluralize(exampleInputs.length, 'Example')}:`
      : '',
    ...exampleInputs.map((example) =>
      getToolCallString(
        toolName,
        example as Record<string, JSONValue>,
        endsAgentStep,
      ),
    ),
  ).join('\n\n')
  return buildArray([
    `### ${toolName}`,
    schema.description || '',
    paramsSection({ schema, endsAgentStep }),
    descriptionWithExamples,
  ]).join('\n\n')
}

export const getToolCallFormatInstructions =
  (): string => `Tool calls use a specific XML and JSON-like format. Adhere precisely to this canonical envelope:

${getToolCallString(
  'tool_name',
  {
    parameter1: 'value1',
    parameter2: 123,
  },
  false,
)}

Never emit the incompatible <tool_call><function=...> or <parameter=...> format. Never narrate a tool call as XML outside the canonical <savant_code_tool_call>...</savant_code_tool_call> envelope. When using the text tool-call protocol, emit valid JSON containing cb_tool_name inside the canonical envelope; the runtime executes only that format.`

// FID-2026-0802-005 L2/L3: `getToolsInstructions`, `fullToolList`,
// `getShortToolInstructions`, `toolDescriptions`, and `buildShortToolDescription`
// were removed — zero production callers (Law 4), and fullToolList's
// tautological `toolNames.filter(n => toolNames.includes(n))` filter masked a
// latent crash (undefined `toolDescriptions[name]` → `.replace()` TypeError).

export async function getToolSet(params: {
  toolNames: string[]
  additionalToolDefinitions: () => Promise<CustomToolDefinitions>
  agentTools: ToolSet
  skills: SkillsMap
}): Promise<ToolSet> {
  const { toolNames, additionalToolDefinitions, agentTools, skills } = params

  // Generate available skills XML for the skill tool description
  const availableSkillsXml = formatAvailableSkillsXml(skills)
  const toolSet: ToolSet = {}
  for (const toolName of toolNames) {
    if (toolName in toolParams) {
      const toolDef = toolParams[toolName as ToolName]

      // For the skill tool, replace the placeholder with actual available skills
      if (toolName === 'skill' && availableSkillsXml) {
        let description = toolDef.description ?? ''
        description = description.replace(
          AVAILABLE_SKILLS_PLACEHOLDER,
          availableSkillsXml,
        )
        toolSet[toolName] = {
          ...toolDef,
          description,
        }
      } else if (toolName === 'skill') {
        // Explicitly state no skills are available
        let description = toolDef.description ?? ''
        description = description.replace(
          AVAILABLE_SKILLS_PLACEHOLDER,
          'There are no skills available. Do not use this tool because there are no skills to load.',
        )
        toolSet[toolName] = {
          ...toolDef,
          description,
        }
      } else {
        toolSet[toolName] = toolDef
      }
    }
  }

  const toolDefinitions = await additionalToolDefinitions()
  for (const [toolName, toolDefinition] of Object.entries(toolDefinitions)) {
    const clonedDef = cloneDeep(toolDefinition)
    // Custom tool inputSchema may be JSON Schema (from SDK) or Zod (from MCP)
    // Ensure it's a Zod schema for the AI SDK
    const zodSchema = ensureZodSchema(
      clonedDef.inputSchema as Record<string, JSONValue>,
    )
    const safeSchema = ensureJsonSchemaCompatible(zodSchema)
    toolSet[toolName] = {
      ...clonedDef,
      inputSchema: safeSchema,
    } as (typeof toolSet)[string]
  }

  // Add agent tools (agents as direct tool calls)
  for (const [toolName, toolDefinition] of Object.entries(agentTools)) {
    toolSet[toolName] = toolDefinition
  }

  return toolSet
}
