import z from 'zod/v4'

import type { JSONValue } from '../types/json'

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
