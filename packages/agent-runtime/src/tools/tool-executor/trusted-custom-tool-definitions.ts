import type { CustomToolDefinitions } from '@savant-code/common/util/file'

// `let`: the reset below re-keys the marks, so a later test file cannot inherit
// trust recorded by an earlier one (FID-2026-1007-002).
let trustedDefinitions = new WeakSet<object>()

/** Mark a definition set produced by the runtime's host/MCP loading boundary. */
export function markTrustedCustomToolDefinitions(
  definitions: CustomToolDefinitions,
): CustomToolDefinitions {
  trustedDefinitions.add(definitions)
  return definitions
}

/** Check whether a definition set came from the runtime loading boundary. */
export function isTrustedCustomToolDefinitions(
  definitions: CustomToolDefinitions | undefined,
): definitions is CustomToolDefinitions {
  return definitions !== undefined && trustedDefinitions.has(definitions)
}

/**
 * Test isolation: drops every trust mark — process-lifetime state `bun test`
 * shares across files (FID-2026-1007-002). Marks are keyed by object identity,
 * so nothing an earlier file trusted is visible to a later one afterwards.
 */
export function resetTrustedDefinitions(): void {
  trustedDefinitions = new WeakSet<object>()
}
