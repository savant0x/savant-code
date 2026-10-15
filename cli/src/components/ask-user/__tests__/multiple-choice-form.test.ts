/**
 * Integration tests for MultipleChoiceForm component logic
 *
 * NOTE: Due to React 19 + Bun + OpenTUI compatibility issues, we test the component's
 * core logic in isolation rather than rendering the full component.
 * See cli/knowledge.md for details on the testing constraints.
 */

import { describe, it, expect } from 'bun:test'

import { getOptionLabel, CUSTOM_OPTION_INDEX } from '../constants'

import type { AccordionAnswer } from '../components/accordion-question'
import type { AskUserOption } from '../constants'

/** Question type - mirrors AskUserQuestion from chat-store */
interface TestQuestion {
  question: string
  options: AskUserOption[]
  multiSelect?: boolean
}

/**
 * Format answer for submission (mirrors component logic)
 */
function formatAnswer(
  question: TestQuestion,
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

describe('getOptionLabel', () => {
  it('extracts label from string option', () => {
    expect(getOptionLabel('Option A')).toBe('Option A')
  })

  it('extracts label from object option', () => {
    expect(
      getOptionLabel({ label: 'Option B', description: 'Description' }),
    ).toBe('Option B')
  })

  it('extracts label from object option without description', () => {
    expect(getOptionLabel({ label: 'Option C' })).toBe('Option C')
  })

  it('returns empty string for null-ish label', () => {
    expect(getOptionLabel({ label: '' })).toBe('')
  })
})

describe('formatAnswer', () => {
  const singleSelectQuestion: TestQuestion = {
    question: 'What is your favorite color?',
    options: ['Red', 'Blue', 'Green'],
    multiSelect: false,
  }

  const multiSelectQuestion: TestQuestion = {
    question: 'Select your hobbies',
    options: ['Reading', 'Gaming', 'Sports'],
    multiSelect: true,
  }

  const objectOptionsQuestion: TestQuestion = {
    question: 'Choose a plan',
    options: [
      { label: 'Basic', description: '$10/month' },
      { label: 'Pro', description: '$20/month' },
    ],
    multiSelect: false,
  }

  describe('single-select questions', () => {
    it('returns Skipped when no answer provided', () => {
      const result = formatAnswer(singleSelectQuestion, undefined)
      expect(result).toEqual({
        question: 'What is your favorite color?',
        answer: 'Skipped',
      })
    })

    it('returns Skipped when answer is empty object', () => {
      const result = formatAnswer(singleSelectQuestion, {})
      expect(result).toEqual({
        question: 'What is your favorite color?',
        answer: 'Skipped',
      })
    })

    it('returns selected option label', () => {
      const answer: AccordionAnswer = { selectedIndex: 1 }
      const result = formatAnswer(singleSelectQuestion, answer)
      expect(result).toEqual({
        question: 'What is your favorite color?',
        answer: 'Blue',
      })
    })

    it('returns first option when index is 0', () => {
      const answer: AccordionAnswer = { selectedIndex: 0 }
      const result = formatAnswer(singleSelectQuestion, answer)
      expect(result).toEqual({
        question: 'What is your favorite color?',
        answer: 'Red',
      })
    })

    it('returns custom text when isCustom is true', () => {
      const answer: AccordionAnswer = {
        isCustom: true,
        customText: 'Purple',
      }
      const result = formatAnswer(singleSelectQuestion, answer)
      expect(result).toEqual({
        question: 'What is your favorite color?',
        answer: 'Purple',
      })
    })

    it('trims whitespace from custom text', () => {
      const answer: AccordionAnswer = {
        isCustom: true,
        customText: '  Purple  ',
      }
      const result = formatAnswer(singleSelectQuestion, answer)
      expect(result).toEqual({
        question: 'What is your favorite color?',
        answer: 'Purple',
      })
    })

    it('returns Skipped when isCustom is true but text is empty', () => {
      const answer: AccordionAnswer = {
        isCustom: true,
        customText: '',
      }
      const result = formatAnswer(singleSelectQuestion, answer)
      expect(result).toEqual({
        question: 'What is your favorite color?',
        answer: 'Skipped',
      })
    })

    it('returns Skipped when isCustom is true but text is only whitespace', () => {
      const answer: AccordionAnswer = {
        isCustom: true,
        customText: '   ',
      }
      const result = formatAnswer(singleSelectQuestion, answer)
      expect(result).toEqual({
        question: 'What is your favorite color?',
        answer: 'Skipped',
      })
    })
  })

  describe('multi-select questions', () => {
    it('returns Skipped when no selections', () => {
      const answer: AccordionAnswer = { selectedIndices: new Set() }
      const result = formatAnswer(multiSelectQuestion, answer)
      expect(result).toEqual({
        question: 'Select your hobbies',
        answer: 'Skipped',
      })
    })

    it('returns single selection', () => {
      const answer: AccordionAnswer = { selectedIndices: new Set([0]) }
      const result = formatAnswer(multiSelectQuestion, answer)
      expect(result).toEqual({
        question: 'Select your hobbies',
        answer: 'Reading',
      })
    })

    it('returns multiple selections joined by comma', () => {
      const answer: AccordionAnswer = { selectedIndices: new Set([0, 2]) }
      const result = formatAnswer(multiSelectQuestion, answer)
      expect(result).toEqual({
        question: 'Select your hobbies',
        answer: 'Reading, Sports',
      })
    })

    it('returns all selections when all selected', () => {
      const answer: AccordionAnswer = { selectedIndices: new Set([0, 1, 2]) }
      const result = formatAnswer(multiSelectQuestion, answer)
      expect(result).toEqual({
        question: 'Select your hobbies',
        answer: 'Reading, Gaming, Sports',
      })
    })

    it('includes custom text with selections', () => {
      const answer: AccordionAnswer = {
        selectedIndices: new Set([0]),
        isCustom: true,
        customText: 'Cooking',
      }
      const result = formatAnswer(multiSelectQuestion, answer)
      expect(result).toEqual({
        question: 'Select your hobbies',
        answer: 'Reading, Cooking',
      })
    })

    it('returns only custom text when no other selections', () => {
      const answer: AccordionAnswer = {
        selectedIndices: new Set(),
        isCustom: true,
        customText: 'Cooking',
      }
      const result = formatAnswer(multiSelectQuestion, answer)
      expect(result).toEqual({
        question: 'Select your hobbies',
        answer: 'Cooking',
      })
    })
  })

  describe('object options', () => {
    it('extracts label from object options', () => {
      const answer: AccordionAnswer = { selectedIndex: 0 }
      const result = formatAnswer(objectOptionsQuestion, answer)
      expect(result).toEqual({
        question: 'Choose a plan',
        answer: 'Basic',
      })
    })

    it('works with second object option', () => {
      const answer: AccordionAnswer = { selectedIndex: 1 }
      const result = formatAnswer(objectOptionsQuestion, answer)
      expect(result).toEqual({
        question: 'Choose a plan',
        answer: 'Pro',
      })
    })
  })
})

describe('CUSTOM_OPTION_INDEX constant', () => {
  it('is -1 for identifying custom option', () => {
    expect(CUSTOM_OPTION_INDEX).toBe(-1)
  })

  it('is distinct from valid option indices', () => {
    expect(CUSTOM_OPTION_INDEX).toBeLessThan(0)
  })
})
