import React, { memo } from 'react'

import { CopyButton } from './copy-button'

interface CopyableBlockProps {
  /** Returns the plain text to copy when the button is clicked */
  getCopyText: () => string
  /** Optional icon override for the copy button */
  copyButtonIcon?: string
  /** Content to render above the copy button */
  children: React.ReactNode
  /** If true, the copy button is hidden (e.g. while streaming) */
  isStreaming?: boolean
  /**
   * FID-2026-0804-010: optional node rendered in the bottom-right footer row,
   * immediately left of the copy button (e.g. the edit `[-N/+M]` counter).
   */
  footerLeft?: React.ReactNode
}

/**
 * CopyableBlock — universal wrapper that adds a copy affordance to a block.
 *
 * The children are rendered normally; a small copy button is placed in a
 * right-aligned footer row. OpenTUI does not support absolute positioning,
 * so we use a flex column with a trailing row.
 *
 * FID-2026-0725-087
 */
export const CopyableBlock = memo(function CopyableBlock({
  getCopyText,
  copyButtonIcon,
  children,
  isStreaming = false,
  footerLeft,
}: CopyableBlockProps) {
  return (
    <box style={{ flexDirection: 'column', width: '100%' }}>
      {children}
      {!isStreaming && (
        <box
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            width: '100%',
          }}
        >
          {footerLeft}
          <CopyButton getCopyText={getCopyText} icon={copyButtonIcon} />
        </box>
      )}
    </box>
  )
})
