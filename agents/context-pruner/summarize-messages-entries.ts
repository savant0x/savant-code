/**
 * Per-entry transcriber branches for the context-pruner summarizer
 * (FID-2026-0915-002 row 8; extracted move-only from summarize-messages.ts,
 * Batch B embeddedHelpers pattern). These are the tool-message special-case
 * blocks — ask_user answers, edit results, spawn_agents results — as sibling
 * pure functions; the user/assistant branches stay inline in
 * summarize-messages.ts (they interleave loop-control `continue`s, so no
 * clean branch boundary exists there — Loop 4 finding).
 *
 * Each transcriber returns the strings the caller pushes onto the entry
 * parts — byte-identical output to the original inline blocks, pinned by the
 * phase-1 suites and the serialization tests.
 *
 * Pure functions — embedded via .toString() at factory time. Constants are
 * baked into the generated scope by handle-steps.ts. Embedded scope: call
 * sites resolve by bare name.
 */
import {
  ASSISTANT_MESSAGE_LIMIT,
  CHARS_PER_TOKEN,
  SPAWN_AGENTS_OUTPUT_BLACKLIST,
} from './constants'
import { asAgentResultList, asAnswerList } from './helpers'

import type { JSONValue, ToolMessage } from '../types/util-types'

// NOTE: every function here must be exported — the module is embedded into the
// generated handleSteps source via .toString() and functions resolve by bare
// name inside the eval'd scope. Module-level constants are NOT carried over
// (only CONTEXT_PRUNER_CONSTANTS is baked), so regexes live inside functions.

type ToolResultValue = Record<string, JSONValue>

/** ask_user tool result → zero or one entry strings (verbatim block move). */
export function transcribeAskUserAnswers(value: ToolResultValue): string[] {
  if (value.skipped) {
    return ['User skipped question']
  } else if ('answers' in value) {
    const answers = asAnswerList(value.answers)
    if (answers && answers.length > 0) {
      const answerTexts = answers
        .map((a) => {
          if (a.otherText) return a.otherText
          if (a.selectedOptions) return a.selectedOptions.join(', ')
          if (a.selectedOption) return a.selectedOption
          return '(no answer)'
        })
        .join('; ')
      const truncated =
        answerTexts.length > 10_000
          ? answerTexts.slice(0, 10_000) + '...'
          : answerTexts
      return [`User answered: ${truncated}`]
    }
  }
  return []
}

/** Edit-family tool results → the bounded `Edit result from …` string. */
export function transcribeEditResult(
  toolName: ToolMessage['toolName'],
  value: ToolResultValue,
): string[] {
  const resultStr = JSON.stringify(value)
  const truncatedResult =
    resultStr.length > 2000 ? resultStr.slice(0, 2000) + '...' : resultStr
  return [`Edit result from ${toolName}:\n${truncatedResult}`]
}

/** spawn_agents tool result → the blacklisted-filtered `Agent results:` block. */
export function transcribeSpawnAgentsResults(
  toolMessage: ToolMessage,
): string[] {
  const parts: string[] = []
  if (!Array.isArray(toolMessage.content)) return parts
  for (const part of toolMessage.content) {
    if (part.type === 'json' && Array.isArray(part.value)) {
      const agentResults = asAgentResultList(part.value)
      if (!agentResults) continue
      const includedResults = agentResults.filter(
        (r) =>
          r.agentType && !SPAWN_AGENTS_OUTPUT_BLACKLIST.includes(r.agentType),
      )
      if (includedResults.length > 0) {
        const resultSummaries = includedResults.map((r) => {
          let outputStr = ''
          if (r.value?.value !== undefined && r.value?.value !== null) {
            if (typeof r.value.value === 'string') {
              outputStr = r.value.value
            } else {
              outputStr = JSON.stringify(r.value.value)
            }
            outputStr = outputStr
              .replace(/<think>[\s\S]*?<\/think>/g, '')
              .trim()
            if (outputStr.length > ASSISTANT_MESSAGE_LIMIT * CHARS_PER_TOKEN) {
              outputStr =
                outputStr.slice(0, ASSISTANT_MESSAGE_LIMIT * CHARS_PER_TOKEN) +
                '...'
            }
          }
          return `- ${r.agentType}: ${outputStr || '(no output)'}`
        })
        parts.push(`Agent results:\n${resultSummaries.join('\n')}`)
      }
    }
  }
  return parts
}
