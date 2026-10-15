import { useEffect } from 'react'

import type { Dispatch, SetStateAction } from 'react'

/**
 * Keyboard handling for the session viewer: q/Ctrl+C quit, arrows/vim-key
 * navigation, space play/pause, +/- speed, r restart. Manual navigation
 * stops playback. Verbatim move of the original effect body; the only
 * contract change is `captures.length` -> `capturesLength` and threading
 * the two state setters through parameters (both stable across renders).
 */
export function useViewerKeyboard(
  capturesLength: number,
  onExit: () => void,
  setSelectedIndex: Dispatch<SetStateAction<number>>,
  setIsPlaying: Dispatch<SetStateAction<boolean>>,
  togglePlay: () => void,
  increaseSpeed: () => void,
  decreaseSpeed: () => void,
): void {
  useEffect(() => {
    const handleKey = (key: string) => {
      // Quit: q or Ctrl+C
      if (key === 'q' || key === '\x03') {
        onExit()
        return
      }

      // Space: toggle play/pause
      if (key === ' ') {
        togglePlay()
        return
      }

      // +/= : increase speed (faster)
      if (key === '+' || key === '=') {
        increaseSpeed()
        return
      }

      // -/_ : decrease speed (slower)
      if (key === '-' || key === '_') {
        decreaseSpeed()
        return
      }

      // r: restart from beginning
      if (key === 'r') {
        setSelectedIndex(0)
        return
      }

      if (capturesLength === 0) {
        return
      }

      // Stop playback on manual navigation
      const stopAndNavigate = () => {
        setIsPlaying(false)
      }

      // Left: arrow left or h => previous capture
      if (key === '\x1b[D' || key === 'h') {
        stopAndNavigate()
        setSelectedIndex((prev) => Math.max(0, prev - 1))
        return
      }

      // Right: arrow right or l => next capture
      if (key === '\x1b[C' || key === 'l') {
        stopAndNavigate()
        setSelectedIndex((prev) =>
          Math.min(capturesLength - 1, Math.max(0, prev + 1)),
        )
      }
    }

    const stdin = process.stdin as NodeJS.ReadStream
    const onData = (chunk: Buffer) => {
      handleKey(chunk.toString())
    }

    stdin.setRawMode?.(true)
    stdin.resume()
    stdin.on('data', onData)

    return () => {
      // Remove only this listener to avoid interfering with other handlers
      if (typeof stdin.off === 'function') {
        stdin.off('data', onData)
      } else {
        stdin.removeListener('data', onData)
      }
    }
  }, [
    capturesLength,
    onExit,
    setSelectedIndex,
    setIsPlaying,
    togglePlay,
    increaseSpeed,
    decreaseSpeed,
  ])
}
