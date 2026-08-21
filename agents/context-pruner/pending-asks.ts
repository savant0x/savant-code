import { PENDING_ASK_MAX_CHARS, PENDING_ASKS_MAX } from './constants'
import { asObject, asQuestionList, truncateLongText } from './helpers'

import type { Message } from '../types/util-types'

export function buildPendingAsks(messages: Message[]): string {
  const lines = ['## Pending user asks']
  let askIndex = -1
  const askQuestions: string[] = []

  outer: for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role !== 'assistant' || !Array.isArray(message.content))
      continue
    for (const part of message.content) {
      if (part.type !== 'tool-call') continue
      if (part.toolName !== 'ask_user') continue
      const input = asObject(part.input) ?? {}
      const questions = asQuestionList(input.questions) ?? []
      for (const q of questions) {
        if (askQuestions.length >= PENDING_ASKS_MAX) break
        askQuestions.push(truncateLongText(q.question, PENDING_ASK_MAX_CHARS))
      }
      askIndex = i
      break outer
    }
  }

  // If the newest ask_user call was already answered by a subsequent tool
  // result, the asks are not pending.
  const answered =
    askIndex !== -1 &&
    messages.slice(askIndex + 1).some((m) => {
      if (m.role !== 'tool' || m.toolName !== 'ask_user') return false
      return (
        Array.isArray(m.content) &&
        m.content.some((part) => {
          if (part.type !== 'json') return false
          const value = asObject(part.value)
          return value !== undefined && 'answers' in value
        })
      )
    })

  if (answered || askQuestions.length === 0) {
    lines.push('(none)')
  } else {
    lines.push(...askQuestions.map((q) => `- ${q}`))
  }
  return lines.join('\n')
}
