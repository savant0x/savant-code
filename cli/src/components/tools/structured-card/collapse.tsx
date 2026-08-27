import React, { useState } from 'react'

import { MutedText } from './hierarchy'
import { Button } from '../../button'

import type { ChatTheme } from '../../../types/theme-system'
import type { ReactNode } from 'react'

/**
 * FID-2026-0822-014 — receipt-collapse for long payloads: beyond
 * COLLAPSE_ITEM_THRESHOLD rows only the first rows render plus an expand
 * toggle. Expanded state is local per card instance; expand/collapse snaps
 * (no animation — reduced-motion by construction).
 */
export const COLLAPSE_ITEM_THRESHOLD = 8

interface ReceiptCollapseProps {
  items: ReactNode[]
  theme: ChatTheme
}

export function ReceiptCollapse({
  items,
  theme,
}: ReceiptCollapseProps): ReactNode {
  const [expanded, setExpanded] = useState(false)
  const overflow = items.length - COLLAPSE_ITEM_THRESHOLD
  const collapsed = !expanded && overflow > 0

  if (!collapsed) {
    return (
      <box style={{ flexDirection: 'column', gap: 0 }}>
        {items}
        {overflow > 0 && (
          <Button
            onClick={() => setExpanded(false)}
            style={{
              paddingLeft: 0,
              paddingRight: 0,
              paddingTop: 0,
              paddingBottom: 0,
            }}
          >
            <MutedText theme={theme}>[show less]</MutedText>
          </Button>
        )}
      </box>
    )
  }

  return (
    <box style={{ flexDirection: 'column', gap: 0 }}>
      {items.slice(0, COLLAPSE_ITEM_THRESHOLD)}
      <Button
        onClick={() => setExpanded(true)}
        style={{
          paddingLeft: 0,
          paddingRight: 0,
          paddingTop: 0,
          paddingBottom: 0,
        }}
      >
        <MutedText theme={theme}>{`[${overflow} more — expand]`}</MutedText>
      </Button>
    </box>
  )
}
