import { TAB_WIDTH } from './text-utils'

export function computeRenderValues(opts: {
  value: string
  placeholder: string
  cursorPosition: number
  focused: boolean
  maskInput: boolean
}): {
  isPlaceholder: boolean
  displayValue: string
  renderedValue: string
  displayValueForRendering: string
  renderCursorPosition: number
  beforeCursor: string
  afterCursor: string
  activeChar: string
  shouldHighlight: boolean
  showCursor: boolean
} {
  const { value, placeholder, cursorPosition, focused, maskInput } = opts

  const isPlaceholder = value.length === 0 && placeholder.length > 0
  const displayValue = isPlaceholder ? placeholder : value
  const renderedValue =
    maskInput && !isPlaceholder ? '•'.repeat(value.length) : displayValue
  const showCursor = focused

  // Replace tabs with spaces for proper rendering
  const displayValueForRendering = renderedValue.replace(
    /\t/g,
    ' '.repeat(TAB_WIDTH),
  )

  // Calculate cursor position in the expanded string (accounting for tabs)
  let renderCursorPosition = 0
  for (let i = 0; i < cursorPosition && i < displayValue.length; i++) {
    renderCursorPosition += displayValue[i] === '\t' ? TAB_WIDTH : 1
  }

  let beforeCursor = ''
  let afterCursor = ''
  let activeChar = ' '
  let shouldHighlight = false

  if (showCursor) {
    beforeCursor = displayValueForRendering.slice(0, renderCursorPosition)
    afterCursor = displayValueForRendering.slice(renderCursorPosition)
    activeChar = afterCursor.charAt(0) || ' '
    shouldHighlight =
      !isPlaceholder &&
      renderCursorPosition < displayValueForRendering.length &&
      displayValue[cursorPosition] !== '\n' &&
      displayValue[cursorPosition] !== '\t'
  }

  return {
    isPlaceholder,
    displayValue,
    renderedValue,
    displayValueForRendering,
    renderCursorPosition,
    beforeCursor,
    afterCursor,
    activeChar,
    shouldHighlight,
    showCursor,
  }
}
