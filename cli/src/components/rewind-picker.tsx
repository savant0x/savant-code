import { useKeyboard } from '@opentui/react'
import { useCallback } from 'react'

import { Button } from './button'
import { useTheme } from '../hooks/use-theme'
import { REWIND_MODES } from '../state/rewind-picker-store'

import type { RewindMode } from '../state/rewind-picker-store'
import type { KeyEvent } from '@opentui/core'
import type { TurnSummary } from '@savant-code/sdk'

interface RewindPickerProps {
  turns: TurnSummary[]
  selectedIndex: number
  stage: 'choose' | 'mode'
  mode: RewindMode
  onSelectIndex: (index: number) => void
  onSetStage: (stage: 'choose' | 'mode') => void
  onSetMode: (mode: RewindMode) => void
  onConfirm: (turn: TurnSummary, mode: RewindMode) => void
  onClose: () => void
}

function formatRelativeTime(timestamp: number, now: number): string {
  const diffMs = Math.max(0, now - timestamp)
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function truncatePrompt(prompt: string | undefined, max: number): string {
  if (!prompt) return '(no prompt)'
  const singleLine = prompt.replace(/\s+/g, ' ').trim()
  return singleLine.length > max
    ? singleLine.slice(0, max - 1).trimEnd() + '…'
    : singleLine
}

function formatTouchedPaths(paths: string[]): string {
  if (paths.length === 0) return 'no files touched'
  if (paths.length === 1) {
    const base = paths[0].split(/[\\/]/).pop() ?? paths[0]
    return `1 file: ${base}`
  }
  const first = paths[0].split(/[\\/]/).pop() ?? paths[0]
  return `${paths.length} files: ${first} +${paths.length - 1}`
}

/**
 * FID-2026-0803-004 — interactive /rewind picker overlay.
 *
 * Stage 'choose' lists persisted turn checkpoints (prompt · time · touched
 * files); Enter selects a turn. Stage 'mode' offers the restore modes
 * (code / conversation / both / fork); Enter confirms, Esc goes back.
 * Keyboard pattern matches ModelPicker/ProviderPicker.
 */
export const RewindPicker: React.FC<RewindPickerProps> = ({
  turns,
  selectedIndex,
  stage,
  mode,
  onSelectIndex,
  onSetStage,
  onSetMode,
  onConfirm,
  onClose,
}) => {
  const theme = useTheme()

  const commit = useCallback(
    (index: number) => {
      const turn = turns[index]
      if (turn) onSetStage('mode')
    },
    [turns, onSetStage],
  )

  const confirm = useCallback(() => {
    const turn = turns[selectedIndex]
    if (turn) onConfirm(turn, mode)
  }, [turns, selectedIndex, mode, onConfirm])

  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        const name = key.name ?? ''
        const prevent = () => {
          key.preventDefault?.()
          key.stopPropagation?.()
        }
        if (name === 'escape' || (key.ctrl && name === 'c')) {
          prevent()
          if (stage === 'mode') {
            onSetStage('choose')
          } else {
            onClose()
          }
          return
        }
        if (stage === 'choose') {
          if (name === 'up' || (name === 'tab' && key.shift)) {
            prevent()
            onSelectIndex((selectedIndex - 1 + turns.length) % turns.length)
            return
          }
          if (name === 'down' || (name === 'tab' && !key.shift)) {
            prevent()
            onSelectIndex((selectedIndex + 1) % turns.length)
            return
          }
          if (name === 'return' || name === 'enter') {
            prevent()
            commit(selectedIndex)
            return
          }
        } else {
          // stage === 'mode'
          if (name === 'up' || (name === 'tab' && key.shift)) {
            prevent()
            const idx =
              (REWIND_MODES.findIndex((m) => m.id === mode) -
                1 +
                REWIND_MODES.length) %
              REWIND_MODES.length
            onSetMode(REWIND_MODES[idx].id)
            return
          }
          if (name === 'down' || (name === 'tab' && !key.shift)) {
            prevent()
            const idx =
              (REWIND_MODES.findIndex((m) => m.id === mode) + 1) %
              REWIND_MODES.length
            onSetMode(REWIND_MODES[idx].id)
            return
          }
          if (name === 'return' || name === 'enter') {
            prevent()
            confirm()
            return
          }
        }
      },
      [
        stage,
        mode,
        selectedIndex,
        turns.length,
        onSelectIndex,
        onSetStage,
        onSetMode,
        onClose,
        commit,
        confirm,
      ],
    ),
  )

  const now = Date.now()
  const selectedTurn = turns[selectedIndex]

  return (
    <box
      style={{
        flexDirection: 'column',
        width: 60,
        backgroundColor: theme.surface,
        borderStyle: 'single',
        borderColor: theme.border,
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      <text style={{ fg: theme.muted, wrapMode: 'none' }}>
        {stage === 'choose'
          ? 'Rewind to before a turn (↑/↓, Enter, Esc)'
          : `Restore turn → ${truncatePrompt(selectedTurn?.prompt, 40)}`}
      </text>

      {stage === 'choose' ? (
        turns.map((turn, idx) => {
          const isSelected = idx === selectedIndex
          return (
            <Button
              key={turn.turnId}
              onClick={() => commit(idx)}
              style={{
                width: '100%',
                paddingLeft: 1,
                paddingRight: 1,
                backgroundColor: isSelected
                  ? theme.surfaceHover
                  : theme.surface,
                flexDirection: 'column',
                gap: 0,
              }}
            >
              <box flexDirection="row" gap={1} alignItems="center">
                <text fg={theme.primary} wrapMode="none" selectable={false}>
                  {isSelected ? '› ' : '  '}
                </text>
                <text
                  fg={isSelected ? theme.foreground : theme.muted}
                  attributes={isSelected ? 1 : 0}
                  wrapMode="none"
                  selectable={false}
                >
                  {truncatePrompt(turn.prompt, 42)}
                </text>
                <text fg={theme.muted} wrapMode="none" selectable={false}>
                  {formatRelativeTime(turn.startedAt, now)}
                </text>
              </box>
              <box
                flexDirection="row"
                gap={1}
                alignItems="center"
                paddingLeft={2}
              >
                <text fg={theme.muted} wrapMode="none" selectable={false}>
                  {formatTouchedPaths(turn.paths)}
                </text>
              </box>
            </Button>
          )
        })
      ) : (
        <box flexDirection="column" paddingLeft={1}>
          {REWIND_MODES.map((m) => {
            const isSelected = m.id === mode
            return (
              <Button
                key={m.id}
                onClick={() => {
                  onSetMode(m.id)
                  confirm()
                }}
                style={{
                  width: '100%',
                  paddingLeft: 1,
                  paddingRight: 1,
                  backgroundColor: isSelected
                    ? theme.surfaceHover
                    : theme.surface,
                  flexDirection: 'row',
                  gap: 1,
                  alignItems: 'center',
                }}
              >
                <text fg={theme.primary} wrapMode="none" selectable={false}>
                  {isSelected ? '› ' : '  '}
                </text>
                <text
                  fg={isSelected ? theme.foreground : theme.muted}
                  attributes={isSelected ? 1 : 0}
                  wrapMode="none"
                  selectable={false}
                >
                  {m.label}
                </text>
              </Button>
            )
          })}
          <text style={{ fg: theme.muted, wrapMode: 'none' }}>
            Enter to restore · Esc to go back
          </text>
        </box>
      )}
    </box>
  )
}
