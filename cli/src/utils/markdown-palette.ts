import type { MarkdownPalette } from './markdown-types'

export const defaultPalette: MarkdownPalette = {
  inlineCodeFg: 'green',
  codeBackground: 'black',
  codeHeaderFg: 'gray',
  headingFg: {
    1: 'green',
    2: 'green',
    3: 'green',
    4: 'green',
    5: 'green',
    6: 'green',
  },
  listBulletFg: 'white',
  blockquoteBorderFg: 'gray',
  blockquoteTextFg: 'gray',
  dividerFg: 'gray',
  codeTextFg: 'white',
  codeMonochrome: false,
  linkFg: 'blue',
}

export const resolvePalette = (
  base: MarkdownPalette = defaultPalette,
  overrides?: Partial<MarkdownPalette>,
): MarkdownPalette => {
  const palette: MarkdownPalette = {
    ...base,
    headingFg: { ...base.headingFg },
  }

  if (!overrides) {
    return palette
  }

  const { headingFg, ...rest } = overrides
  Object.assign(palette, rest)

  if (headingFg) {
    palette.headingFg = {
      ...palette.headingFg,
      ...headingFg,
    }
  }

  return palette
}
