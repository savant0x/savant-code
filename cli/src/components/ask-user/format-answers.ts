import { getOptionLabel } from './constants'

import type { AccordionAnswer } from './components/accordion-question'
import type { AskUserQuestion } from '../../types/store'

/** Formats a single question/answer pair for submission. */
export function formatAnswer(
  question: AskUserQuestion,
  answer: AccordionAnswer | undefined,
): { question: string; answer: string } {
  if (!answer) {
    return { question: question.question, answer: 'Skipped' }
  }

  const selectedOptions = question.multiSelect
    ? Array.from(answer.selectedIndices ?? [])
        .map((idx) => getOptionLabel(question.options[idx]))
        .filter(Boolean)
    : answer.selectedIndex !== undefined
      ? [getOptionLabel(question.options[answer.selectedIndex])]
      : []

  const customText =
    answer.isCustom && (answer.customText?.trim().length ?? 0) > 0
      ? (answer.customText ?? '').trim()
      : ''

  const parts = customText ? [...selectedOptions, customText] : selectedOptions
  if (parts.length === 0) {
    return { question: question.question, answer: 'Skipped' }
  }

  return {
    question: question.question,
    answer: question.multiSelect ? parts.join(', ') : parts[0],
  }
}

/** Formats every question/answer pair in submission order. */
export function formatFormAnswers(
  questions: AskUserQuestion[],
  answers: Map<number, AccordionAnswer>,
): { question: string; answer: string }[] {
  return questions.map((question, index) =>
    formatAnswer(question, answers.get(index)),
  )
}
