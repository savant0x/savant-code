/**
 * Ask User Tool - Multiple choice form with accordion-style FAQ layout
 *
 * Shows all questions at once, each expandable to reveal options.
 *
 * State + handlers live in `use-form-state.ts` and keyboard navigation in
 * `use-keyboard.ts`; this file is the render shell.
 */

import { TextAttributes } from '@opentui/core'
import React from 'react'

import { AccordionQuestion } from './components/accordion-question'
import { KEYBOARD_HINTS } from './constants'
import { useMultipleChoiceFormState } from './use-form-state'
import { useMultipleChoiceFormKeyboard } from './use-keyboard'
import { useTheme } from '../../hooks/use-theme'
import { BORDER_CHARS } from '../../utils/ui-constants'
import { Button } from '../button'

import type { AskUserQuestion } from '../../types/store'

export interface MultipleChoiceFormProps {
  questions: AskUserQuestion[]
  onSubmit: (answers: { question: string; answer: string }[]) => void
  onSkip: () => void
}

export const MultipleChoiceForm: React.FC<MultipleChoiceFormProps> = ({
  questions,
  onSubmit,
  onSkip,
}) => {
  const theme = useTheme()
  const form = useMultipleChoiceFormState({ questions, onSubmit })

  useMultipleChoiceFormKeyboard({
    questions,
    expandedIndex: form.expandedIndex,
    focusedQuestionIndex: form.focusedQuestionIndex,
    focusedOptionIndex: form.focusedOptionIndex,
    submitFocused: form.submitFocused,
    lastFocusBeforeSubmit: form.lastFocusBeforeSubmit,
    isTypingCustom: form.isTypingCustom,
    showFocusHighlight: form.showFocusHighlight,
    setShowFocusHighlight: form.setShowFocusHighlight,
    setSubmitFocused: form.setSubmitFocused,
    setIsTypingCustom: form.setIsTypingCustom,
    setFocusedQuestionIndex: form.setFocusedQuestionIndex,
    setFocusedOptionIndex: form.setFocusedOptionIndex,
    setExpandedIndex: form.setExpandedIndex,
    openQuestion: form.openQuestion,
    focusSubmit: form.focusSubmit,
    handleSelectOption: form.handleSelectOption,
    handleToggleOption: form.handleToggleOption,
    handleSubmit: form.handleSubmit,
    onSkip,
  })

  return (
    <box style={{ flexDirection: 'column', padding: 0, width: '100%' }}>
      {/* Close button in top-right */}
      <box
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          marginBottom: 1,
          width: '100%',
        }}
      >
        <Button
          onClick={onSkip}
          style={{
            padding: 0,
          }}
        >
          <text style={{ fg: theme.muted }}>Close ✕</text>
        </Button>
      </box>

      {/* All questions in accordion style */}
      {questions.map((question, index) => (
        <AccordionQuestion
          key={index}
          question={question}
          questionIndex={index}
          totalQuestions={questions.length}
          answer={form.answers.get(index)}
          isExpanded={form.expandedIndex === index}
          isTypingCustom={form.isTypingCustom && form.expandedIndex === index}
          onToggleExpand={() => {
            const nextExpandedIndex =
              form.expandedIndex === index ? null : index
            form.setExpandedIndex(nextExpandedIndex)
            form.setFocusedQuestionIndex(index)
            form.setSubmitFocused(false)
            form.setIsTypingCustom(false)
            form.setFocusedOptionIndex(nextExpandedIndex === null ? null : 0)
          }}
          onSelectOption={(optionIndex) =>
            form.handleSelectOption(index, optionIndex, 'mouse')
          }
          onToggleOption={(optionIndex) =>
            form.handleToggleOption(index, optionIndex)
          }
          onSetCustomText={(text, cursorPos) =>
            form.handleSetCustomText(index, text, cursorPos)
          }
          onCustomSubmit={() => form.handleCustomSubmit(index)}
          customCursorPosition={form.customCursorPositions.get(index) ?? 0}
          focusedOptionIndex={
            form.expandedIndex === index &&
            !form.submitFocused &&
            form.showFocusHighlight
              ? form.focusedOptionIndex
              : null
          }
          onFocusOption={(optionIndex) => {
            if (!form.terminalFocused || form.isTypingCustom) return
            if (form.suppressNextHoverFocusRef.current) {
              form.suppressNextHoverFocusRef.current = false
              return
            }
            form.setShowFocusHighlight(true)
            form.setSubmitFocused(false)
            form.setFocusedQuestionIndex(index)
            if (form.expandedIndex !== index) {
              form.setExpandedIndex(index)
            }
            form.setFocusedOptionIndex(optionIndex)
          }}
        />
      ))}

      {/* Footer: submit + keyboard hints */}
      <box
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-start',
          alignItems: 'center',
          width: '100%',
          gap: 4,
        }}
      >
        <box style={{ flexShrink: 0 }}>
          <Button
            onClick={form.handleSubmit}
            onMouseOver={() => {
              if (!form.terminalFocused) return
              form.setSubmitHovered(true)
            }}
            onMouseOut={() => {
              form.setSubmitHovered(false)
            }}
            style={{
              borderStyle: 'single',
              borderColor:
                form.submitFocused ||
                (form.submitHovered && form.terminalFocused)
                  ? theme.primary
                  : theme.muted,
              paddingLeft: 2,
              paddingRight: 2,
            }}
            customBorderChars={BORDER_CHARS}
          >
            <text
              style={{
                fg:
                  form.submitFocused ||
                  (form.submitHovered && form.terminalFocused)
                    ? theme.primary
                    : theme.muted,
                attributes:
                  form.submitFocused ||
                  (form.submitHovered && form.terminalFocused)
                    ? TextAttributes.BOLD
                    : undefined,
              }}
            >
              Submit
            </text>
          </Button>
        </box>

        <box
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            flexShrink: 1,
            minWidth: 0,
          }}
        >
          {KEYBOARD_HINTS.map((hint, idx) => (
            <text
              key={hint}
              wrapMode="none"
              style={{
                fg: theme.muted,
                marginRight: idx === KEYBOARD_HINTS.length - 1 ? 0 : 1,
              }}
            >
              {hint}
            </text>
          ))}
        </box>
      </box>
    </box>
  )
}
