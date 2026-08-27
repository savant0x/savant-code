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
  filterSlashCommands,
  findSlashCommand,
  slashQueryOf,
} from './slash-commands'
import { useDeckStore } from '../../floor/deck-store'
import { clearTranscript, pushLocalNotice } from '../../state/transcript-store'

import type { SlashCommand } from './slash-commands'
import type { JSX, KeyboardEvent } from 'react'

function executeCommand(name: string): void {
  switch (name) {
    case '/clear':
      clearTranscript()
      break
    case '/deck':
      useDeckStore.getState().setViewMode('deck')
      break
    case '/chat':
      useDeckStore.getState().setViewMode('chat')
      break
    case '/help':
      pushLocalNotice(
        'desktop commands: /clear, /deck, /chat, /help — gateway-backed ' +
          'commands (/model, /usage, /goal …) are not wired in the desktop yet',
      )
      break
  }
}

export function Composer(props: {
  disabled: boolean
  running: boolean
  onSend(text: string): void
  onInterrupt(): void
}): JSX.Element {
  const [draft, setDraft] = useState('')
  const [dismissed, setDismissed] = useState(false)
  const [selected, setSelected] = useState(0)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const trimmed = draft.trim()
  const slashQuery = slashQueryOf(draft)
  const matches = useMemo<SlashCommand[]>(
    () => (slashQuery === null ? [] : filterSlashCommands(slashQuery)),
    [slashQuery],
  )
  const menuOpen = slashQuery !== null && !dismissed && matches.length > 0

  useEffect(() => {
    setSelected(0)
  }, [slashQuery])

  const accept = (command: SlashCommand): void => {
    setDraft('')
    setDismissed(false)
    executeCommand(command.name)
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
    const command = findSlashCommand(trimmed)
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
              <span className="slash-desc">{command.description}</span>
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
