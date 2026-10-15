import { useKeyboard } from '@opentui/react'
import { useCallback } from 'react'

import { CUSTOM_OPTION_INDEX } from './constants'
import { isPlainEnterKey } from '../../utils/terminal-enter-detection'

import type { AskUserQuestion } from '../../types/store'
import type { KeyEvent } from '@opentui/core'

/** Keyboard navigation for the multiple-choice form: Tab moves to Submit,
 *  arrows walk questions/options, Enter/Space selects, Esc/Ctrl+C skips. */
export function useMultipleChoiceFormKeyboard(opts: {
  questions: AskUserQuestion[]
  expandedIndex: number | null
  focusedQuestionIndex: number
  focusedOptionIndex: number | null
  submitFocused: boolean
  lastFocusBeforeSubmit: {
    questionIndex: number
    optionIndex: number
  } | null
  isTypingCustom: boolean
  showFocusHighlight: boolean
  setShowFocusHighlight: (show: boolean) => void
  setSubmitFocused: (focused: boolean) => void
  setIsTypingCustom: (typing: boolean) => void
  setFocusedQuestionIndex: (index: number) => void
  setFocusedOptionIndex: (index: number | null) => void
  setExpandedIndex: (index: number | null) => void
  openQuestion: (questionIndex: number, optionIndex: number) => void
  focusSubmit: (from?: { questionIndex: number; optionIndex: number }) => void
  handleSelectOption: (
    questionIndex: number,
    optionIndex: number,
    source?: 'keyboard' | 'mouse',
  ) => void
  handleToggleOption: (questionIndex: number, optionIndex: number) => void
  handleSubmit: () => void
  onSkip: () => void
}): void {
  const {
    questions,
    expandedIndex,
    focusedQuestionIndex,
    focusedOptionIndex,
    submitFocused,
    lastFocusBeforeSubmit,
    isTypingCustom,
    showFocusHighlight,
    setShowFocusHighlight,
    setSubmitFocused,
    setIsTypingCustom,
    setFocusedQuestionIndex,
    setFocusedOptionIndex,
    setExpandedIndex,
    openQuestion,
    focusSubmit,
    handleSelectOption,
    handleToggleOption,
    handleSubmit,
    onSkip,
  } = opts
  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        // Helper to prevent default behavior
        const preventDefault = () => {
          if (
            'preventDefault' in key &&
            typeof key.preventDefault === 'function'
          ) {
            key.preventDefault()
          }
        }

        // Escape or Ctrl+C to skip/close the form
        if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
          preventDefault()
          onSkip()
          return
        }

        if (!showFocusHighlight) {
          setShowFocusHighlight(true)
        }

        // Handle submit button focus
        if (submitFocused) {
          if (key.name === 'up' || (key.name === 'tab' && key.shift)) {
            preventDefault()
            setIsTypingCustom(false)
            setSubmitFocused(false)
            if (questions.length === 0) return
            if (lastFocusBeforeSubmit) {
              openQuestion(
                lastFocusBeforeSubmit.questionIndex,
                lastFocusBeforeSubmit.optionIndex,
              )
            } else {
              openQuestion(questions.length - 1, 0)
            }
            return
          }
          if (isPlainEnterKey(key) || key.name === 'space') {
            preventDefault()
            handleSubmit()
            return
          }
          return
        }

        if (key.name === 'tab' && !key.shift) {
          preventDefault()
          focusSubmit()
          return
        }

        // When typing in "Custom" input, let MultilineInput handle all keyboard input
        if (isTypingCustom) {
          return
        }

        if (questions.length === 0) {
          return
        }

        const currentQuestionIndex = Math.min(
          Math.max(focusedQuestionIndex, 0),
          questions.length - 1,
        )
        const currentQuestion = questions[currentQuestionIndex]
        const optionCount = currentQuestion.options.length + 1
        const lastOptionIndex = optionCount - 1
        const currentOptionIndex = Math.min(
          Math.max(focusedOptionIndex ?? 0, 0),
          lastOptionIndex,
        )

        if (key.name === 'right') {
          preventDefault()
          if (expandedIndex !== currentQuestionIndex) {
            openQuestion(currentQuestionIndex, 0)
          }
          return
        }

        if (key.name === 'left') {
          preventDefault()
          if (expandedIndex !== null) {
            setExpandedIndex(null)
            setFocusedOptionIndex(null)
          }
          return
        }

        if (key.name === 'down') {
          preventDefault()

          if (expandedIndex === null) {
            openQuestion(currentQuestionIndex, 0)
            return
          }

          if (currentOptionIndex < lastOptionIndex) {
            setFocusedOptionIndex(currentOptionIndex + 1)
            return
          }

          if (currentQuestionIndex < questions.length - 1) {
            openQuestion(currentQuestionIndex + 1, 0)
            return
          }

          focusSubmit({
            questionIndex: currentQuestionIndex,
            optionIndex: currentOptionIndex,
          })
          return
        }

        if (key.name === 'up') {
          preventDefault()

          if (expandedIndex === null) {
            if (currentQuestionIndex > 0) {
              const previousQuestionIndex = currentQuestionIndex - 1
              const previousOptionCount =
                (questions[previousQuestionIndex]?.options.length ?? 0) + 1
              openQuestion(previousQuestionIndex, previousOptionCount - 1)
            }
            return
          }

          if (currentOptionIndex > 0) {
            setFocusedOptionIndex(currentOptionIndex - 1)
            return
          }

          if (currentQuestionIndex > 0) {
            const previousQuestionIndex = currentQuestionIndex - 1
            const previousOptionCount =
              (questions[previousQuestionIndex]?.options.length ?? 0) + 1
            openQuestion(previousQuestionIndex, previousOptionCount - 1)
          }
          return
        }

        if (isPlainEnterKey(key) || key.name === 'space') {
          preventDefault()

          if (expandedIndex === null) {
            openQuestion(currentQuestionIndex, 0)
            return
          }

          const optionIdx =
            currentOptionIndex === lastOptionIndex
              ? CUSTOM_OPTION_INDEX
              : currentOptionIndex
          if (currentQuestion.multiSelect) {
            handleToggleOption(currentQuestionIndex, optionIdx)
          } else {
            handleSelectOption(currentQuestionIndex, optionIdx, 'keyboard')
          }
          return
        }
      },
      [
        questions,
        expandedIndex,
        focusedQuestionIndex,
        focusedOptionIndex,
        submitFocused,
        lastFocusBeforeSubmit,
        isTypingCustom,
        showFocusHighlight,
        setShowFocusHighlight,
        setSubmitFocused,
        setIsTypingCustom,
        setFocusedQuestionIndex,
        setFocusedOptionIndex,
        setExpandedIndex,
        openQuestion,
        focusSubmit,
        handleSelectOption,
        handleToggleOption,
        handleSubmit,
        onSkip,
      ],
    ),
  )
}
