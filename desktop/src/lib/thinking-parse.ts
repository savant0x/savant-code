// FID-2026-0821-008 + FID-2026-0901-006 — sequential-thinking render parser.
//
// The CLI renders `sequentialthinking` from `input.thought` (the handler's
// output is metadata counters only), as a "💭 Thought N/M" markdown card. The
// desktop otherwise shows raw JSON. This is a pure parser mirroring that exact
// extraction: (toolName, inputJson) => label + markdown body or null.

export interface ThinkingPayload {
  /** e.g. '💭 Thought 2/5' or '↩️ Revising thought #3 · branch-1'. */
  label: string
  /** The thought body, rendered as markdown. */
  markdown: string
  /** A one-line preview for the collapsed card header. */
  preview: string
}

function parseObject(inputJson: string | null): Record<string, unknown> | null {
  if (inputJson === null) return null
  try {
    const value: unknown = JSON.parse(inputJson)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null
    }
    return value as { [key: string]: unknown }
  } catch {
    return null
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asPositiveInt(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined
  return Number.isInteger(value) && value > 0 ? value : undefined
}

function asBoolean(value: unknown): boolean {
  return value === true
}

/** Extract a renderable thought from a sequentialthinking input. */
export function parseThinkingInput(
  inputJson: string | null,
): ThinkingPayload | null {
  const input = parseObject(inputJson)
  if (input === null) return null
  const thought = asString(input.thought)
  if (thought === null || thought.trim() === '') return null

  const thoughtNumber = asPositiveInt(input.thoughtNumber)
  const totalThoughts = asPositiveInt(input.totalThoughts)
  const isRevision = asBoolean(input.isRevision)
  const revisesThought = asPositiveInt(input.revisesThought)
  const branchId = asString(input.branchId)

  let label = '💭 Thought'
  if (thoughtNumber !== undefined) label += ` ${thoughtNumber}`
  if (totalThoughts !== undefined) label += `/${totalThoughts}`
  if (isRevision) {
    label = '↩️ Revising thought'
    if (revisesThought !== undefined) label += ` #${revisesThought}`
  }
  if (branchId) label += ` · ${branchId}`

  const firstLine = thought.split('\n').find((line) => line.trim()) ?? ''
  const preview =
    firstLine.length > 80
      ? `${firstLine.slice(0, 79)}…`
      : `${label} — ${firstLine}`

  return { label, markdown: `**${label}**\n\n${thought}`, preview }
}
