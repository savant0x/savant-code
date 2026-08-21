import { useAppContext, useRenderer } from '@opentui/react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

import { useTheme } from '../hooks/use-theme'
import { useChatStore } from '../state/chat-store'
import { computeLayoutMetrics } from './multiline-input/metrics'
import { handleMouseKey } from './multiline-input/mouse'
import { computeRenderValues } from './multiline-input/render-values'
import { useInputEditing } from './multiline-input/use-input-editing'
import { useMultilineKeyboard } from './multiline-input/use-multiline-keyboard'
import { usePasteHandling } from './multiline-input/use-paste'
import { useMultilineScrollbox } from './multiline-input/use-scrollbox'
import { MultilineView } from './multiline-input/view'

import type { InputValue } from '../types/store'
import type {
  FocusableScrollBox,
  LineInfo,
  TextRenderableWithBuffer,
} from './multiline-input/types'
import type { KeyEvent, MouseEvent, TextRenderable } from '@opentui/core'

export { CURSOR_CHAR } from './multiline-input/key-utils'

interface MultilineInputProps {
  value: string
  onChange: (value: InputValue) => void
  onSubmit: () => void
  onKeyIntercept?: (key: KeyEvent) => boolean
  onPaste: (fallbackText?: string) => void
  placeholder?: string
  focused?: boolean
  shouldBlinkCursor?: boolean
  maxHeight?: number
  minHeight?: number
  cursorPosition: number
  showScrollbar?: boolean
  /** Render entered text as bullets for secret input modes. */
  maskInput?: boolean
}

export type MultilineInputHandle = {
  focus: () => void
  blur: () => void
}

export const MultilineInput = forwardRef<
  MultilineInputHandle,
  MultilineInputProps
>(function MultilineInput(
  {
    value,
    onChange,
    onSubmit,
    onPaste,
    placeholder = '',
    focused = true,
    shouldBlinkCursor,
    maxHeight = 5,
    minHeight = 1,
    onKeyIntercept,
    cursorPosition,
    showScrollbar = false,
    maskInput = false,
  }: MultilineInputProps,
  forwardedRef,
) {
  const theme = useTheme()
  const renderer = useRenderer()
  const appContext = useAppContext()
  const { keyHandler } = appContext
  const hookBlinkValue = useChatStore((state) => state.isFocusSupported)
  const effectiveShouldBlinkCursor = shouldBlinkCursor ?? hookBlinkValue

  const [lastActivity, setLastActivity] = useState(Date.now())

  const stickyColumnRef = useRef<number | null>(null)

  // Helper to get or set the sticky column for vertical navigation.
  // When stickyColumnRef.current is set, we return it (preserving column across
  // multiple up/down presses). When null, we calculate from current cursor position.
  const getOrSetStickyColumn = useCallback(
    (lineStarts: number[], cursorIsChar: boolean): number => {
      if (stickyColumnRef.current != null) {
        return stickyColumnRef.current
      }
      const lineIndex = lineStarts.findLastIndex(
        (lineStart) => lineStart <= cursorPosition,
      )
      const column =
        lineIndex === -1
          ? 0
          : cursorPosition - lineStarts[lineIndex] + (cursorIsChar ? -1 : 0)
      stickyColumnRef.current = Math.max(0, column)
      return stickyColumnRef.current
    },
    [cursorPosition],
  )

  // Update last activity on value or cursor changes
  useEffect(() => {
    setLastActivity(Date.now())
  }, [value, cursorPosition])

  const textRef = useRef<TextRenderable | null>(null)

  const lineInfo: LineInfo | null = textRef.current
    ? (textRef.current as TextRenderableWithBuffer).textBufferView.lineInfo
    : null

  const cursorRow = lineInfo
    ? Math.max(
        0,
        lineInfo.lineStartCols.findLastIndex(
          (lineStart) => lineStart <= cursorPosition,
        ),
      )
    : 0

  const { scrollBoxRef } = useMultilineScrollbox({
    focused,
    cursorPosition,
    cursorRow,
  })

  // Expose focus/blur for imperative use cases
  useImperativeHandle(
    forwardedRef,
    () => ({
      focus: () => {
        ;(scrollBoxRef.current as FocusableScrollBox | null)?.focus?.()
      },
      blur: () => {
        ;(scrollBoxRef.current as FocusableScrollBox | null)?.blur?.()
      },
    }),
    [],
  )

  const {
    clearSelection,
    handleSelectionDeletion,
    insertTextAtCursor,
    moveCursor,
  } = useInputEditing({ value, cursorPosition, onChange, textRef, renderer })

  // Handle mouse clicks to position cursor
  const resetStickyColumn = useCallback(() => {
    stickyColumnRef.current = null
  }, [])

  const handleMouseDown = useCallback(
    (event: MouseEvent) =>
      handleMouseKey({
        event,
        focused,
        value,
        cursorPosition,
        lineInfo,
        onChange,
        scrollBoxRef,
        resetStickyColumn,
        clearSelection,
      }),
    [
      focused,
      lineInfo,
      value,
      cursorPosition,
      onChange,
      clearSelection,
      resetStickyColumn,
    ],
  )

  const {
    isPlaceholder,
    displayValueForRendering,
    beforeCursor,
    afterCursor,
    activeChar,
    shouldHighlight,
    showCursor,
  } = computeRenderValues({
    value,
    placeholder,
    cursorPosition,
    focused,
    maskInput,
  })

  // Keyboard and stdin wiring: specialized key handlers, the stdin-parser
  // timeout for split paste sequences, and the main keyboard delegation
  // (moved verbatim to use-multiline-keyboard, FID-2026-0819-005 Loop 138).
  useMultilineKeyboard({
    focused,
    onKeyIntercept,
    stickyColumnRef,
    value,
    cursorPosition,
    onChange,
    onSubmit,
    lineInfo,
    cursorRow,
    handleSelectionDeletion,
    moveCursor,
    insertTextAtCursor,
    shouldHighlight,
    getOrSetStickyColumn,
    textRef,
    appContext,
  })

  const { onScrollboxPaste } = usePasteHandling({ keyHandler, onPaste })

  const layoutMetrics = computeLayoutMetrics({
    lineInfo,
    cursorRow,
    maxHeight,
    minHeight,
  })

  const inputColor = isPlaceholder
    ? theme.muted
    : focused
      ? theme.inputFocusedFg
      : theme.inputFg

  // Use theme's info color for selection highlight background
  const highlightBg = theme.info

  return (
    <MultilineView
      scrollBoxRef={scrollBoxRef}
      textRef={textRef}
      showScrollbar={showScrollbar}
      layoutMetrics={layoutMetrics}
      onScrollboxPaste={onScrollboxPaste}
      onMouseDown={handleMouseDown}
      displayValueForRendering={displayValueForRendering}
      showCursor={showCursor}
      beforeCursor={beforeCursor}
      afterCursor={afterCursor}
      activeChar={activeChar}
      shouldHighlight={shouldHighlight}
      focused={focused}
      maskInput={maskInput}
      lastActivity={lastActivity}
      effectiveShouldBlinkCursor={effectiveShouldBlinkCursor}
      inputColor={inputColor}
      highlightBg={highlightBg}
      theme={theme}
    />
  )
})
