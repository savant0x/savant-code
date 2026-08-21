import { TextAttributes } from '@opentui/core'
import React, { useRef, useState } from 'react'

import { Button } from './button'
import {
  CATEGORY_OPTIONS,
  FEEDBACK_CONTAINER_HORIZONTAL_INSET,
  FULL_CATEGORY_ROW_WIDTH,
} from './feedback-category-options'
import { FeedbackTextSection } from './feedback-text-section'
import { useTheme } from '../hooks/use-theme'
import { BORDER_CHARS } from '../utils/ui-constants'

import type { MultilineInputHandle } from './multiline-input'
import type { FeedbackCategory } from '@savant-code/common/constants/feedback'

interface FeedbackInputModeProps {
  value: string
  cursor: number
  feedbackCategory: FeedbackCategory
  onChange: (text: string) => void
  onCursorChange: (cursor: number) => void
  onCategoryChange: (category: FeedbackCategory) => void
  onSubmit: () => void
  onCancel: () => void
  inputRef?: React.MutableRefObject<MultilineInputHandle | null>
  width: number
  footerMessage?: string | null
  isSubmitting?: boolean
}

export const FeedbackInputMode: React.FC<FeedbackInputModeProps> = ({
  value,
  cursor,
  feedbackCategory,
  onChange,
  onCursorChange,
  onCategoryChange,
  onSubmit,
  onCancel,
  inputRef: externalInputRef,
  width,
  footerMessage,
  isSubmitting = false,
}) => {
  const theme = useTheme()
  const internalInputRef = useRef<MultilineInputHandle | null>(null)
  const inputRef = externalInputRef || internalInputRef
  const canSubmit = value.trim().length > 0 && !isSubmitting
  const [closeButtonHovered, setCloseButtonHovered] = useState(false)
  const availableWidth = Math.max(
    0,
    width - FEEDBACK_CONTAINER_HORIZONTAL_INSET,
  )
  const shouldUseShortLabels = FULL_CATEGORY_ROW_WIDTH > availableWidth

  // Keyboard shortcuts are handled by useChatKeyboard in chat.tsx

  return (
    <box
      border
      borderStyle="single"
      borderColor={theme.primary}
      customBorderChars={BORDER_CHARS}
      style={{
        flexDirection: 'column',
        gap: 0,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      {/* Header: helper text + close X */}
      <box
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 1,
        }}
      >
        <text style={{ wrapMode: 'none', marginLeft: 1, marginRight: 1 }}>
          <span fg={theme.secondary}>
            Share your feedback — thanks for helping us improve!
          </span>
        </text>
        <box
          style={{ paddingRight: 1 }}
          onMouseDown={onCancel}
          onMouseOver={() => setCloseButtonHovered(true)}
          onMouseOut={() => setCloseButtonHovered(false)}
        >
          <text style={{ wrapMode: 'none' }} selectable={false}>
            <span fg={closeButtonHovered ? theme.foreground : theme.secondary}>
              [x]
            </span>
          </text>
        </box>
      </box>

      {/* Category buttons */}
      <box
        style={{
          flexDirection: 'row',
          gap: 1,
          paddingTop: 0,
          paddingBottom: 0,
        }}
      >
        {CATEGORY_OPTIONS.map((option) => {
          const optionHighlight = theme[option.highlightKey]
          const isSelected = feedbackCategory === option.id
          const label = shouldUseShortLabels ? option.shortLabel : option.label
          return (
            <Button
              key={option.id}
              onClick={() => onCategoryChange(option.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 1,
                paddingLeft: 1,
                paddingRight: 1,
                paddingTop: 0,
                paddingBottom: 0,
                borderStyle: 'single',
                borderColor: isSelected ? optionHighlight : theme.border,
                backgroundColor: 'transparent',
              }}
              customBorderChars={BORDER_CHARS}
            >
              <text style={{ wrapMode: 'none' }}>
                <span fg={isSelected ? optionHighlight : theme.muted}>
                  {isSelected ? '◉' : '◯'}
                </span>
                <span fg={isSelected ? theme.foreground : theme.secondary}>
                  {' '}
                  {label}
                </span>
              </text>
            </Button>
          )
        })}
      </box>

      {/* Feedback text section with separators */}
      <FeedbackTextSection
        value={value}
        cursor={cursor}
        onChange={isSubmitting ? () => {} : onChange}
        onCursorChange={isSubmitting ? () => {} : onCursorChange}
        onSubmit={onSubmit}
        placeholder={
          isSubmitting
            ? 'Sending feedback...'
            : CATEGORY_OPTIONS.find((opt) => opt.id === feedbackCategory)
                ?.placeholder ||
              'Tell us more (what happened, what you expected)...'
        }
        inputRef={inputRef}
        width={width}
        isSubmitting={isSubmitting}
      />

      {/* Footer with auto-attached info and submit button */}
      <box
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 0,
          paddingBottom: 0,
          gap: 2,
        }}
      >
        <text style={{ wrapMode: 'none' }}>
          <span fg={theme.muted}>
            {footerMessage || 'Session details are auto-attached'}
          </span>
        </text>
        <Button
          onClick={() => {
            if (canSubmit) onSubmit()
          }}
          style={{
            paddingLeft: 1,
            paddingRight: 1,
            paddingTop: 0,
            paddingBottom: 0,
            borderStyle: 'single',
            borderColor: canSubmit ? theme.foreground : theme.border,
            backgroundColor: 'transparent',
          }}
          customBorderChars={BORDER_CHARS}
        >
          <text
            style={{ wrapMode: 'none' }}
            attributes={
              canSubmit ? undefined : TextAttributes.DIM | TextAttributes.ITALIC
            }
          >
            <span fg={canSubmit ? theme.foreground : theme.muted}>
              {isSubmitting ? 'SENDING...' : 'SUBMIT'}
            </span>
          </text>
        </Button>
      </box>
    </box>
  )
}
