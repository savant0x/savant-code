import { useRenderer } from '@opentui/react'
import { useEffect, useMemo, useState } from 'react'

import { subscribeSharedEvent } from '../utils/shared-event'

export const useTerminalDimensions = () => {
  const renderer = useRenderer()
  const [dimensions, setDimensions] = useState({
    width: renderer.width,
    height: renderer.height,
  })
  useEffect(() => {
    const update = () =>
      setDimensions({ width: renderer.width, height: renderer.height })
    const unsubscribe = subscribeSharedEvent(renderer, 'resize', update)
    update()
    return unsubscribe
  }, [renderer])

  const sanitizeDimension = (
    value: number | null | undefined,
  ): number | null => {
    if (typeof value !== 'number') return null
    if (!Number.isFinite(value) || value <= 0) return null
    return value
  }

  const resolvedTerminalWidth = useMemo(
    () =>
      sanitizeDimension(dimensions.width) ??
      sanitizeDimension(renderer?.width) ??
      80,
    [dimensions.width, renderer?.width],
  )

  const resolvedTerminalHeight = useMemo(
    () => sanitizeDimension(dimensions.height) ?? 24,
    [dimensions.height],
  )

  const terminalWidth = resolvedTerminalWidth
  const terminalHeight = resolvedTerminalHeight
  const separatorWidth = useMemo(
    () => Math.max(1, Math.floor(terminalWidth) - 2),
    [terminalWidth],
  )

  const contentMaxWidth = useMemo(
    () => Math.max(10, Math.min(terminalWidth - 4, 80)),
    [terminalWidth],
  )

  return {
    terminalWidth,
    terminalHeight,
    separatorWidth,
    contentMaxWidth,
  }
}
