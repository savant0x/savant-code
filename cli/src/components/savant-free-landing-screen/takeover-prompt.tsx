import { TextAttributes } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import React, { useCallback, useState } from 'react'

import { takeOverSavantFreeSession } from '../../hooks/use-savant-free-session'
import { useTheme } from '../../hooks/use-theme'
import { exitSavantFreeCleanly } from '../../utils/savant-free-exit'
import { isPlainEnterKey } from '../../utils/terminal-enter-detection'
import { INVERTED_CTA_FG } from '../../utils/ui-constants'
import { Button } from '../button'

import type { KeyEvent } from '@opentui/core'

export const TakeoverPrompt: React.FC = () => {
  const theme = useTheme()
  const [pending, setPending] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(0) // 0 = Take over, 1 = Exit
  const handleTakeover = useCallback(() => {
    if (pending) return
    setPending(true)
    takeOverSavantFreeSession().finally(() => setPending(false))
  }, [pending])
  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        const name = key.name ?? ''
        const isConfirm = isPlainEnterKey(key)
        const isExit = name === 'escape' || name === 'esc'
        const isTab = name === 'tab'
        const isShiftTab = key.shift === true && isTab
        const isRight = name === 'right'
        const isLeft = name === 'left'
        if (isExit) {
          key.preventDefault?.()
          exitSavantFreeCleanly()
          return
        }
        if (isConfirm) {
          key.preventDefault?.()
          if (focusedIndex === 0) {
            handleTakeover()
          } else {
            exitSavantFreeCleanly()
          }
          return
        }
        if (isRight || isTab) {
          key.preventDefault?.()
          setFocusedIndex((prev) => (prev + 1) % 2)
          return
        }
        if (isLeft || isShiftTab) {
          key.preventDefault?.()
          setFocusedIndex((prev) => (prev - 1 + 2) % 2)
          return
        }
      },
      [focusedIndex, handleTakeover],
    ),
  )
  const isTakeoverFocused = focusedIndex === 0
  const isExitFocused = focusedIndex === 1
  return (
    <box
      style={{
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        width: '100%',
      }}
    >
      <text style={{ fg: theme.foreground }} attributes={TextAttributes.BOLD}>
        SavantFree is already running
      </text>

      <text style={{ fg: theme.muted }}>
        Only one savant-free instance is allowed at a time.
      </text>

      <box style={{ flexDirection: 'row', gap: 2, marginTop: 1 }}>
        <Button
          onClick={handleTakeover}
          onMouseOver={() => setFocusedIndex(0)}
          style={{ paddingLeft: 1, paddingRight: 1 }}
          border={['top', 'bottom', 'left', 'right']}
          borderStyle="single"
          borderColor={theme.primary}
        >
          <text
            style={{
              // theme.background is 'transparent' and can't serve as inverted
              // text — on the green fill it renders the label invisible.
              fg: isTakeoverFocused ? INVERTED_CTA_FG : theme.foreground,
              bg: isTakeoverFocused ? theme.primary : undefined,
            }}
            attributes={TextAttributes.BOLD}
          >
            {pending ? 'Taking over...' : 'Take over'}
          </text>
        </Button>
        <Button
          onClick={exitSavantFreeCleanly}
          onMouseOver={() => setFocusedIndex(1)}
          style={{ paddingLeft: 1, paddingRight: 1 }}
          border={['top', 'bottom', 'left', 'right']}
          borderStyle="single"
          borderColor={isExitFocused ? theme.foreground : theme.muted}
        >
          <text
            style={{ fg: isExitFocused ? theme.foreground : theme.muted }}
            attributes={
              isExitFocused ? TextAttributes.BOLD : TextAttributes.NONE
            }
          >
            Exit
          </text>
        </Button>
      </box>
    </box>
  )
}
