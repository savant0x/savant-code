import { parseEntities } from './parse'
import { Node } from './types'

// FID-2026-0819-005 Loop 151: the text-run handling cluster, extracted from
// saxy/stream.ts. These functions operate on a minimal context interface —
// the subset of the Saxy stream instance the text path touches — so the
// behavior is verbatim while the class stays under the size ceiling.

/** The slice of the Saxy stream the text handlers interact with. */
export interface TextHandlerContext {
  _tags: { stack: unknown[] }
  _textBuffer: string
  _shouldParseEntities: boolean
  _waiting: { token: string; data: unknown } | null
  emit(event: string, data: unknown): boolean
  _wait(token: string, data: unknown): void
}

/**
 * Handle a run of text, buffering it and optionally splitting off
 * an incomplete entity at the end for the next chunk.
 *
 * @param input The input string.
 * @param chunkPos Position of the first text character.
 * @param end End of the input string.
 * @return The new cursor position (the next tag start, or `end` if the
 * rest of the chunk is text).
 */
export function handleTextRun(
  ctx: TextHandlerContext,
  input: string,
  chunkPos: number,
  end: number,
): number {
  // Find next potential tag, but verify it's actually a tag
  let nextTag = input.indexOf('<', chunkPos)
  while (
    nextTag !== -1 &&
    nextTag + 1 < end &&
    !isXMLTagStart(input, nextTag + 1)
  ) {
    nextTag = input.indexOf('<', nextTag + 1)
  }

  // We read a TEXT node but there might be some
  // more text data left, so we wait
  if (nextTag === -1) {
    let chunk = input.slice(chunkPos)

    if (ctx._tags.stack.length === 1 && !chunk.trim()) {
      chunk = ''
    }

    // Check for incomplete entity at end
    const lastAmp = chunk.lastIndexOf('&')
    if (
      ctx._shouldParseEntities &&
      lastAmp !== -1 &&
      chunk.indexOf(';', lastAmp) === -1
    ) {
      // Only consider it a pending entity if it looks like the start of one
      const postAmp = chunk.slice(lastAmp + 1)
      const isPotentialEntity =
        /^(#\d*)?$/.test(postAmp) || // Numeric entity
        /^[a-zA-Z]{0,6}$/.test(postAmp) // Named entity
      if (isPotentialEntity) {
        // Store incomplete entity for next chunk
        ctx._wait(Node.text, chunk.slice(lastAmp))
        chunk = chunk.slice(0, lastAmp)
      }
    }

    if (chunk.length > 0) {
      ctx._textBuffer += chunk
    }

    return end
  }

  // A tag follows, so we can be confident that
  // we have all the data needed for the TEXT node
  let chunk = input.slice(chunkPos, nextTag)

  if (ctx._tags.stack.length === 1 && !chunk.trim()) {
    chunk = ''
  }

  // Only emit non-whitespace text or text within a single tag (not between tags)
  if (chunk.length > 0) {
    ctx._textBuffer += chunk
  }

  // We've reached a tag boundary, emit any buffered text
  flushTextBuffer(ctx)

  return nextTag
}

/**
 * Emit any buffered text node, clearing the buffer.
 */
export function flushTextBuffer(ctx: TextHandlerContext): void {
  if (ctx._textBuffer.length === 0) {
    return
  }

  const parsedText = ctx._shouldParseEntities
    ? parseEntities(ctx._textBuffer)
    : ctx._textBuffer
  ctx.emit(Node.text, { contents: parsedText })
  ctx._textBuffer = ''
}

/**
 * Check if a potential XML tag start is actually a valid tag
 * @param input The input string
 * @param pos Position after the < character
 * @returns true if this is a valid XML tag start
 */
export function isXMLTagStart(input: string, pos: number): boolean {
  // Valid XML tags must start with a letter, underscore or colon
  // https://www.w3.org/TR/xml/#NT-NameStartChar
  const firstChar = input[pos]
  return /[A-Za-z_:]/.test(firstChar) || firstChar === '/'
}
