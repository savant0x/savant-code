/**
 * P1a + P1c — Structured summary contract + user-message guarantee
 * (FID-2026-0806-003 Phase 1).
 *
 * Builds the required-section header block (<structured_state>…) that leads
 * the condensed memory: Standing facts & constraints (user intent verbatim,
 * never paraphrased), Goal, Decisions & rationale, Files & code, Open TODOs
 * (reference-only — never "Next Steps"/"Remaining Work", which the model
 * would read as active instructions), Pending user asks, Exact identifiers
 * (literal), and the Preserved state JSON block (P1b). The first user turn is
 * pinned verbatim so the originating request survives every budget (P1c).
 *
 * Pure functions — embedded via .toString() at factory time. Constants are
 * baked into the generated scope by handle-steps.ts.
 */
import {
  CHARS_PER_TOKEN,
  DECISION_MAX_CHARS,
  DECISIONS_MAX_ENTRIES,
  FIRST_USER_TURN_MAX_TOKENS,
  GOAL_MAX_TOKENS,
  IDENTIFIER_MAX_CHARS,
  IDENTIFIERS_MAX,
  STANDING_FACTS_MAX_TOKENS,
  STRUCTURED_STATE_MAX_CHARS,
  USER_MESSAGE_LIMIT,
} from './constants'
import { getTextContent, truncateLongText } from './helpers'
import { buildPendingAsks } from './pending-asks'
import { serializePreservedState } from './preserved-state'

import type { PreservedState } from './preserved-state'
import type { Message } from '../types/util-types'

export { buildPendingAsks } from './pending-asks'

// NOTE: every function here must be exported — the module is embedded into the
// generated handleSteps source via .toString() and functions resolve by bare
// name inside the eval'd scope. Module-level constants are NOT carried over
// (only CONTEXT_PRUNER_CONSTANTS is baked), so regexes live inside functions.

/**
 * The first real user turn, verbatim (truncated at the pin budget). Skips
 * harness-injected messages (INSTRUCTIONS_PROMPT / SUBAGENT_SPAWN) and prior
 * conversation summaries.
 */
export function findFirstUserTurnText(messages: Message[]): string | null {
  const firstUserTurnMaxChars = FIRST_USER_TURN_MAX_TOKENS * CHARS_PER_TOKEN
  for (const message of messages) {
    if (message.role !== 'user') continue
    if (message.tags?.includes('INSTRUCTIONS_PROMPT')) continue
    if (message.tags?.includes('SUBAGENT_SPAWN')) continue
    const text = getTextContent(message).trim()
    if (!text || text.includes('<conversation_summary>')) continue
    return pinVerbatim(text, firstUserTurnMaxChars)
  }
  return null
}

/** Keeps the beginning of the text byte-for-byte with a truncation notice. */
export function pinVerbatim(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const kept = text.slice(0, maxChars - 60)
  return `${kept}\n\n[...pinned text truncated — original continuation omitted...]`
}

export function isHarnessMessage(message: Message): boolean {
  return (
    message.tags?.includes('INSTRUCTIONS_PROMPT') === true ||
    message.tags?.includes('SUBAGENT_SPAWN') === true ||
    message.tags?.includes('STEP_PROMPT') === true ||
    // FID-2026-0806-002 Phase 3c: harness-injected knowledge-graph evidence is
    // operational metadata — matches shouldExcludeMessage in main.ts.
    message.tags?.includes('GRAPH_EVIDENCE') === true
  )
}

export interface StructuredSummaryInput {
  /** Full message history (pre-summarization, subagent tags already removed). */
  messages: Message[]
  /** Latest live user request text (verbatim), or null. */
  goalText: string | null
  /** Merged preserved state (P1b) — serialized into the block. */
  preservedState: PreservedState
}

/**
 * Builds the <structured_state>…</structured_state> block that leads the
 * condensed memory. Every required section is present (with an explicit
 * "(none)" marker when this window yielded nothing) so the contract is stable.
 */
export function buildStructuredSummary(input: StructuredSummaryInput): string {
  const { messages, goalText, preservedState } = input

  const standingFacts = buildStandingFacts(messages)
  const decisions = buildDecisions(messages)
  const pendingAsks = buildPendingAsks(messages)
  const identifiers = buildIdentifiers(messages)

  const sections: string[] = [
    standingFacts,
    buildGoalSection(goalText),
    decisions,
    buildFilesSection(preservedState),
    buildTodosSection(preservedState),
    pendingAsks,
    identifiers,
    buildPreservedStateSection(preservedState),
  ]

  let block = sections.join('\n\n')
  if (block.length > STRUCTURED_STATE_MAX_CHARS) {
    // Last-resort shrink: standing facts is the only section large enough to
    // threaten the cap; trim it from the end (later sections, including the
    // preserved-state JSON, stay intact).
    const overflow = block.length - STRUCTURED_STATE_MAX_CHARS
    const trimmed = standingFacts.slice(
      0,
      Math.max(0, standingFacts.length - overflow),
    )
    block = [trimmed, ...sections.slice(1)].join('\n\n')
  }
  return block
}

export function buildStandingFacts(messages: Message[]): string {
  const maxChars = STANDING_FACTS_MAX_TOKENS * CHARS_PER_TOKEN
  const userTurnMaxChars = USER_MESSAGE_LIMIT * CHARS_PER_TOKEN
  const lines: string[] = [
    '<structured_state>',
    '## Standing facts & constraints',
  ]
  const seen = new Set<string>()

  // Collect raw user turns in order, deduplicated by exact text. Dedupe
  // against the RAW text so a later identical turn is not re-added even when
  // the pinned first turn was truncated for the pin budget.
  const userTexts: string[] = []
  for (const message of messages) {
    if (message.role !== 'user') continue
    if (isHarnessMessage(message)) continue
    const text = getTextContent(message).trim()
    if (!text || text.includes('<conversation_summary>')) continue
    if (seen.has(text)) continue
    seen.add(text)
    userTexts.push(text)
  }

  if (userTexts.length === 0) {
    lines.push('(none in this window)')
    return lines.join('\n')
  }

  // P1c: pin the first user turn verbatim (kept head-first at the pin
  // budget). The pin is unconditional — it survives every role budget.
  let usedChars = 0
  const pinned = pinVerbatim(
    userTexts[0],
    FIRST_USER_TURN_MAX_TOKENS * CHARS_PER_TOKEN,
  )
  lines.push(`[pinned first user turn — verbatim]\n${pinned}`)
  usedChars += pinned.length

  // Remaining turns, oldest-first. Policy: when the standing-facts budget is
  // exhausted, the OLDEST facts win — newer turns still live in the Goal
  // section and the budgeted [USER] historical entries, so nothing is lost.
  for (let i = 1; i < userTexts.length; i++) {
    const truncated = truncateLongText(userTexts[i], userTurnMaxChars)
    if (usedChars + truncated.length > maxChars) break
    lines.push(truncated)
    usedChars += truncated.length
  }

  return lines.join('\n')
}

export function buildGoalSection(goalText: string | null): string {
  const lines = ['## Goal']
  if (goalText && goalText.trim()) {
    lines.push(pinVerbatim(goalText.trim(), GOAL_MAX_TOKENS * CHARS_PER_TOKEN))
  } else {
    lines.push('(none in this window)')
  }
  return lines.join('\n')
}

export function buildDecisions(messages: Message[]): string {
  const lines = ['## Decisions & rationale']
  const decisions: string[] = []
  for (
    let i = messages.length - 1;
    i >= 0 && decisions.length < DECISIONS_MAX_ENTRIES;
    i--
  ) {
    const message = messages[i]
    if (message.role !== 'assistant' || !Array.isArray(message.content))
      continue
    for (const part of message.content) {
      if (part.type !== 'text' || typeof part.text !== 'string') continue
      const text = part.text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      if (text) {
        decisions.push(truncateLongText(text, DECISION_MAX_CHARS))
        break
      }
    }
  }
  if (decisions.length === 0) {
    lines.push('(none in this window)')
  } else {
    lines.push(...decisions.map((d) => `- ${d}`))
  }
  return lines.join('\n')
}

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
