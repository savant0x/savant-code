import type { Content, Emphasis, Root, Strong, Text } from 'mdast'

export type MarkdownNode = Content | Root

export type InlineFallbackNode = Text | Strong | Emphasis

const hasUnescapedMarker = (value: string): boolean => {
  if (!value) {
    return false
  }
  const markers = ['**', '*']
  return markers.some((marker) => {
    let idx = value.indexOf(marker)
    while (idx !== -1) {
      let backslashes = 0
      for (
        let offset = idx - 1;
        offset >= 0 && value[offset] === '\\';
        offset -= 1
      ) {
        backslashes += 1
      }
      if (backslashes % 2 === 0) {
        return true
      }
      idx = value.indexOf(marker, idx + marker.length)
    }
    return false
  })
}

const findClosingDelimiter = (
  value: string,
  start: number,
  marker: string,
): number => {
  let idx = start
  while (idx < value.length) {
    idx = value.indexOf(marker, idx)
    if (idx === -1) {
      return -1
    }
    let backslashes = 0
    for (
      let offset = idx - 1;
      offset >= 0 && value[offset] === '\\';
      offset -= 1
    ) {
      backslashes += 1
    }
    if (backslashes % 2 === 0) {
      return idx
    }
    idx += marker.length
  }
  return -1
}

/**
 * Remark follows CommonMark's emphasis rules, which ignore some practical
 * patterns (e.g., `Other**.github/**`). This fallback splits leftover text
 * nodes on emphasis markers so we still render inline styling in those cases.
 */
export const parseInlineFallback = (value: string): InlineFallbackNode[] => {
  if (!value || !hasUnescapedMarker(value)) {
    return [{ type: 'text', value }]
  }

  const nodes: InlineFallbackNode[] = []
  let buffer = ''

  const flushBuffer = () => {
    if (buffer.length > 0) {
      nodes.push({ type: 'text', value: buffer })
      buffer = ''
    }
  }

  let index = 0
  while (index < value.length) {
    const char = value[index]

    if (char === '*') {
      const markerChar = char
      const isDouble =
        index + 1 < value.length && value[index + 1] === markerChar
      const marker = isDouble ? markerChar.repeat(2) : markerChar
      const markerLength = marker.length

      let backslashes = 0
      for (
        let offset = index - 1;
        offset >= 0 && value[offset] === '\\';
        offset -= 1
      ) {
        backslashes += 1
      }

      if (backslashes % 2 === 1) {
        buffer += marker
        index += markerLength
        continue
      }

      const closing = findClosingDelimiter(value, index + markerLength, marker)
      if (closing === -1) {
        buffer += marker
        index += markerLength
        continue
      }

      const inner = value.slice(index + markerLength, closing)
      flushBuffer()
      const children = parseInlineFallback(inner).filter(
        (node) => !(node.type === 'text' && node.value.length === 0),
      )

      const emphasisNode: InlineFallbackNode = isDouble
        ? { type: 'strong', children }
        : { type: 'emphasis', children }

      nodes.push(emphasisNode)
      index = closing + markerLength
      continue
    }

    buffer += char
    index += 1
  }

  flushBuffer()

  if (nodes.length === 0) {
    return [{ type: 'text', value }]
  }

  return nodes
}

export const applyInlineFallbackFormatting = (node: MarkdownNode): void => {
  if (!node || typeof node !== 'object') {
    return
  }

  const mutable = node as { children?: MarkdownNode[] }
  if (!Array.isArray(mutable.children)) {
    return
  }

  const nextChildren: MarkdownNode[] = []

  mutable.children.forEach((child) => {
    if (child.type === 'text') {
      const replacements = parseInlineFallback(child.value)
      const hasChanges =
        replacements.length !== 1 ||
        replacements[0].type !== 'text' ||
        replacements[0].value !== child.value

      if (hasChanges) {
        replacements.forEach((replacement) => {
          if (replacement.type === 'text') {
            nextChildren.push(replacement)
          } else {
            applyInlineFallbackFormatting(
              replacement as unknown as MarkdownNode,
            )
            nextChildren.push(replacement as unknown as MarkdownNode)
          }
        })
        return
      }
    } else {
      applyInlineFallbackFormatting(child as MarkdownNode)
    }

    nextChildren.push(child as MarkdownNode)
  })

  mutable.children = nextChildren
}
