import { decodePasteBytes, stripAnsiSequences } from '@opentui/core'

import type { PasteEvent } from '@opentui/core'

export const TAB_WIDTH = 4

export function getPasteText(event: PasteEvent): string {
  return stripAnsiSequences(decodePasteBytes(event.bytes))
}

export function findLineStart(text: string, cursor: number): number {
  let pos = Math.max(0, Math.min(cursor, text.length))
  while (pos > 0 && text[pos - 1] !== '\n') {
    pos--
  }
  return pos
}

export function findLineEnd(text: string, cursor: number): number {
  let pos = Math.max(0, Math.min(cursor, text.length))
  while (pos < text.length && text[pos] !== '\n') {
    pos++
  }
  return pos
}

export function findPreviousWordBoundary(text: string, cursor: number): number {
  let pos = Math.max(0, Math.min(cursor, text.length))

  // Skip whitespace backwards
  while (pos > 0 && /\s/.test(text[pos - 1])) {
    pos--
  }

  // Skip word characters backwards
  while (pos > 0 && !/\s/.test(text[pos - 1])) {
    pos--
  }

  return pos
}

export function findNextWordBoundary(text: string, cursor: number): number {
  let pos = Math.max(0, Math.min(cursor, text.length))

  // Skip non-whitespace forwards
  while (pos < text.length && !/\s/.test(text[pos])) {
    pos++
  }

  // Skip whitespace forwards
  while (pos < text.length && /\s/.test(text[pos])) {
    pos++
  }

  return pos
}

// Helper to convert render position (in tab-expanded string) to original text position
export function renderPositionToOriginal(
  text: string,
  renderPos: number,
): number {
  let originalPos = 0
  let currentRenderPos = 0

  while (originalPos < text.length && currentRenderPos < renderPos) {
    if (text[originalPos] === '\t') {
      currentRenderPos += TAB_WIDTH
    } else {
      currentRenderPos += 1
    }
    originalPos++
  }

  return Math.min(originalPos, text.length)
}
