import { useKeyboard } from '@opentui/react'
import { useCallback, useEffect } from 'react'

import { handleDeletionKey, handleEnterKey } from './enter-deletion-keys'
import {
  handleCharacterKey,
  handleNavigationKey,
} from './navigation-character-keys'

import type {
  CliRendererWithStdinBuffer,
  LineInfo,
  TextRenderableWithBuffer,
} from './types'
import type { useInputEditing } from './use-input-editing'
import type { InputValue } from '../../types/store'
import type { KeyEvent, TextRenderable } from '@opentui/core'
import type { useAppContext } from '@opentui/react'
import type { MutableRefObject } from 'react'

type InputEditingApi = ReturnType<typeof useInputEditing>

export interface UseMultilineKeyboardParams {
  focused: boolean
  onKeyIntercept: ((key: KeyEvent) => boolean) | undefined
  stickyColumnRef: MutableRefObject<number | null>
  value: string
  cursorPosition: number
  onChange: (value: InputValue) => void
  onSubmit: () => void
  lineInfo: LineInfo | null
  cursorRow: number
  handleSelectionDeletion: InputEditingApi['handleSelectionDeletion']
  moveCursor: InputEditingApi['moveCursor']
  insertTextAtCursor: InputEditingApi['insertTextAtCursor']
  shouldHighlight: boolean
  getOrSetStickyColumn: (lineStarts: number[], cursorIsChar: boolean) => number
  textRef: MutableRefObject<TextRenderable | null>
  appContext: ReturnType<typeof useAppContext>
}

/**
 * Keyboard and stdin wiring for MultilineInput: the specialized key handlers
 * (enter/deletion/navigation/character), the stdin-parser timeout for split
 * paste sequences, and the main keyboard delegation
 * (FID-2026-0819-005 Loop 138; bodies moved verbatim from the parent).
 */
export function useMultilineKeyboard({
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
}: UseMultilineKeyboardParams): void {
  // --- Keyboard Handler Helpers ---

  // Handle enter/newline keys
  const handleEnterKeys = useCallback(
    (key: KeyEvent) =>
      handleEnterKey({ key, value, cursorPosition, onChange, onSubmit }),
    [value, cursorPosition, onChange, onSubmit],
  )

  // Handle deletion keys (backspace, delete, ctrl+h, ctrl+d, word/line deletion)
  const handleDeletionKeys = useCallback(
    (key: KeyEvent) =>
      handleDeletionKey({
        key,
        value,
        cursorPosition,
        onChange,
        lineInfo,
        cursorRow,
        handleSelectionDeletion,
      }),
    [
      value,
      cursorPosition,
      onChange,
      lineInfo,
      cursorRow,
      handleSelectionDeletion,
    ],
  )

  // Handle navigation keys (arrows, home, end, word navigation, emacs bindings)
  const handleNavigationKeys = useCallback(
    (key: KeyEvent) =>
      handleNavigationKey({
        key,
        value,
        cursorPosition,
        onChange,
        moveCursor,
        shouldHighlight,
        getOrSetStickyColumn,
        getCurrentLineInfo: () =>
          textRef.current
            ? (textRef.current as TextRenderableWithBuffer).textBufferView
                .lineInfo
            : null,
      }),
    [
      value,
      cursorPosition,
      onChange,
      moveCursor,
      shouldHighlight,
      getOrSetStickyColumn,
    ],
  )

  // Handle character input (regular chars, tab, and IME/multi-byte input)
  const handleCharacterInput = useCallback(
    (key: KeyEvent) => handleCharacterKey({ key, insertTextAtCursor }),
    [insertTextAtCursor],
  )

  // Increase StdinParser timeout from default 10ms to 100ms.
  // Some terminals (Ghostty, iTerm2, VS Code) split bracketed paste sequences
  // across multiple stdin reads when drag-dropping files. The default 10ms
  // timeout causes the parser to flush partial escape sequences as keypresses,
  // corrupting paste detection. 100ms is still fast for keyboard input but
  // gives enough time for split paste sequences to arrive.
  useEffect(() => {
    const cliRenderer = appContext.renderer as CliRendererWithStdinBuffer | null
    const stdinBuffer = cliRenderer?._stdinBuffer
    if (stdinBuffer && typeof stdinBuffer.timeoutMs === 'number') {
      stdinBuffer.timeoutMs = 100
    }
  }, [appContext])

  // Main keyboard handler - delegates to specialized handlers
  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        if (!focused) return

        if (onKeyIntercept) {
          const handled = onKeyIntercept(key)
          if (handled) return
        }

        // Clear sticky column for non-vertical navigation
        const isVerticalNavKey = key.name === 'up' || key.name === 'down'
        if (!isVerticalNavKey) {
          stickyColumnRef.current = null
        }

        // Delegate to specialized handlers
        if (handleEnterKeys(key)) return
        if (handleDeletionKeys(key)) return
        if (handleNavigationKeys(key)) return
        if (handleCharacterInput(key)) return
      },
      [
        focused,
        onKeyIntercept,
        handleEnterKeys,
        handleDeletionKeys,
        handleNavigationKeys,
        handleCharacterInput,
      ],
    ),
  )
}
