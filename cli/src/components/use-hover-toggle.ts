import { useEffect, useRef, useState } from 'react'

export const OPEN_DELAY_MS = 0 // Delay before expanding on hover
export const CLOSE_DELAY_MS = 250 // Delay before collapsing when mouse leaves
export const REOPEN_SUPPRESS_MS = 250 // Time to block reopening after explicit close (prevents flicker)

/**
 * Manages the open/close state with hover delays and reopen suppression.
 * Provides timer-based state transitions to create smooth hover interactions.
 */
export function useHoverToggle() {
  const [isOpen, setIsOpen] = useState(false)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const openTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reopenBlockedUntilRef = useRef<number>(0)

  // Timer cleanup helpers
  const clearOpenTimer = () => {
    clearTimeout(openTimeoutRef.current!)
    openTimeoutRef.current = null
  }

  const clearCloseTimer = () => {
    clearTimeout(closeTimeoutRef.current!)
    closeTimeoutRef.current = null
  }

  const clearAllTimers = () => {
    clearOpenTimer()
    clearCloseTimer()
  }

  // State transition actions
  const openNow = () => {
    clearAllTimers()
    setIsOpen(true)
  }

  const closeNow = (suppressReopen = false) => {
    clearAllTimers()
    setIsOpen(false)
    if (suppressReopen) {
      reopenBlockedUntilRef.current = Date.now() + REOPEN_SUPPRESS_MS
    }
  }

  const scheduleOpen = () => {
    if (isOpen) return
    if (Date.now() < reopenBlockedUntilRef.current) return

    clearOpenTimer()
    openTimeoutRef.current = setTimeout(() => {
      openNow()
    }, OPEN_DELAY_MS)
  }

  const scheduleClose = () => {
    if (!isOpen) return

    clearCloseTimer()
    closeTimeoutRef.current = setTimeout(() => {
      closeNow()
    }, CLOSE_DELAY_MS)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => clearAllTimers()
  }, [])

  return {
    isOpen,
    openNow,
    closeNow,
    scheduleOpen,
    scheduleClose,
    // Expose individual timer clear helpers so callers can
    // cancel the opposite pending action during hover transitions.
    // These were used by the component but not returned previously,
    // causing runtime errors when hover events fired.
    clearOpenTimer,
    clearCloseTimer,
    clearAllTimers,
  }
}
