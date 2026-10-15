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
}

export interface RenderState {
  palette: MarkdownPalette
  codeBlockWidth: number
  nextKey: () => string
  syntaxStyle?: SyntaxStyle
}

export const createRenderState = (
  palette: MarkdownPalette,
  codeBlockWidth: number,
  syntaxStyle?: SyntaxStyle,
): RenderState => {
  let counter = 0
  return {
    palette,
    codeBlockWidth,
    syntaxStyle,
    nextKey: () => {
      counter += 1
      return `markdown-${counter}`
    },
  }
}
