/**
 * Phase 1 of the context-pruner: summarize ALL messages into role-tagged
 * entries (extracted verbatim from the original in-body implementation).
 * Embedded into the generated self-contained source via .toString() at
 * factory time.
 */
import {
  ASSISTANT_MESSAGE_LIMIT,
  CHARS_PER_TOKEN,
  SPAWN_AGENTS_OUTPUT_BLACKLIST,
  TOOL_ENTRY_LIMIT,
  USER_MESSAGE_LIMIT,
} from './constants'
import {
  asAgentResultList,
  asAnswerList,
  asNumber,
  asObject,
  getTextContent,
  truncateLongText,
} from './helpers'
import { buildResultDigest } from './result-digests'
import { summarizeToolCall } from './summarize-tool-call'

import type {
  FilePart,
  ImagePart,
  Message,
  ToolMessage,
} from '../types/util-types'

export type SummaryEntry = {
  role: 'user' | 'assistant_tool'
  parts: string[]
}

export function summarizeMessages(
  messagesToSummarize: Message[],
  latestLiveUserPromptMessage: Message | null,
  digestCaps?: { headChars?: number; tailChars?: number },
): { entries: SummaryEntry[]; liveUserPromptEntry: SummaryEntry | undefined } {
  // Phase 1: Summarize ALL messages into tagged entries
  const summarizedEntries: SummaryEntry[] = []
  let liveUserPromptEntry: SummaryEntry | undefined

  for (const message of messagesToSummarize) {
    if (message.role === 'user') {
      let text = getTextContent(message).trim()
      if (text) {
        text = truncateLongText(text, USER_MESSAGE_LIMIT * CHARS_PER_TOKEN)
        let hasImages = false
        if (Array.isArray(message.content)) {
          hasImages = message.content.some(
            (part): part is ImagePart | FilePart =>
              part.type === 'image' || part.type === 'file',
          )
        }
        const imageNote = hasImages ? ' [image(s) were attached]' : ''
        const entry: SummaryEntry = {
          role: 'user',
          parts: [`[USER]${imageNote}\n${text}`],
        }
        if (message === latestLiveUserPromptMessage) {
          liveUserPromptEntry = entry
        }
        summarizedEntries.push(entry)
      }
    } else if (message.role === 'assistant') {
      const textParts: string[] = []
      const toolSummaries: string[] = []

      if (Array.isArray(message.content)) {
        for (const part of message.content) {
          if (part.type === 'text' && typeof part.text === 'string') {
            const textWithoutThinkTags = part.text
              .replace(/<think>[\s\S]*?<\/think>/g, '')
              .trim()
            if (textWithoutThinkTags) {
              textParts.push(textWithoutThinkTags)
            }
          } else if (part.type === 'tool-call') {
            const toolName = part.toolName
            const input = asObject(part.input) ?? {}
            toolSummaries.push(summarizeToolCall(toolName, input))
          }
        }
      }

      const parts: string[] = []
      if (textParts.length > 0) {
        let combinedText = textParts.join('\n')
        combinedText = truncateLongText(
          combinedText,
          ASSISTANT_MESSAGE_LIMIT * CHARS_PER_TOKEN,
        )
        parts.push(`Progress note:\n${combinedText}`)
      }
      if (toolSummaries.length > 0) {
        parts.push(toolSummaries.join('\n'))
      }

      if (parts.length > 0) {
        summarizedEntries.push({
          role: 'assistant_tool',
          parts,
        })
      }
    } else if (message.role === 'tool') {
      const toolMessage: ToolMessage = message
      const entryParts: string[] = []

      if (Array.isArray(toolMessage.content)) {
        for (const part of toolMessage.content) {
          if (part.type === 'json' && part.value) {
            const value = asObject(part.value)
            if (!value) continue

            if (value.errorMessage || value.error) {
              let errorText = String(value.errorMessage || value.error)
              if (errorText.length > 100) {
                errorText = errorText.slice(0, 100) + '...'
              }
              entryParts.push(
                `Tool error from ${toolMessage.toolName}: ${errorText}`,
              )
            }

            if (
              toolMessage.toolName === 'run_terminal_command' &&
              'exitCode' in value
            ) {
              const exitCode = asNumber(value.exitCode)
              if (exitCode !== 0) {
                entryParts.push(`Command failed with exit code: ${exitCode}`)
              }
            }

            if (toolMessage.toolName === 'ask_user') {
              if (value.skipped) {
                entryParts.push('User skipped question')
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
                  entryParts.push(`User answered: ${truncated}`)
                }
              }
            }

            if (
              toolMessage.toolName === 'str_replace' ||
              toolMessage.toolName === 'propose_str_replace' ||
              toolMessage.toolName === 'write_file' ||
              toolMessage.toolName === 'propose_write_file'
            ) {
              const resultStr = JSON.stringify(value)
              const truncatedResult =
                resultStr.length > 2000
                  ? resultStr.slice(0, 2000) + '...'
                  : resultStr
              entryParts.push(
                `Edit result from ${toolMessage.toolName}:\n${truncatedResult}`,
              )
            }
          }
        }
      }

      if (
        toolMessage.toolName === 'spawn_agents' &&
        Array.isArray(toolMessage.content)
      ) {
        for (const part of toolMessage.content) {
          if (part.type === 'json' && Array.isArray(part.value)) {
            const agentResults = asAgentResultList(part.value)
            if (!agentResults) continue
            const includedResults = agentResults.filter(
              (r) =>
                r.agentType &&
                !SPAWN_AGENTS_OUTPUT_BLACKLIST.includes(r.agentType),
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
                  if (
                    outputStr.length >
                    ASSISTANT_MESSAGE_LIMIT * CHARS_PER_TOKEN
                  ) {
                    outputStr =
                      outputStr.slice(
                        0,
                        ASSISTANT_MESSAGE_LIMIT * CHARS_PER_TOKEN,
                      ) + '...'
                  }
                }
                return `- ${r.agentType}: ${outputStr || '(no output)'}`
              })
              entryParts.push(`Agent results:\n${resultSummaries.join('\n')}`)
            }
          }
        }
      }

      // FID-2026-0824-024 preservation contract: a tool result matching no
      // special case above still contributes a bounded digest — never silence.
      if (entryParts.length === 0) {
        const digest = buildResultDigest(
          toolMessage.toolName,
          toolMessage.content,
          digestCaps,
        )
        if (digest !== null) {
          entryParts.push(digest)
        }
      }

      if (entryParts.length > 0) {
        const joinedToolEntry = truncateLongText(
          entryParts.join('\n\n'),
          TOOL_ENTRY_LIMIT * CHARS_PER_TOKEN,
        )
        summarizedEntries.push({
          role: 'assistant_tool',
          parts: [joinedToolEntry],
        })
      }
    }
  }

  return { entries: summarizedEntries, liveUserPromptEntry }
}
