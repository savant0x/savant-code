import type { LanguageModelV2CallOptions } from '@ai-sdk/provider'
import type { JSONValue } from '@savant-code/common/types/json'

export type ParsedToolArguments =
  | { ok: true; value: Record<string, JSONValue> }
  | { ok: false; reason: 'invalid-json' }
  | { ok: false; reason: 'non-object'; value: JSONValue }

function isJsonObject(value: JSONValue): value is Record<string, JSONValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function parseJsonObjectArguments(args: string): ParsedToolArguments {
  try {
    const parsed = JSON.parse(args) as JSONValue
    return isJsonObject(parsed)
      ? { ok: true, value: parsed }
      : { ok: false, reason: 'non-object', value: parsed }
  } catch {
    return { ok: false, reason: 'invalid-json' }
  }
}

function hasRequiredToolKeys(
  value: Record<string, JSONValue>,
  requiredKeys: readonly string[] | undefined,
): boolean {
  if (requiredKeys === undefined) {
    return Object.keys(value).length > 0
  }

  return requiredKeys.every((key) =>
    Object.prototype.hasOwnProperty.call(value, key),
  )
}

/**
 * True when the request actually declared this tool name (FID-2026-1012-002).
 *
 * Deliberately separate from the completeness predicate below: the two answer
 * different questions. `isCompleteKnownToolCallArguments` asks "is this call
 * executable?" and must keep failing closed for an undeclared name; this asks
 * "was this tool offered at all?". Reporting the second condition as the first
 * tells the model to shrink a payload that was never the problem, and no retry
 * can satisfy it — the caller needs the distinction to classify the failure.
 */
export function isDeclaredToolName(
  toolName: string,
  requiredToolKeys: ReadonlyMap<string, readonly string[]>,
): boolean {
  return requiredToolKeys.has(toolName)
}

export function isCompleteKnownToolCallArguments(
  args: string,
  toolName: string,
  requiredToolKeys: ReadonlyMap<string, readonly string[]>,
): boolean {
  if (!isDeclaredToolName(toolName, requiredToolKeys)) {
    return false
  }

  return isCompleteToolCallArguments(args, requiredToolKeys.get(toolName))
}

/** Describe structure only; model-supplied values never enter recovery text. */
export function summarizeIncompleteToolArguments(
  args: string,
  toolName: string,
  requiredToolKeys: ReadonlyMap<string, readonly string[]>,
): string {
  const parsed = parseToolCallArguments(args)
  if (!parsed.ok) {
    return parsed.reason === 'invalid-json'
      ? '<root> — invalid_json (expected a complete JSON object)'
      : '<root> — invalid_type (expected object)'
  }
  const missing = requiredToolKeys
    .get(toolName)
    ?.find((key) => !Object.prototype.hasOwnProperty.call(parsed.value, key))
  return missing === undefined
    ? '<root> — incomplete_arguments'
    : `${missing.replace(/[\r\n\t]/g, ' ').slice(0, 80)} — missing_required_property`
}

export function isStaleToolArgumentFragment(
  args: string,
  toolName: string,
  requiredToolKeys: ReadonlyMap<string, readonly string[]>,
): boolean {
  const requiredKeys = requiredToolKeys.get(toolName)
  if (requiredKeys === undefined) {
    return false
  }

  const parsed = parseToolCallArguments(args)
  return (
    (!parsed.ok && parsed.reason === 'non-object') ||
    (parsed.ok && !hasRequiredToolKeys(parsed.value, requiredKeys))
  )
}

export function getRequiredToolKeys(
  tools: LanguageModelV2CallOptions['tools'],
): ReadonlyMap<string, readonly string[]> {
  const requiredKeys = new Map<string, readonly string[]>()

  for (const tool of tools ?? []) {
    if (tool.type !== 'function') {
      continue
    }

    const schema = tool.inputSchema
    const keys = schema.required ?? []
    requiredKeys.set(tool.name, keys)
  }

  return requiredKeys
}

/**
 * Parse tool-call arguments and report whether they form a complete JSON object
 * with the declared top-level required keys present. Value types and semantic
 * constraints remain the executor's responsibility.
 */
// FID-2026-0803-002 LLM-7: the previous wrapper returned `parsed` from both
// branches — the length check was a no-op. Delegate directly.
export function parseToolCallArguments(args: string): ParsedToolArguments {
  return parseJsonObjectArguments(args)
}

/**
 * Returns true only when the accumulated arguments form a non-empty JSON object
 * with the required keys for the tool. An explicitly empty required-key list
 * permits `{}` for zero-argument tools, but an unknown schema does not.
 */
export function isCompleteToolCallArguments(
  args: string,
  requiredKeys?: readonly string[],
): boolean {
  const parsed = parseJsonObjectArguments(args)
  return parsed.ok && hasRequiredToolKeys(parsed.value, requiredKeys)
}

/**
 * Structural view of the OpenAI-compatible chat completion chunk consumed by
 * the stream transform. Mirrors the (deliberately narrow) zod chunk schema in
 * openai-compatible-chat-language-model.ts — kept as a plain type so the
 * transform can be unit-tested without re-parsing every chunk.
 */
