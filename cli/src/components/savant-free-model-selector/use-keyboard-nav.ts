import { useKeyboard } from '@opentui/react'
import { useCallback } from 'react'

import { TOGGLE_ID } from './layout'
import {
  nextSavantFreeModelId,
  savantFreeModelNavigationDirectionForKey,
} from '../../utils/savant-free-model-navigation'
import { isPlainEnterKey } from '../../utils/terminal-enter-detection'

import type { SavantFreeReferralFocusTarget } from '../savant-free-referral-banner'
import type { KeyEvent } from '@opentui/core'

/** Keyboard handling for the model picker: Tab / Shift+Tab and arrow keys move
 *  the focus highlight only; Enter or Space commits the focused row (or fires
 *  the toggle). Two-step navigation lets the user preview the highlight before
 *  committing. */
export function useModelSelectorKeyboard(opts: {
  pending: string | null
  focusedId: string
  committedModelId: string | null
  navIds: readonly string[]
  extraTargets: readonly SavantFreeReferralFocusTarget[]
  isJoinable: (modelId: string) => boolean
  onPick: (modelId: string) => void
  onFocus: (modelId: string) => void
  onToggle: () => void
}): void {
  const {
    pending,
    focusedId,
    committedModelId,
    navIds,
    extraTargets,
    isJoinable,
    onPick,
    onFocus,
    onToggle,
  } = opts
  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        if (pending) return
        const name = key.name ?? ''
        const direction = savantFreeModelNavigationDirectionForKey(key)
        // Use the shared Enter detector so the keypad Enter and the niche
        // Linux terminals that send \n (linefeed) for Enter also commit; a
        // raw name === 'return' check silently ignores those, which looks
        // like a frozen menu (arrows move the highlight, Enter does nothing).
        const isCommit = isPlainEnterKey(key) || name === 'space'
        if (isCommit) {
          if (focusedId === TOGGLE_ID) {
            key.preventDefault?.()
            key.stopPropagation?.()
            onToggle()
            return
          }
          // A referral-banner button (copy invite link / use GLM) is focused —
          // fire its registered action instead of joining a queue.
          const extraTarget = extraTargets.find((t) => t.id === focusedId)
          if (extraTarget) {
            key.preventDefault?.()
            key.stopPropagation?.()
            extraTarget.activate()
            return
          }
          if (isJoinable(focusedId) && focusedId !== committedModelId) {
            key.preventDefault?.()
            key.stopPropagation?.()
            onPick(focusedId)
          }
          return
        }
        if (!direction) return
        const targetId = nextSavantFreeModelId({
          modelIds: navIds,
          focusedId,
          direction,
        })
        if (targetId) {
          key.preventDefault?.()
          key.stopPropagation?.()
          onFocus(targetId)
        }
      },
      [
        pending,
        focusedId,
        committedModelId,
        navIds,
        extraTargets,
        isJoinable,
        onPick,
        onFocus,
        onToggle,
      ],
    ),
  )
}
