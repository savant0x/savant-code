import type { InputValue } from '../../types/store'
import type {
  CliRenderer,
  KeyEvent,
  MouseEvent,
  ScrollBoxRenderable,
  TextBufferView,
  TextRenderable,
} from '@opentui/core'
import type { RefObject } from 'react'

export type TextRenderableWithBuffer = TextRenderable & {
  textBufferView: TextBufferView
}

export type CliRendererWithStdinBuffer = CliRenderer & {
  _stdinBuffer?: { timeoutMs?: number }
}

export type LineInfo = TextBufferView['lineInfo']

export type OnInputChange = (input: InputValue) => void

export type SelectionRange = { start: number; end: number }

/** Scrollbox focus/blur methods not exposed in OpenTUI types but available at runtime. */
export interface FocusableScrollBox {
  focus?: () => void
  blur?: () => void
}

/** Shared deps for the pure key handlers (FID-2026-0805-003). */
export type EnterKeyDeps = {
  key: KeyEvent
  value: string
  cursorPosition: number
  onChange: OnInputChange
  onSubmit: () => void
}

export type DeletionKeyDeps = {
  key: KeyEvent
  value: string
  cursorPosition: number
  onChange: OnInputChange
  lineInfo: LineInfo | null
  cursorRow: number
  handleSelectionDeletion: () => boolean
}

export type NavigationKeyDeps = {
  key: KeyEvent
  value: string
  cursorPosition: number
  onChange: OnInputChange
  moveCursor: (position: number) => void
  shouldHighlight: boolean
  getOrSetStickyColumn: (lineStarts: number[], cursorIsChar: boolean) => number
  getCurrentLineInfo: () => LineInfo | null
}

export type CharacterKeyDeps = {
  key: KeyEvent
  insertTextAtCursor: (text: string) => void
}

export type MouseDeps = {
  event: MouseEvent
  focused: boolean
  value: string
  cursorPosition: number
  lineInfo: LineInfo | null
  onChange: OnInputChange
  scrollBoxRef: RefObject<ScrollBoxRenderable | null>
  resetStickyColumn: () => void
  clearSelection: () => void
}

export type SelectionDeps = {
  value: string
  getSelectionRange: () => SelectionRange | null
  clearSelection: () => void
}

export type InsertTextDeps = SelectionDeps & {
  textToInsert: string
  onChange: OnInputChange
  refs: {
    valueRef: RefObject<string>
    cursorPositionRef: RefObject<number>
  }
}
