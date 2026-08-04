import z from 'zod/v4'

import type { JSONValue } from '../types/json'
import type { JSONSchema as JSONSchemaNamespace } from 'zod/v4/core'

type JSONSchema = JSONSchemaNamespace.JSONSchema

/**
 * Convert a Zod4 schema to JSON string representation.
 */
export function schemaToJsonStr(
  schema: z.ZodTypeAny | undefined | Record<string, JSONValue>,
  options?: Parameters<typeof z.toJSONSchema>[1],
): string {
  if (!schema) return 'None'

  try {
    // Handle Zod schemas
    if (schema instanceof z.ZodType) {
      const jsonSchema = z.toJSONSchema(schema, options)
      delete jsonSchema['$schema']
      return JSON.stringify(jsonSchema, null, 2)
    }

    // Otherwise, pass on plain object
    return JSON.stringify(schema, null, 2)
  } catch (error) {
    return 'None'
  }
}

/**
 * FID-2026-0803-003 CMN-1: zod v4's `z.preprocess` (used by `coerceToArray` /
 * `coerceToObject`) wraps a property in a pipe whose *input* type is `unknown`,
 * so `z.toJSONSchema` drops the property from the emitted `required` array —
 * the model is told the field is optional even though the runtime schema
 * requires it. This wrapper re-derives `required` from the zod `shape` +
 * `.isOptional()` (which reports pipes as non-optional), so emitted tool
 * schemas match their plain counterparts.
 */
export function toToolInputJSONSchema(schema: z.ZodType): JSONSchema {
  const jsonSchema = z.toJSONSchema(schema, { io: 'input' })
  restoreRequired(schema, jsonSchema as Record<string, JSONValue>)
  return jsonSchema
}

function restoreRequired(
  schema: z.ZodType,
  jsonSchema: Record<string, JSONValue>,
): void {
  if (jsonSchema['type'] !== 'object') return

  const shape = (schema as { shape?: Record<string, z.ZodType> }).shape
  if (!shape) return

  const required = Object.entries(shape)
    .filter(([, prop]) => !prop.isOptional())
    .map(([key]) => key)
  if (required.length > 0) {
    jsonSchema['required'] = required
  } else {
    delete jsonSchema['required']
  }

  const properties = jsonSchema['properties']
  if (
    properties &&
    typeof properties === 'object' &&
    !Array.isArray(properties)
  ) {
    const propertySchemas = properties as Record<
      string,
      Record<string, JSONValue>
    >
    for (const [key, propSchema] of Object.entries(shape)) {
      const propJson = propertySchemas[key]
      if (propJson) restoreRequired(propSchema, propJson)
    }
  }
}
