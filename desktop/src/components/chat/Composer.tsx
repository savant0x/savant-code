// FID-2026-0820-010 Loop 3/10 — message composer. Enter sends, Shift+Enter
// adds a newline; while a run streams, the composer swaps to an interrupt
// control. Loop 10 adds the slash-command palette: typing `/` opens a
// filtered menu (↑/↓ navigate, Enter/Tab accept, Esc dismiss, click picks);
// accepting a command executes it LOCALLY — the gateway v1 contract has no
// command dispatch, so nothing here pretends to reach the backend.

import { useEffect, useMemo, useRef, useState } from 'react'

/** Curated quick-pick set — zero external picker dependency. */
const EMOJIS = [
  '😀',
  '😂',
  '🙌',
  '👍',
  '👎',
  '🔥',
  '✅',
  '❌',
  '🎉',
  '🚀',
  '💡',
  '🐛',
  '👀',
  '🙏',
  '💪',
  '😅',
  '😍',
  '🤔',
  '😭',
  '⚡',
  '🌟',
  '❤️',
  '🧠',
  '🤖',
]

import {
  filterCommands,
  findCommand,
  mergeCommands,
  slashQueryOf,
} from './slash-commands'
import { useAutoGrowTextarea } from './use-autogrow'
import { useDeckStore } from '../../floor/deck-store'
import { clearTranscript, pushLocalNotice } from '../../state/transcript-store'

import type { PaletteCommand } from './slash-commands'
import type { JSX, KeyboardEvent } from 'react'

/** Execute a renderer-local command; returns true when handled. */
function executeLocalCommand(name: string): boolean {
  switch (name) {
    case '/clear':
      clearTranscript()
      return true
    case '/deck':
      useDeckStore.getState().setViewMode('deck')
      return true
    case '/chat':
      useDeckStore.getState().setViewMode('chat')
      return true
    default:
      return false
  }
}

export function Composer(props: {
  disabled: boolean
  running: boolean
  /** FID-2026-0901-005: the gateway's list_commands result — the full CLI
   *  registry with dispatch classes. Empty until the gateway is ready. */
  serverCommands?: ReadonlyArray<{
    id: string
    description: string
    dispatch: string
  }>
  onSend(text: string): void
  onInterrupt(): void
}): JSX.Element {
  const [draft, setDraft] = useState('')
  const [dismissed, setDismissed] = useState(false)
  const [selected, setSelected] = useState(0)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  // P28: the composer grows with the draft (up to ~5 lines) instead of
  // scrolling inside a one-line box; Shift+Enter stays the newline path.
  useAutoGrowTextarea(inputRef, draft, 120)
  const trimmed = draft.trim()
  const slashQuery = slashQueryOf(draft)
  const registry = useMemo(
    () => mergeCommands(props.serverCommands ?? []),
    [props.serverCommands],
  )
  const matches = useMemo<PaletteCommand[]>(
    () => (slashQuery === null ? [] : filterCommands(registry, slashQuery)),
    [registry, slashQuery],
  )
  const menuOpen = slashQuery !== null && !dismissed && matches.length > 0

  useEffect(() => {
    setSelected(0)
  }, [slashQuery])

  const accept = (command: PaletteCommand): void => {
    setDraft('')
    setDismissed(false)
    // Local commands execute in the renderer. Agent commands dispatch as
    // prompt text through the run path — the runtime intercepts command-
    // shaped prompts (e.g. /compact), so this is real execution, not a stub.
    if (executeLocalCommand(command.name)) return
    if (command.origin === 'agent') {
      props.onSend(command.name)
      return
    }
    pushLocalNotice(
      `/${command.name.slice(1)} is only available in the terminal UI`,
    )
  }

  /** Insert at the caret (or append) and restore focus/selection — the
   * popover button steals focus on click, so rAF re-anchors after paint. */
  const insertEmoji = (emoji: string): void => {
    const el = inputRef.current
    if (el === null) {
      setDraft((draft) => draft + emoji)
      return
    }
    const start = el.selectionStart ?? draft.length
    const end = el.selectionEnd ?? start
    setDraft(draft.slice(0, start) + emoji + draft.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + emoji.length, start + emoji.length)
    })
    setEmojiOpen(false)
  }

  const submit = (): void => {
    if (trimmed === '') return
    const command = findCommand(registry, trimmed)
    if (command !== null) {
      accept(command)
      return
    }
    if (props.disabled) return
    props.onSend(trimmed)
    setDraft('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (menuOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelected((index) => (index + 1) % matches.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelected((index) => (index - 1 + matches.length) % matches.length)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const command = matches[Math.min(selected, matches.length - 1)]
        if (command !== undefined) accept(command)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setDismissed(true)
        return
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <footer className="composer">
      {menuOpen ? (
        <div className="slash-menu" role="listbox" aria-label="Commands">
          {matches.map((command, index) => (
            <button
              key={command.name}
              type="button"
              role="option"
              aria-selected={index === Math.min(selected, matches.length - 1)}
              className={`slash-item${index === Math.min(selected, matches.length - 1) ? ' slash-active' : ''}`}
              onClick={() => {
                accept(command)
              }}
              onMouseEnter={() => {
                setSelected(index)
              }}
            >
              <span className="slash-name">{command.name}</span>
              <span className="slash-desc">
                {command.origin === 'client'
                  ? `${command.description} — terminal only`
                  : command.description}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <textarea
        ref={inputRef}
        className="composer-input"
        value={draft}
        rows={1}
        placeholder={
          props.disabled
            ? 'waiting for gateway…'
            : 'message the agent — / for commands'
        }
        onChange={(event) => {
          setDraft(event.target.value)
          setDismissed(false)
        }}
        onKeyDown={handleKeyDown}
        disabled={props.disabled}
      />
      <div className="composer-tools">
        <button
          type="button"
          className="composer-emoji"
          aria-label="Insert emoji"
          onClick={() => {
            setEmojiOpen((open) => !open)
          }}
        >
          🙂
        </button>
        {emojiOpen ? (
          <div
            className="emoji-popover"
            role="listbox"
            aria-label="Emoji picker"
          >
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                role="option"
                aria-selected={false}
                className="emoji-cell"
                onClick={() => {
                  insertEmoji(emoji)
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {props.running ? (
        <button
          type="button"
          className="composer-stop"
          onClick={() => {
            props.onInterrupt()
          }}
        >
          stop
        </button>
      ) : (
        <button
          type="button"
          className="composer-send"
          onClick={submit}
          disabled={props.disabled || trimmed === ''}
        >
          send
        </button>
      )}
    </footer>
  )
}
