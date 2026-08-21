/**
 * Diff parser for the apply_patch tool (FID-2026-0805-003). Extracted from
 * apply-patch.ts verbatim.
 */

import { findContext } from './context-matcher'
import {
  END_FILE,
  END_PATCH,
  END_SECTION_MARKERS,
  SECTION_TERMINATORS,
} from './types'

import type { Chunk, ParserState } from './types'

// Re-export the diff string helpers for backwards compatibility
export {
  ensureTrailingNewline,
  normalizeLineEndings,
  patchHasIntendedChanges,
  sanitizeUnifiedDiff,
  stripTrailingNewline,
} from './diff-utils'

export function normalizeDiffLines(diff: string): string[] {
  return diff
    .split(/\r?\n/)
    .map((line) => line.replace(/\r$/, ''))
    .filter((line, idx, arr) => !(idx === arr.length - 1 && line === ''))
}

export function isDone(state: ParserState, prefixes: string[]): boolean {
  if (state.index >= state.lines.length) {
    return true
  }

  return prefixes.some((prefix) => state.lines[state.index]?.startsWith(prefix))
}

export function isWrappedAtHeader(line: string): boolean {
  return /^@@.*@@(?: .*)?$/.test(line)
}

export function parseCreateDiff(lines: string[]): string {
  // Keep compatibility with unified create payloads by ignoring common diff headers.
  const filteredLines = lines.filter(
    (line) =>
      !line.startsWith('---') &&
      !line.startsWith('+++') &&
      !line.startsWith('@@') &&
      !line.startsWith('***'),
  )

  const parser: ParserState = {
    lines: [...filteredLines, END_PATCH],
    index: 0,
    fuzz: 0,
  }

  const output: string[] = []

  while (!isDone(parser, SECTION_TERMINATORS)) {
    const line = parser.lines[parser.index]!
    parser.index += 1

    if (!line.startsWith('+')) {
      throw new Error(`Invalid Add File Line: ${line}`)
    }

    output.push(line.slice(1))
  }

  return output.join('\n')
}

export function advanceCursorToAnchor(
  anchor: string,
  inputLines: string[],
  cursor: number,
  parser: ParserState,
): number {
  let found = false

  if (!inputLines.slice(0, cursor).some((line) => line === anchor)) {
    for (let i = cursor; i < inputLines.length; i += 1) {
      if (inputLines[i] === anchor) {
        cursor = i + 1
        found = true
        break
      }
    }
  }

  if (
    !found &&
    !inputLines.slice(0, cursor).some((line) => line.trim() === anchor.trim())
  ) {
    for (let i = cursor; i < inputLines.length; i += 1) {
      if (inputLines[i]?.trim() === anchor.trim()) {
        cursor = i + 1
        parser.fuzz += 1
        found = true
        break
      }
    }
  }

  return cursor
}

export function readSection(
  lines: string[],
  startIndex: number,
): {
  nextContext: string[]
  sectionChunks: Chunk[]
  endIndex: number
  eof: boolean
} {
  const context: string[] = []
  let delLines: string[] = []
  let insLines: string[] = []
  const sectionChunks: Chunk[] = []

  let mode: 'keep' | 'add' | 'delete' = 'keep'
  let index = startIndex
  const origIndex = index

  while (index < lines.length) {
    const raw = lines[index]!

    if (
      raw.startsWith('@@') ||
      raw.startsWith(END_PATCH) ||
      raw.startsWith('*** Update File:') ||
      raw.startsWith('*** Delete File:') ||
      raw.startsWith('*** Add File:') ||
      raw.startsWith(END_FILE)
    ) {
      break
    }

    if (raw === '***') {
      break
    }

    if (raw.startsWith('***')) {
      throw new Error(`Invalid Line: ${raw}`)
    }

    index += 1
    const lastMode = mode

    let line = raw
    if (line === '') {
      line = ' '
    }

    if (line[0] === '+') {
      mode = 'add'
    } else if (line[0] === '-') {
      mode = 'delete'
    } else if (line[0] === ' ') {
      mode = 'keep'
    } else {
      throw new Error(`Invalid Line: ${line}`)
    }

    line = line.slice(1)

    const switchingToContext = mode === 'keep' && lastMode !== mode
    if (switchingToContext && (insLines.length > 0 || delLines.length > 0)) {
      sectionChunks.push({
        origIndex: context.length - delLines.length,
        delLines,
        insLines,
      })
      delLines = []
      insLines = []
    }

    if (mode === 'delete') {
      delLines.push(line)
      context.push(line)
    } else if (mode === 'add') {
      insLines.push(line)
    } else {
      context.push(line)
    }
  }

  if (insLines.length > 0 || delLines.length > 0) {
    sectionChunks.push({
      origIndex: context.length - delLines.length,
      delLines,
      insLines,
    })
  }

  if (index < lines.length && lines[index] === END_FILE) {
    index += 1
    return { nextContext: context, sectionChunks, endIndex: index, eof: true }
  }

  if (index === origIndex) {
    throw new Error(`Nothing in this section - index=${index} ${lines[index]}`)
  }

  return { nextContext: context, sectionChunks, endIndex: index, eof: false }
}

export function parseUpdateDiff(
  lines: string[],
  input: string,
): { chunks: Chunk[]; fuzz: number } {
  const parser: ParserState = {
    lines: [...lines, END_PATCH],
    index: 0,
    fuzz: 0,
  }

  const inputLines = input.split('\n')
  const chunks: Chunk[] = []
  let cursor = 0

  while (!isDone(parser, END_SECTION_MARKERS)) {
    const current = parser.lines[parser.index]
    const line = typeof current === 'string' ? current : ''

    let anchor = ''
    const hasBareHeader = line === '@@'
    const hasWrappedHeader = isWrappedAtHeader(line)
    const hasAnchorHeader = line.startsWith('@@ ') && !hasWrappedHeader
    const hasAnyHeader = hasBareHeader || hasWrappedHeader || hasAnchorHeader

    if (hasAnchorHeader) {
      anchor = line.slice(3)
      parser.index += 1
    } else if (hasBareHeader || hasWrappedHeader) {
      parser.index += 1
    }

    if (!(hasAnyHeader || cursor === 0)) {
      throw new Error(`Invalid Line:\n${parser.lines[parser.index]}`)
    }

    if (anchor.trim()) {
      cursor = advanceCursorToAnchor(anchor, inputLines, cursor, parser)
    }

    const { nextContext, sectionChunks, endIndex, eof } = readSection(
      parser.lines,
      parser.index,
    )

    const { newIndex, fuzz } = findContext(inputLines, nextContext, cursor, eof)

    if (newIndex === -1) {
      const nextContextText = nextContext.join('\n')
      if (eof) {
        throw new Error(`Invalid EOF Context ${cursor}:\n${nextContextText}`)
      }

      throw new Error(`Invalid Context ${cursor}:\n${nextContextText}`)
    }

    parser.fuzz += fuzz
    for (const chunk of sectionChunks) {
      chunks.push({ ...chunk, origIndex: chunk.origIndex + newIndex })
    }

    cursor = newIndex + nextContext.length
    parser.index = endIndex
  }

  return { chunks, fuzz: parser.fuzz }
}
