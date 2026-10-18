import { expect, test } from 'bun:test'
import z from 'zod/v4'

import { toolParams } from '../list'

/**
 * FID-2026-1017-014 — class guard for the model-facing tool schema.
 *
 * `fid_worktree` shipped with a `z.discriminatedUnion` at the root of its
 * parameter schema. The AI SDK serializes that as `{ $schema, oneOf }` — no
 * top-level `type: 'object'` and no `properties` — so the function-calling
 * provider advertised the tool with no fields and the model emitted `{}`,
 * which the runtime then rejected as `invalid_union`. The live lane lifecycle
 * was unreachable until the root became an object.
 *
 * Every tool's provider-facing parameters must therefore be an object with a
 * `properties` map. A union or intersection root hides the field list and
 * fails here instead of in a live session.
 */
/**
 * `z.custom<Message>()` is deliberately unrepresentable, and `set_messages` is
 * an internal context-pruner tool the model never calls: the prompt layer falls
 * back to an empty object schema for it. The ledger below is exact — a newly
 * unrepresentable tool fails this test instead of being skipped silently.
 */
const KNOWN_NON_SERIALIZABLE = ['set_messages']

test('every tool parameter schema has an object root with properties', () => {
  const offenders: string[] = []
  const nonSerializable: string[] = []

  for (const [toolName, params] of Object.entries(toolParams)) {
    const schema = params.inputSchema
    if (schema == null) continue

    let jsonSchema: Record<string, unknown>
    try {
      jsonSchema = z.toJSONSchema(schema as z.ZodType, {
        io: 'input',
      }) as Record<string, unknown>
    } catch {
      nonSerializable.push(toolName)
      continue
    }

    if (jsonSchema.type !== 'object') {
      offenders.push(
        `${toolName}: root type is ${JSON.stringify(jsonSchema.type ?? null)} ` +
          `(keys: ${Object.keys(jsonSchema).join(',') || 'none'})`,
      )
      continue
    }
    if (
      jsonSchema.properties == null ||
      typeof jsonSchema.properties !== 'object'
    ) {
      offenders.push(`${toolName}: no properties map`)
    }
  }

  expect(offenders).toEqual([])
  expect(nonSerializable.sort()).toEqual([...KNOWN_NON_SERIALIZABLE].sort())
})
