import stringWidth from 'string-width'

import type { MarkdownNode } from './markdown-inline'
import type {
  Blockquote,
  Code,
  Emphasis,
  Heading,
  InlineCode,
  Link,
  List,
  ListItem,
  Paragraph,
  Root,
  Strong,
  Table,
  TableCell,
  TableRow,
  Text,
} from 'mdast'
import type { ReactNode } from 'react'

export const getChildrenText = (children: MarkdownNode[]): string => {
  return children.map(nodeToPlainText).join('')
}

export const nodeToPlainText = (node: MarkdownNode): string => {
  switch (node.type) {
    case 'root':
      return getChildrenText((node as Root).children as MarkdownNode[])

    case 'paragraph':
      return (
        getChildrenText((node as Paragraph).children as MarkdownNode[]) + '\n\n'
      )

    case 'text':
      return (node as Text).value

    case 'strong':
      return getChildrenText((node as Strong).children as MarkdownNode[])

    case 'emphasis':
      return getChildrenText((node as Emphasis).children as MarkdownNode[])

    case 'inlineCode':
      return (node as InlineCode).value

    case 'heading': {
      const heading = node as Heading
      const prefix = '#'.repeat(Math.max(1, Math.min(heading.depth, 6)))
      const content = getChildrenText(heading.children as MarkdownNode[])
      return `${prefix} ${content}\n\n`
    }

    case 'list': {
      const list = node as List
      return (
        list.children
          .map((item, idx) => {
            const marker = list.ordered ? `${(list.start ?? 1) + idx}. ` : '- '
            const text = getChildrenText(
              (item as ListItem).children as MarkdownNode[],
            ).trimEnd()
            return marker + text
          })
          .join('\n') + '\n\n'
      )
    }

    case 'listItem':
      return getChildrenText((node as ListItem).children as MarkdownNode[])

    case 'blockquote': {
      const blockquote = node as Blockquote
      const content = blockquote.children
        .map((child) => nodeToPlainText(child).replace(/^/gm, '> '))
        .join('')
      return `${content}\n\n`
    }

    case 'code': {
      const code = node as Code
      const header = code.lang ? `\`\`\`${code.lang}\n` : '```\n'
      return `${header}${code.value}\n\`\`\`\n\n`
    }

    case 'break':
      return '\n'

    case 'thematicBreak':
      return '---\n\n'

    case 'link': {
      const link = node as Link
      const label =
        link.children.length > 0
          ? getChildrenText(link.children as MarkdownNode[])
          : link.url
      return label
    }

    case 'table': {
      const table = node as Table
      return (
        table.children
          .map((row) => {
            const cells = (row as TableRow).children as TableCell[]
            return cells.map((cell) => nodeToPlainText(cell)).join(' | ')
          })
          .join('\n') + '\n\n'
      )
    }

    case 'tableRow':
      return (node as TableRow).children.map(nodeToPlainText).join(' | ')

    case 'tableCell':
      return getChildrenText((node as TableCell).children as MarkdownNode[])

    case 'delete': {
      // Strikethrough - just return the text content
      const deleteNode = node as { children?: MarkdownNode[] }
      if (Array.isArray(deleteNode.children)) {
        return getChildrenText(deleteNode.children)
      }
      return ''
    }

    default: {
      const nodeWithChildren = node as { children?: MarkdownNode[] }
      if (Array.isArray(nodeWithChildren.children)) {
        return getChildrenText(nodeWithChildren.children)
      }
      return ''
    }
  }
}

// Unified trim helper with predicate
export const trimTrailingNodes = (
  nodes: ReactNode[],
  predicate: (node: ReactNode) => boolean,
): ReactNode[] => {
  let end = nodes.length
  while (end > 0 && predicate(nodes[end - 1])) {
    end -= 1
  }
  return end === nodes.length ? nodes : nodes.slice(0, end)
}

export const trimTrailingWhitespaceNodes = (
  nodes: ReactNode[],
): ReactNode[] => {
  return trimTrailingNodes(
    nodes,
    (node) => typeof node === 'string' && node.trim().length === 0,
  )
}

export const trimTrailingBreaks = (nodes: ReactNode[]): ReactNode[] => {
  return trimTrailingNodes(
    nodes,
    (node) => typeof node === 'string' && /^\n+$/.test(node),
  )
}

export const splitNodesByNewline = (nodes: ReactNode[]): ReactNode[][] => {
  const lines: ReactNode[][] = [[]]
  nodes.forEach((node) => {
    if (typeof node === 'string') {
      const parts = node.split('\n')
      parts.forEach((part, idx) => {
        if (part.length > 0) {
          lines[lines.length - 1].push(part)
        }
        if (idx < parts.length - 1) {
          lines.push([])
        }
      })
    } else {
      lines[lines.length - 1].push(node)
    }
  })
  return lines
}

/**
 * Wraps text to fit within a specified width, returning an array of lines.
 * Uses stringWidth to properly measure Unicode and wide characters.
 * Performs word-wrapping where possible, falling back to character-level
 * breaking for words that exceed the column width.
 */
export const wrapText = (text: string, maxWidth: number): string[] => {
  if (maxWidth < 1) return ['']
  if (!text) return ['']
  const textWidth = stringWidth(text)
  if (textWidth <= maxWidth) return [text]

  const lines: string[] = []
  let currentLine = ''
  let currentWidth = 0
  const tokens = text.split(/(\s+)/)

  for (const token of tokens) {
    if (!token) continue
    const tokenWidth = stringWidth(token)
    const isWhitespace = /^\s+$/.test(token)

    // Skip leading whitespace on new lines
    if (isWhitespace && currentWidth === 0) continue

    if (tokenWidth > maxWidth && !isWhitespace) {
      // Break long words character by character
      for (const char of token) {
        const charWidth = stringWidth(char)
        // A wide grapheme cannot be split across terminal cells. Replace it
        // with a single-cell marker at the narrowest budget so the renderer
        // never emits a row wider than its owner.
        const fittedChar = charWidth > maxWidth ? '·' : char
        const fittedWidth = stringWidth(fittedChar)
        if (currentWidth + fittedWidth > maxWidth) {
          if (currentLine) lines.push(currentLine)
          currentLine = fittedChar
          currentWidth = fittedWidth
        } else {
          currentLine += fittedChar
          currentWidth += fittedWidth
        }
      }
    } else if (currentWidth + tokenWidth > maxWidth) {
      if (currentLine) lines.push(currentLine.trimEnd())
      currentLine = isWhitespace ? '' : token
      currentWidth = isWhitespace ? 0 : tokenWidth
    } else {
      currentLine += token
      currentWidth += tokenWidth
    }
  }

  if (currentLine) lines.push(currentLine.trimEnd())
  return lines.length > 0 ? lines : ['']
}

/**
 * Pads text to reach exact width using spaces.
 */
export const padText = (text: string, targetWidth: number): string => {
  const currentWidth = stringWidth(text)
  if (currentWidth >= targetWidth) return text
  return text + ' '.repeat(targetWidth - currentWidth)
}
