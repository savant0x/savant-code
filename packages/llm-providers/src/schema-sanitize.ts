/**
 * Outbound JSON-Schema cycle sanitizer (FID-2026-0905-004).
 *
 * Free-form-JSON tool params serialize to `$defs`-cyclic JSON Schema, which
 * strict upstreams reject ("Recursive JSON schemas are not currently
 * supported"). The single-schema core (`inlineLocalSchemaRefs`) is extracted
 * verbatim from `openai-compatible-prepare-tools.ts` — the chat path keeps
 * byte-identical behavior through it — and `sanitizeOutboundRequestBody`
 * generalizes the cut to whole request bodies across the three SDK wire
 * shapes (OpenAI `function.parameters` / `parameters`, Anthropic
 * `input_schema`, Google `functionDeclarations[].parameters`).
 *
 * The sanitizer is fail-open by construction: anything it does not
 * recognize (non-JSON bodies, unknown shapes, parse failures) passes
 * through untouched. Cutting is idempotent — already-cut schemas are
 * fixed points.
 */
import type { FetchFunction } from '@ai-sdk/provider-utils'
import type { JSONValue } from '@savant-code/common/types/json'

function isRecord(value: JSONValue): value is Record<string, JSONValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function decodeJsonPointerSegment(segment: string) {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~')
}

function lookupJsonPointer(
  root: JSONValue,
  pointer: string,
): JSONValue | undefined {
  if (!pointer.startsWith('#/')) return undefined

  let current: JSONValue = root
  for (const segment of pointer
    .slice(2)
    .split('/')
    .map(decodeJsonPointerSegment)) {
    if (!isRecord(current) && !Array.isArray(current)) return undefined
    current = (current as Record<string, JSONValue>)[segment]
  }
  return current
}

export function inlineLocalSchemaRefs(schema: JSONValue): JSONValue {
  const root: JSONValue =
    isRecord(schema) && 'jsonSchema' in schema ? schema.jsonSchema : schema

  const visit = (value: JSONValue, refStack: Set<string>): JSONValue => {
    if (Array.isArray(value)) {
      return value.map((item) => visit(item, refStack))
    }

    if (!isRecord(value)) return value

    const ref = typeof value.$ref === 'string' ? value.$ref : undefined
    if (ref?.startsWith('#/')) {
      if (refStack.has(ref)) return {}

      const target = lookupJsonPointer(root, ref)
      const siblings = { ...value }
      delete siblings.$ref

      if (target !== undefined) {
        const nextRefStack = new Set(refStack)
        nextRefStack.add(ref)
        const resolved = visit(target, nextRefStack)
        if (isRecord(resolved) && Object.keys(siblings).length > 0) {
          return visit({ ...resolved, ...siblings }, refStack)
        }
        return resolved
      }

      if (Object.keys(siblings).length === 0) return {}
      return visit(siblings, refStack)
    }
    const result: Record<string, JSONValue> = {}
    for (const [key, child] of Object.entries(value)) {
      if (key === '$defs' || key === 'definitions') continue
      result[key] = visit(child, refStack)
    }
    return result
  }

  return visit(root, new Set())
}

/** Sanitize one tool object's schema fields in place-shape; returns the tool. */
function sanitizeToolObject(tool: Record<string, JSONValue>): JSONValue {
  const fn = tool.function
  if (isRecord(fn) && 'parameters' in fn) {
    return {
      ...tool,
      function: { ...fn, parameters: inlineLocalSchemaRefs(fn.parameters) },
    }
  }
  if ('input_schema' in tool) {
    return { ...tool, input_schema: inlineLocalSchemaRefs(tool.input_schema) }
  }
  if ('parameters' in tool) {
    return { ...tool, parameters: inlineLocalSchemaRefs(tool.parameters) }
  }
  for (const declarationsKey of [
    'functionDeclarations',
    'function_declarations',
  ]) {
    const declarations = tool[declarationsKey]
    if (Array.isArray(declarations)) {
      return {
        ...tool,
        [declarationsKey]: declarations.map((declaration) =>
          isRecord(declaration) && 'parameters' in declaration
            ? {
                ...declaration,
                parameters: inlineLocalSchemaRefs(declaration.parameters),
              }
            : declaration,
        ),
      }
    }
  }
  return tool
}

/**
 * Cut schema cycles in a parsed request body. Bodies without a `tools`
 * array are returned by reference (zero behavior change for non-tool
 * calls); anything unparseable is the caller's problem to pass through
 * (see `createSanitizingFetch`).
 */
export function sanitizeOutboundBody(body: JSONValue): JSONValue {
  if (!isRecord(body)) return body
  const tools = body.tools
  if (!Array.isArray(tools)) return body
  return {
    ...body,
    tools: tools.map((tool) =>
      isRecord(tool) ? sanitizeToolObject(tool) : tool,
    ),
  }
}

/**
 * Wrap a fetch implementation so outbound JSON request bodies carrying
 * tool schemas are cycle-cut before sending. Non-string bodies, bodies
 * without tools, and JSON parse failures pass through untouched.
 * The default inner transport resolves `globalThis.fetch` at call time
 * so test mocks keep working.
 */
export function createSanitizingFetch(inner?: FetchFunction): FetchFunction {
  const transport: FetchFunction =
    inner ?? (((input, init) => globalThis.fetch(input, init)) as FetchFunction)
  return (async (input, init) => {
    const body = init?.body
    if (typeof body === 'string') {
      let parsed: JSONValue
      try {
        parsed = JSON.parse(body) as JSONValue
      } catch {
        return transport(input, init)
      }
      const sanitized = sanitizeOutboundBody(parsed)
      if (sanitized !== parsed) {
        return transport(input, { ...init, body: JSON.stringify(sanitized) })
      }
    }
    return transport(input, init)
  }) as FetchFunction
}
