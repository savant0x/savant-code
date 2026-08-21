import React from 'react'

import { MultipleChoiceForm } from './ask-user'
import { useAskUserBridge } from '../hooks/use-ask-user-bridge'
import { useChatStore } from '../state/chat-store'
import { BORDER_CHARS } from '../utils/ui-constants'

import type { Theme } from './chat-input-bar-types'

interface ChatInputAskUserFormProps {
  theme: Theme
  onInterruptStream: () => void
}

/**
 * The ask-user branch of the chat input bar: renders the multiple-choice
 * form for the pending ask-user bridge state and converts accordion-style
 * answers into the bridge contract (FID-2026-0819-005 Loop 137).
 */
export const ChatInputAskUserForm = ({
  theme,
  onInterruptStream,
}: ChatInputAskUserFormProps) => {
  const askUserState = useChatStore((state) => state.askUserState)
  const { submitAnswers, skip } = useAskUserBridge()
  const [askUserTitle] = React.useState('Some questions for you')

  const handleFormSubmit = (
    answers: { question: string; answer: string }[],
  ) => {
    if (!askUserState) return

    // Convert accordion-style answers to the format expected by submitAnswers
    const formattedAnswers = askUserState.questions.map((q, idx) => {
      const answerObj = answers[idx]
      if (!answerObj || answerObj.answer === 'Skipped') {
        return { questionIndex: idx }
      }

      // For multi-select questions, always use selectedOptions array format
      if (q.multiSelect) {
        // Split by ', ' to get individual options (even if just one)
        const selectedOptions = answerObj.answer.split(', ').filter(Boolean)

        // Check if all selected options match known options (not "other" text)
        const allMatchKnownOptions = selectedOptions.every((selected) =>
          q.options.some((opt) => {
            const label = typeof opt === 'string' ? opt : opt.label
            return label === selected
          }),
        )

        if (allMatchKnownOptions && selectedOptions.length > 0) {
          return {
            questionIndex: idx,
            selectedOptions,
          }
        }

        // Otherwise it's an "other" text answer for multi-select
        return {
          questionIndex: idx,
          otherText: answerObj.answer,
        }
      }

      // For single-select questions, check if the answer matches one of the options
      const matchingOptionIndex = q.options.findIndex((opt) => {
        const label = typeof opt === 'string' ? opt : opt.label
        return label === answerObj.answer
      })

      if (matchingOptionIndex >= 0) {
        return {
          questionIndex: idx,
          selectedOption: answerObj.answer,
        }
      }

      // Otherwise it's an "other" text answer
      return {
        questionIndex: idx,
        otherText: answerObj.answer,
      }
    })

    submitAnswers(formattedAnswers)
  }

  const handleFormSkip = () => {
    if (!askUserState) return
    skip()
    onInterruptStream()
  }

  if (!askUserState) return null

  return (
    <box
      title={askUserTitle}
      titleAlignment="center"
      style={{
        width: '100%',
        borderStyle: 'single',
        borderColor: theme.primary,
      }}
      customBorderChars={BORDER_CHARS}
    >
      <MultipleChoiceForm
        questions={askUserState.questions}
        onSubmit={handleFormSubmit}
        onSkip={handleFormSkip}
      />
    </box>
  )
}
