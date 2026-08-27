/**
 * Question option component (radio button or checkbox)
 */

import { TextAttributes } from '@opentui/core'
import React, { memo } from 'react'

import { useTheme } from '../../../hooks/use-theme'
import { Button } from '../../button'
import { SYMBOLS } from '../constants'

export interface QuestionOptionProps {
  option: string | { label: string; description?: string }
  indent: number
  isSelected: boolean
  isFocused: boolean
  isMultiSelect?: boolean
  onSelect: () => void
  onMouseOver: () => void
}

export const QuestionOption: React.FC<QuestionOptionProps> = memo(
  ({
    option,
    indent,
    isSelected,
    isFocused,
    isMultiSelect = false,
    onSelect,
    onMouseOver,
  }) => {
    const theme = useTheme()

    // Extract label and description
    const label = typeof option === 'string' ? option : option.label
    const description =
      typeof option === 'object' ? option.description : undefined

    // FID-2026-0822-007: selected emphasis text is the focused-input token
    // (exact white/black match); focused text sits on the primary fill and
    // uses theme.onPrimary.
    const selectedFg = theme.inputFocusedFg
    const symbol = isMultiSelect
      ? isSelected
        ? SYMBOLS.CHECKBOX_CHECKED
        : SYMBOLS.CHECKBOX_UNCHECKED
      : isSelected
        ? SYMBOLS.SELECTED
        : SYMBOLS.UNSELECTED
    const fg = isFocused
      ? theme.onPrimary
      : isSelected
        ? selectedFg
        : theme.muted
    const attributes = isFocused || isSelected ? TextAttributes.BOLD : undefined

    return (
      <Button
        onClick={onSelect}
        onMouseOver={onMouseOver}
        style={{
          flexDirection: 'column',
          gap: 0,
          width: '100%',
          backgroundColor: isFocused ? theme.primary : undefined,
          marginBottom: 0,
          paddingTop: 0,
          paddingBottom: 0,
          paddingLeft: indent,
        }}
      >
        <text style={{ fg, attributes }}>{`${symbol} ${label}`}</text>
        {/* Show description on focus */}
        {isFocused && description && (
          <text
            style={{
              fg: theme.onPrimary,
              marginLeft: 2,
            }}
          >
            {description}
          </text>
        )}
      </Button>
    )
  },
  // Memo comparison: only re-render if these props change
  (prev, next) => {
    return (
      prev.isSelected === next.isSelected &&
      prev.isFocused === next.isFocused &&
      prev.option === next.option &&
      prev.indent === next.indent &&
      prev.isMultiSelect === next.isMultiSelect &&
      prev.onSelect === next.onSelect &&
      prev.onMouseOver === next.onMouseOver
    )
  },
)

QuestionOption.displayName = 'QuestionOption'
