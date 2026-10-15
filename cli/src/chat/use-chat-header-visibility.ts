/**
 * Pinned-header visibility tracking for the chat screen (FID-2026-0805-003).
 * Extracted from chat.tsx verbatim: the header scroll-intersection check and
 * its scrollbar/refresh effects.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import type { ChatMessage } from '../types/chat'
import type { BoxRenderable, ScrollBoxRenderable } from '@opentui/core'
import type { MutableRefObject } from 'react'

export interface UseChatHeaderVisibilityArgs {
  scrollRef: MutableRefObject<ScrollBoxRenderable | null>
  messages: ChatMessage[]
  terminalHeight: number
  terminalWidth: number
}

export interface UseChatHeaderVisibilityReturn {
  headerRef: MutableRefObject<BoxRenderable | null>
  isHeaderVisible: boolean
}

export function useChatHeaderVisibility({
  scrollRef,
  messages,
  terminalHeight,
  terminalWidth,
}: UseChatHeaderVisibilityArgs): UseChatHeaderVisibilityReturn {
  const headerRef = useRef<BoxRenderable | null>(null)
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)

  const updateHeaderVisibility = useCallback(() => {
    const header = headerRef.current
    const viewport = scrollRef.current?.viewport
    if (!header || !viewport) return

    const headerTop = header.screenY
    const headerBottom = headerTop + header.height
    const viewportTop = viewport.screenY
    const viewportBottom = viewportTop + viewport.height
    const visible = headerTop < viewportBottom && headerBottom > viewportTop
    setIsHeaderVisible((current) => (current === visible ? current : visible))
  }, [scrollRef])

  useEffect(() => {
    const scrollbox = scrollRef.current
    if (!scrollbox) return

    const timeoutId = setTimeout(updateHeaderVisibility, 0)
    scrollbox.verticalScrollBar.on('change', updateHeaderVisibility)
    return () => {
      clearTimeout(timeoutId)
      scrollbox.verticalScrollBar.off('change', updateHeaderVisibility)
    }
  }, [scrollRef, updateHeaderVisibility])

  useEffect(() => {
    const timeoutId = setTimeout(updateHeaderVisibility, 0)
    return () => clearTimeout(timeoutId)
  }, [messages, terminalHeight, terminalWidth, updateHeaderVisibility])

  return { headerRef, isHeaderVisible }
}
