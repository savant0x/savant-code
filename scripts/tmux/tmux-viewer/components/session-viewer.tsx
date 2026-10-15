/**
 * SessionViewer - Interactive TUI for viewing tmux session data
 *
 * Designed to be simple and predictable for both humans and AIs:
 * - Humans: navigate captures with arrow keys / vim keys, or use replay mode
 * - AIs: typically use the --json flag on the CLI entrypoint instead of the TUI
 *
 * Decomposition: replay state lives in `use-replay-playback.ts`, keyboard
 * handling in `use-viewer-keyboard.ts`, the timeline cluster in
 * `session-viewer-timeline.tsx`, and the header/capture/footer panels in
 * `session-viewer-panels.tsx`. This file orchestrates them.
 */

import React from 'react'

import { SessionHeader, CapturePanel, Footer } from './session-viewer-panels'
import { TimelinePanel } from './session-viewer-timeline'
import { getTheme } from './theme'
import { useReplayPlayback } from './use-replay-playback'
import { useViewerKeyboard } from './use-viewer-keyboard'

import type { Capture, SessionData } from '../types'

interface SessionViewerProps {
  data: SessionData
  onExit: () => void
  /**
   * Reserved for future use if we ever want a TUI hotkey to print JSON.
   * For now, AIs should call the CLI with --json instead.
   */
  onJsonOutput?: () => void
  /**
   * Start in replay mode (auto-playing through captures)
   */
  startInReplayMode?: boolean
}

export const SessionViewer: React.FC<SessionViewerProps> = ({
  data,
  onExit,
  startInReplayMode = false,
}) => {
  const theme = getTheme()
  const captures = data.captures

  const {
    selectedIndex,
    setSelectedIndex,
    isPlaying,
    setIsPlaying,
    playbackSpeed,
    togglePlay,
    increaseSpeed,
    decreaseSpeed,
  } = useReplayPlayback(captures.length, startInReplayMode)

  // Keyboard input handling (q/Ctrl+C to quit, arrows + vim keys to navigate, space for play/pause)
  useViewerKeyboard(
    captures.length,
    onExit,
    setSelectedIndex,
    setIsPlaying,
    togglePlay,
    increaseSpeed,
    decreaseSpeed,
  )

  const selectedCapture: Capture | undefined =
    selectedIndex >= 0 && selectedIndex < captures.length
      ? captures[selectedIndex]
      : undefined

  return (
    <box
      style={{
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        backgroundColor: theme.surface,
      }}
    >
      {/* Header */}
      <SessionHeader data={data} theme={theme} />

      {/* Main content area */}
      <box
        style={{
          flexDirection: 'column',
          flexGrow: 1,
          gap: 1,
          padding: 1,
        }}
      >
        <CapturePanel capture={selectedCapture} theme={theme} />

        <TimelinePanel
          captures={captures}
          selectedIndex={selectedIndex}
          isPlaying={isPlaying}
          theme={theme}
        />
      </box>

      {/* Footer / help text with replay controls */}
      <Footer
        theme={theme}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        currentIndex={selectedIndex}
        totalCaptures={captures.length}
      />
    </box>
  )
}
