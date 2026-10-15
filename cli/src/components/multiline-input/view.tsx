import { TextAttributes } from '@opentui/core'

import { createChatScrollbarOptions } from '../../chat/styles'
import { supportsTruecolor } from '../../utils/theme-system'
import { InputCursor } from '../input-cursor'

import type { LayoutMetrics } from './metrics'
import type { ChatTheme } from '../../types/theme-system'
import type {
  MouseEvent,
  PasteEvent,
  ScrollBoxRenderable,
  TextRenderable,
} from '@opentui/core'
import type { RefObject } from 'react'

export type MultilineViewProps = {
  scrollBoxRef: RefObject<ScrollBoxRenderable | null>
  textRef: RefObject<TextRenderable | null>
  showScrollbar: boolean
  layoutMetrics: LayoutMetrics
  onScrollboxPaste: (event: PasteEvent) => void
  onMouseDown: (event: MouseEvent) => void
  displayValueForRendering: string
  showCursor: boolean
  beforeCursor: string
  afterCursor: string
  activeChar: string
  shouldHighlight: boolean
  focused: boolean
  maskInput: boolean
  lastActivity: number
  effectiveShouldBlinkCursor: boolean
  inputColor: string
  highlightBg: string
  theme: ChatTheme
}

/**
 * Presentational render of the multiline input scrollbox (FID-2026-0805-003).
 * Extracted from multiline-input.tsx verbatim; all logic stays in the parent.
 */
export function MultilineView(props: MultilineViewProps) {
  const {
    scrollBoxRef,
    textRef,
    showScrollbar,
    layoutMetrics,
    onScrollboxPaste,
    onMouseDown,
    displayValueForRendering,
    showCursor,
    beforeCursor,
    afterCursor,
    activeChar,
    shouldHighlight,
    focused,
    maskInput,
    lastActivity,
    effectiveShouldBlinkCursor,
    inputColor,
    highlightBg,
    theme,
  } = props

  return (
    <scrollbox
      ref={scrollBoxRef}
      scrollX={false}
      stickyScroll={true}
      stickyStart="bottom"
      scrollbarOptions={{ visible: false }}
      verticalScrollbarOptions={{
        visible: showScrollbar && layoutMetrics.isScrollable,
        ...createChatScrollbarOptions(theme),
      }}
      onPaste={onScrollboxPaste}
      onMouseDown={onMouseDown}
      style={{
        flexGrow: 0,
        flexShrink: 0,
        rootOptions: {
          width: '100%',
          height: layoutMetrics.heightLines,
          backgroundColor: 'transparent',
          flexGrow: 0,
          flexShrink: 0,
        },
        wrapperOptions: {
          paddingLeft: 1,
          paddingRight: 1,
          border: false,
        },
        contentOptions: {
          justifyContent: 'flex-start',
        },
      }}
    >
      <text
        ref={textRef}
        style={{ bg: 'transparent', fg: inputColor, wrapMode: 'word' }}
      >
        {showCursor ? (
          <>
            {beforeCursor}
            {shouldHighlight ? (
              <span
                bg={highlightBg}
                fg={theme.background}
                attributes={TextAttributes.BOLD}
              >
                {activeChar === ' ' ? '\u00a0' : activeChar}
              </span>
            ) : (
              <InputCursor
                visible={true}
                focused={focused}
                shouldBlink={effectiveShouldBlinkCursor}
                color={
                  supportsTruecolor()
                    ? maskInput
                      ? theme.muted
                      : theme.info
                    : 'lime'
                }
                key={lastActivity}
              />
            )}
            {shouldHighlight
              ? afterCursor.length > 0
                ? afterCursor.slice(1)
                : ''
              : afterCursor}
            {layoutMetrics.gutterEnabled ? '\n' : ''}
          </>
        ) : (
          <>
            {displayValueForRendering}
            {layoutMetrics.gutterEnabled ? '\n' : ''}
          </>
        )}
      </text>
    </scrollbox>
  )
}
