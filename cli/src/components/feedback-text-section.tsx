import React from 'react'

import { MultilineInput, type MultilineInputHandle } from './multiline-input'
import { Separator } from './separator'
import { useChatStore } from '../state/chat-store'
import { createTextPasteHandler } from '../utils/strings'
import { isPlainEnterKey } from '../utils/terminal-enter-detection'

export interface FeedbackTextSectionProps {
  value: string
  cursor: number
  onChange: (text: string) => void
  onCursorChange: (cursor: number) => void
  onSubmit: () => void
  placeholder: string
  inputRef?: React.MutableRefObject<MultilineInputHandle | null>
  width: number
  isSubmitting?: boolean
}

export const FeedbackTextSection: React.FC<FeedbackTextSectionProps> = ({
  value,
  cursor,
  onChange,
  onCursorChange,
  onSubmit,
  placeholder,
  inputRef,
  width,
  isSubmitting = false,
}) => {
  const inputFocused = useChatStore((state) => state.inputFocused)

  return (
    <>
      {/* Top separator */}
      <Separator width={width} widthOffset={4} />

      {/* Feedback input */}
      <box style={{ paddingTop: 0, paddingBottom: 0 }}>
        <MultilineInput
          value={value}
          onChange={({ text, cursorPosition }) => {
            onChange(text)
            onCursorChange(cursorPosition)
          }}
          onSubmit={onSubmit}
          onKeyIntercept={(key) => {
            if (!isPlainEnterKey(key)) return false
            // Just add newline on Enter
            const newText = value.slice(0, cursor) + '\n' + value.slice(cursor)
            onChange(newText)
            onCursorChange(cursor + 1)
            return true
          }}
          onPaste={createTextPasteHandler(
            value,
            cursor,
            ({ text, cursorPosition }) => {
              onChange(text)
              onCursorChange(cursorPosition)
            },
          )}
          placeholder={placeholder}
          focused={inputFocused && !isSubmitting}
          maxHeight={5}
          minHeight={3}
          ref={inputRef}
          cursorPosition={cursor}
        />
      </box>

      {/* Bottom separator */}
      <Separator width={width} widthOffset={4} />
    </>
  )
}
