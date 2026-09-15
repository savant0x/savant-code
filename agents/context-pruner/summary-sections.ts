/**
 * P1a — Structured-summary section builders (FID-2026-0915-002 row 7;
 * extracted move-only from structured-summary.ts, Batch B embeddedHelpers
 * pattern). The <structured_state> assembly (buildStructuredSummary,
 * buildStandingFacts, buildGoalSection, buildDecisions) stays in
 * structured-summary.ts.
 *
 * Pure functions — embedded via .toString() at factory time. Constants are
 * baked into the generated scope by handle-steps.ts. Embedded scope: call
 * sites resolve by bare name — referenced helpers (collectIdentifiers,
 * serializePreservedState) are embedded by handle-steps.ts too.
 */
import { IDENTIFIERS_MAX, IDENTIFIER_MAX_CHARS } from './constants'
import { getTextContent } from './helpers'
import { serializePreservedState } from './preserved-state'

import type { PreservedState } from './preserved-state'
import type { Message } from '../types/util-types'

// NOTE: every function here must be exported — the module is embedded into the
// generated handleSteps source via .toString() and functions resolve by bare
// name inside the eval'd scope. Module-level constants are NOT carried over
// (only CONTEXT_PRUNER_CONSTANTS is baked), so regexes live inside functions.

export function buildFilesSection(preservedState: PreservedState): string {
  const lines = ['## Files & code']
  if (preservedState.readFiles.length > 0) {
    lines.push(`- read: ${preservedState.readFiles.join(', ')}`)
  }
  if (preservedState.modifiedFiles.length > 0) {
    lines.push(`- modified: ${preservedState.modifiedFiles.join(', ')}`)
  }
  if (preservedState.createdFiles.length > 0) {
    lines.push(`- created: ${preservedState.createdFiles.join(', ')}`)
  }
  if (lines.length === 1) lines.push('(none in this window)')
  return lines.join('\n')
}

export function buildTodosSection(preservedState: PreservedState): string {
  const lines = ['## Open TODOs (reference-only)']
  if (preservedState.todos.length === 0) {
    lines.push('(none)')
  } else {
    lines.push(
      ...preservedState.todos.map(
        (t) => `- [${t.completed ? 'x' : ' '}] ${t.task}`,
      ),
    )
  }
  return lines.join('\n')
}

export function buildIdentifiers(messages: Message[]): string {
  const lines = ['## Exact identifiers']
  const identifiers: string[] = []
  for (const message of messages) {
    if (message.role === 'system') continue
    collectIdentifiers(getTextContent(message), identifiers)
    if (identifiers.length >= IDENTIFIERS_MAX) break
  }
  if (identifiers.length === 0) {
    lines.push('(none)')
  } else {
    lines.push(...identifiers.map((i) => `- ${i}`))
  }
  return lines.join('\n')
}

export function collectIdentifiers(text: string, out: string[]): void {
  const candidates = [
    ...(text.match(/FID-\d{4}-\d{4}-\d{3}(?:-[a-z0-9-]+)?/gi) ?? []),
    ...(text.match(/https?:\/\/[^\s"'<>]+/g) ?? []),
    ...(text.match(
      /[A-Za-z0-9_@./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|md|mdx|yaml|yml|json|go|rs|py|rb|sh|css|scss|html|toml|lock|sql|env)\b/g,
    ) ?? []),
  ]
  for (const candidate of candidates) {
    if (out.length >= IDENTIFIERS_MAX) return
    const cleaned = candidate.slice(0, IDENTIFIER_MAX_CHARS)
    if (!out.includes(cleaned)) out.push(cleaned)
  }
}

export function buildPreservedStateSection(
  preservedState: PreservedState,
): string {
  return `## Preserved state\n${serializePreservedState(preservedState)}\n</structured_state>`
}
