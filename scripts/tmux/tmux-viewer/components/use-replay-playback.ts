import { useCallback, useEffect, useRef, useState } from 'react'

import type { Dispatch, SetStateAction } from 'react'

// Available playback speeds (seconds per capture)
const PLAYBACK_SPEEDS = [0.5, 1.0, 1.5, 2.0, 3.0, 5.0]
const DEFAULT_SPEED_INDEX = 2 // 1.5 seconds

/**
 * Replay playback state for the session viewer: selected capture index,
 * play/pause with auto-advance, and speed control. `capturesLength` is the
 * only input the replay logic needs from the capture list.
 */
export function useReplayPlayback(
  capturesLength: number,
  startInReplayMode: boolean,
): {
  selectedIndex: number
  setSelectedIndex: Dispatch<SetStateAction<number>>
  isPlaying: boolean
  setIsPlaying: Dispatch<SetStateAction<boolean>>
  playbackSpeed: number
  togglePlay: () => void
  increaseSpeed: () => void
  decreaseSpeed: () => void
} {
  const [selectedIndex, setSelectedIndex] = useState(() =>
    capturesLength > 0 ? 0 : -1,
  )

  // Replay state
  const [isPlaying, setIsPlaying] = useState(startInReplayMode)
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX)
  const playbackSpeed = PLAYBACK_SPEEDS[speedIndex]
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-advance effect for replay mode
  useEffect(() => {
    if (!isPlaying || capturesLength === 0) {
      return
    }

    timerRef.current = setTimeout(() => {
      setSelectedIndex((prev) => {
        const next = prev + 1
        if (next >= capturesLength) {
          // Reached the end, stop playing
          setIsPlaying(false)
          return prev
        }
        return next
      })
    }, playbackSpeed * 1000)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isPlaying, selectedIndex, playbackSpeed, capturesLength])

  // Replay control functions
  const togglePlay = useCallback(() => {
    if (capturesLength === 0) return
    // If at end and pressing play, restart from beginning
    if (!isPlaying && selectedIndex >= capturesLength - 1) {
      setSelectedIndex(0)
    }
    setIsPlaying((prev) => !prev)
  }, [capturesLength, isPlaying, selectedIndex])

  const increaseSpeed = useCallback(() => {
    setSpeedIndex((prev) => Math.max(0, prev - 1)) // Lower index = faster
  }, [])

  const decreaseSpeed = useCallback(() => {
    setSpeedIndex((prev) => Math.min(PLAYBACK_SPEEDS.length - 1, prev + 1))
  }, [])

  return {
    selectedIndex,
    setSelectedIndex,
    isPlaying,
    setIsPlaying,
    playbackSpeed,
    togglePlay,
    increaseSpeed,
    decreaseSpeed,
  }
}
