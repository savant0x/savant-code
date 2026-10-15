/**
 * FID-2026-0823-009 — yield-value input sanitizer.
 *
 * Programmatic generators may include optional keys holding explicit
 * \`undefined\` values in yielded tool-call inputs (e.g.
 * \`{ pattern, flags, cwd: undefined, maxResults: undefined }\`), at any
 * nesting depth (Verifier condition C1). The yield validator types input as
 * \`z.record(z.string(), jsonValueSchema)\` and \`undefined\` is not a JSON
 * value, so an unsanitized yield fails safeParse and kills the ENTIRE
 * subagent run ("Invalid yield value from handleSteps"). JSON.stringify hides
 * the problem in logs because it drops undefined-valued keys — the raw object
 * reaching validation does not.
 *
 * Tool-call inputs are deep-cleaned: every plain-object level drops
 * undefined-valued keys and arrays are element-wise cleaned; sentinels,
 * non-tool values, and unchanged inputs pass through by reference.
 */

type CleanResult = { value: unknown; changed: boolean }

function cleanUndefinedLeaves(value: unknown): CleanResult {
  if (Array.isArray(value)) {
    let changed = false
    const out = value.map((entry) => {
      const result = cleanUndefinedLeaves(entry)
      changed = changed || result.changed
      return result.value
    })
    return changed ? { value: out, changed } : { value, changed }
  }
  if (value !== null && typeof value === 'object') {
    let changed = false
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) {
        changed = true
        continue
      }
      const result = cleanUndefinedLeaves(entry)
      changed = changed || result.changed
      out[key] = result.value
    }
    return changed ? { value: out, changed } : { value, changed }
  }
  return { value, changed: false }
}

export function sanitizeYieldToolCallInput<T>(value: T): T {
  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'toolName' in value
  ) {
    const call = value as { toolName: unknown; input?: unknown }
    if (
      typeof call.toolName === 'string' &&
      call.input !== null &&
      typeof call.input === 'object' &&
      !Array.isArray(call.input)
    ) {
      const cleaned = cleanUndefinedLeaves(call.input)
      if (!cleaned.changed) return value
      return {
        ...(value as Record<string, unknown>),
        input: cleaned.value,
      } as T
    }
  }
  return value
}
