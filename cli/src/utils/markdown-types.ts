import type { ChatTheme } from '../types/theme-system'
import type { SyntaxStyle } from '@opentui/core'

export interface MarkdownPalette {
  inlineCodeFg: string
  codeBackground: string
  codeHeaderFg: string
  headingFg: Record<number, string>
  listBulletFg: string
  blockquoteBorderFg: string
  blockquoteTextFg: string
  dividerFg: string
  codeTextFg: string
  codeMonochrome: boolean
  linkFg: string
}

export interface MarkdownRenderOptions {
  palette?: Partial<MarkdownPalette>
  codeBlockWidth?: number
  theme?: ChatTheme
  /**
   * Offset added to every top-level block key. A streaming render cache that
   * concatenates independently rendered chunks needs one continuing key space,
   * otherwise each chunk restarts at `markdown-block-0-*`.
   */
  blockIndexOffset?: number
  /**
   * Namespace for inner element keys (`<prefix>-<n>`). Two chunks rendered for
   * the same parent must not share a counter; the default keeps the historical
   * `markdown-<n>` keys.
   */
  keyPrefix?: string
}

export interface RenderState {
  palette: MarkdownPalette
  codeBlockWidth: number
  blockIndexOffset: number
  nextKey: () => string
  syntaxStyle?: SyntaxStyle
}

export const createRenderState = (
  palette: MarkdownPalette,
  codeBlockWidth: number,
  syntaxStyle?: SyntaxStyle,
  keyPrefix = 'markdown',
  blockIndexOffset = 0,
): RenderState => {
  let counter = 0
  return {
    palette,
    codeBlockWidth,
    blockIndexOffset,
    syntaxStyle,
    nextKey: () => {
      counter += 1
      return `${keyPrefix}-${counter}`
    },
  }
}
