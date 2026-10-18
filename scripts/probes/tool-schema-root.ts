/**
 * Model-facing tool schema probe — FID-2026-1017-014.
 *
 * Prints the root of every tool's provider-facing JSON schema and fails when a
 * root is not an object. `fid_worktree` shipped with a `discriminatedUnion` at
 * the root, which the AI SDK serializes as `{ oneOf: [...] }` — no top-level
 * `type` and no `properties` — so the provider advertised the tool with no
 * fields and every live call arrived as `{}`, refused as `invalid_union`.
 *
 * The unit guard lives in
 * `common/src/tools/__tests__/tool-schema-object-root.test.ts`; this probe is
 * the human-readable view of the same fact through the SDK conversion the
 * provider actually receives.
 *
 * Usage: `bun scripts/probes/tool-schema-root.ts`
 */
import { zodSchema } from 'ai'

import { toolParams } from '@savant-code/common/tools/list'

/**
 * `z.custom<Message>()` is deliberately unrepresentable; `set_messages` is an
 * internal context-pruner tool the model never calls, and the prompt layer
 * falls back to an empty object schema for it.
 */
const KNOWN_NON_SERIALIZABLE = new Set(['set_messages'])

const failures: string[] = []
const unexpected: string[] = []

for (const [toolName, params] of Object.entries(toolParams)) {
  const schema = params.inputSchema
  if (schema == null) continue

  let root: Record<string, unknown>
  try {
    root = (await zodSchema(schema as never).jsonSchema) as Record<
      string,
      unknown
    >
  } catch (error) {
    if (!KNOWN_NON_SERIALIZABLE.has(toolName)) {
      unexpected.push(`${toolName}: not serializable (${String(error)})`)
    }
    continue
  }

  const type = JSON.stringify(root.type ?? null)
  const hasProperties = root.properties != null
  console.log(
    `${type === '"object"' && hasProperties ? 'ok  ' : 'FAIL'} ${toolName}: type=${type} properties=${hasProperties}`,
  )
  if (type !== '"object"' || !hasProperties) {
    failures.push(`${toolName} (type=${type}, properties=${hasProperties})`)
  }
}

if (unexpected.length > 0) {
  console.log(`unexpected non-serializable schemas:\n${unexpected.join('\n')}`)
}
if (failures.length > 0) {
  console.error(
    `FAIL — ${failures.length} tool schema root(s) are not objects: ${failures.join(', ')}`,
  )
  process.exitCode = 1
} else if (unexpected.length > 0) {
  process.exitCode = 1
} else {
  console.log('PASS — every model-facing tool schema root is an object')
}
