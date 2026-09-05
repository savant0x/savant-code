import { describe, it, expect } from 'bun:test'

import { CUSTOM_OPTION_INDEX } from '../constants'

import type { AccordionAnswer } from '../components/accordion-question'

describe('answer state management patterns', () => {
  describe('single-select behavior', () => {
    it('selecting an option clears isCustom flag', () => {
      const previousAnswer: AccordionAnswer = {
        isCustom: true,
        customText: 'Custom text',
      }

      const optionIndex: number = 1
      const isCustomOption = optionIndex === CUSTOM_OPTION_INDEX

      const newAnswer: AccordionAnswer = isCustomOption
        ? {
            selectedIndex: undefined,
            selectedIndices: undefined,
            isCustom: true,
            customText: previousAnswer.customText || '',
          }
        : {
            selectedIndex: optionIndex,
            selectedIndices: undefined,
            isCustom: false,
          }

      expect(newAnswer.selectedIndex).toBe(1)
      expect(newAnswer.isCustom).toBe(false)
    })

    it('selecting CUSTOM clears selectedIndex and enables isCustom', () => {
      const previousAnswer: AccordionAnswer = {
        selectedIndex: 1,
      }

      const optionIndex = CUSTOM_OPTION_INDEX
      const isCustomOption = optionIndex === CUSTOM_OPTION_INDEX

      const newAnswer: AccordionAnswer = isCustomOption
        ? {
            selectedIndex: undefined,
            selectedIndices: undefined,
            isCustom: true,
            customText: previousAnswer.customText || '',
          }
        : {
            selectedIndex: optionIndex,
            selectedIndices: undefined,
            isCustom: false,
          }

      expect(newAnswer.selectedIndex).toBeUndefined()
      expect(newAnswer.isCustom).toBe(true)
    })
  })

  describe('multi-select behavior', () => {
    it('toggling adds option to selectedIndices', () => {
      const currentAnswer: AccordionAnswer = {
        selectedIndices: new Set([0]),
      }

      const optionIndex = 2
      const newIndices = new Set(currentAnswer.selectedIndices)
      if (newIndices.has(optionIndex)) {
        newIndices.delete(optionIndex)
      } else {
        newIndices.add(optionIndex)
      }

      expect(newIndices.has(0)).toBe(true)
      expect(newIndices.has(2)).toBe(true)
      expect(newIndices.size).toBe(2)
    })

    it('toggling removes option if already selected', () => {
      const currentAnswer: AccordionAnswer = {
        selectedIndices: new Set([0, 1, 2]),
      }

      const optionIndex = 1
      const newIndices = new Set(currentAnswer.selectedIndices)
      if (newIndices.has(optionIndex)) {
        newIndices.delete(optionIndex)
      } else {
        newIndices.add(optionIndex)
      }

      expect(newIndices.has(0)).toBe(true)
      expect(newIndices.has(1)).toBe(false)
      expect(newIndices.has(2)).toBe(true)
      expect(newIndices.size).toBe(2)
    })

    it('toggling CUSTOM toggles isCustom flag', () => {
      const currentAnswer: AccordionAnswer = {
        selectedIndices: new Set([0]),
        isCustom: false,
      }

      const optionIndex = CUSTOM_OPTION_INDEX
      const toggledCustomOn =
        optionIndex === CUSTOM_OPTION_INDEX && !currentAnswer.isCustom

      expect(toggledCustomOn).toBe(true)
    })
  })
})

describe('navigation edge cases', () => {
  it('clamps question index to valid range', () => {
    const questionsLength = 3
    const focusedQuestionIndex = 5

    const currentQuestionIndex = Math.min(
      Math.max(focusedQuestionIndex, 0),
      questionsLength - 1,
    )

    expect(currentQuestionIndex).toBe(2)
  })

  it('clamps negative question index to 0', () => {
    const questionsLength = 3
    const focusedQuestionIndex = -1

    const currentQuestionIndex = Math.min(
      Math.max(focusedQuestionIndex, 0),
      questionsLength - 1,
    )

    expect(currentQuestionIndex).toBe(0)
  })

  it('clamps option index to valid range', () => {
    const optionCount = 4
    const focusedOptionIndex = 10

    const lastOptionIndex = Math.max(optionCount - 1, 0)
    const currentOptionIndex = Math.min(
      Math.max(focusedOptionIndex, 0),
      lastOptionIndex,
    )

    expect(currentOptionIndex).toBe(3)
  })

  it('handles empty questions array', () => {
    const questionsLength = 0
    const expandedIndex = questionsLength > 0 ? 0 : null
    const focusedOptionIndex = questionsLength > 0 ? 0 : null

    expect(expandedIndex).toBeNull()
    expect(focusedOptionIndex).toBeNull()
  })
})
