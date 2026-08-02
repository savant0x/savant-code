import type { ToolSet } from 'ai'

/**
 * Keeps only the tool definitions explicitly allowed by an agent template.
 *
 * Parent tool sets may contain tools that are valid for the parent but not for
 * a spawned child. Filtering at the handoff boundary keeps the model-visible
 * tool definitions aligned with executor authorization.
 */
export function filterToolSet(
  tools: ToolSet,
  allowedToolNames: readonly string[],
): ToolSet {
  const allowedNames = new Set(allowedToolNames)
  return Object.fromEntries(
    Object.entries(tools).filter(([toolName]) => allowedNames.has(toolName)),
  )
}
