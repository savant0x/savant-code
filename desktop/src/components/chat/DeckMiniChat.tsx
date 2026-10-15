// FID-2026-0901-006 P26/P28/P30 — deck mini-chat composer.
//
// Operator ask: "add a small little chat interface in the bottom left hand
// corner, so the user does not have to switch to the chat tab to send a
// message." The deck's WebGL canvas is interactive (orbit/zoom), so the
// overlay is a fixed-position island that claims only its own corner — it
// never overlays a scroll container and cannot intercept the stage's pointer
// events outside its box.
//
// Design (Law 7/13 — reuse, don't duplicate): a send surface over the TAIL of
// the one shared transcript. P30 (operator: "within the chat on the deck it
// does not actually show the messages, not for the user, nor the responses
// from savant unless i switch to the chat tab"): the island now renders the
// LAST few blocks (user bubbles + savant text) above its composer, reading the
// SAME transcript store the Chat tab renders — no second transcript, no second
// event path; the Chat tab stays the full-history surface. Thinking stays off
// the island (the deck's speech bubble over Savant already carries it; the
// pill shows the live activity).
//
// P28 scope: full island = deck branch only (WebGL office + analytical
// fallback). On the chat branch it collapses to the live pill — the chat view
// has its own Composer; two stacked send boxes was wrong.

import { useRef, useState } from 'react'
import { useStore } from 'zustand'

import { activityLabel } from './activity-label'
import { MarkdownBlock } from './MarkdownBlock'
import { useAutoGrowTextarea } from './use-autogrow'
import { useTranscriptTail } from './use-store-tail'
import { getSharedGatewayClient } from '../../hooks/use-gateway'
import {
  pushLocalError,
  pushLocalUserMessage,
  transcriptStore,
} from '../../state/transcript-store'

import type { JSX, KeyboardEvent } from 'react'

/** P26: the deck island reuses the same client methods the chat composer's
 * gateway hook drives — but the hook is a React binding, and the island lives
 * outside it, so it calls the SAME shared client singleton directly (Law 13:
 * one transport path; the events land in the same transcript store either
 * way). Errors surface identically to the hook's catch. */
async function sendViaGateway(text: string): Promise<void> {
  pushLocalUserMessage(text)
  try {
    await getSharedGatewayClient().sendUserMessage(text)
  } catch (error) {
    pushLocalError(error instanceof Error ? error.message : String(error))
  }
}

/** Idle copy for the pill (P26: the deck is never a black hole — point the
 * operator at where replies land). */
const IDLE_PILL = 'idle — replies land in Chat'

export function DeckMiniChat(props: {
  /** True while the transport is down — disable input, keep the island up. */
  disabled: boolean
  /** P28: false on the chat branch — render the collapsed pill only. */
  expanded?: boolean
}): JSX.Element | null {
  const expanded = props.expanded ?? true
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  // P28: same auto-grow contract as the chat Composer, smaller cap (~3
  // lines) so the island stays an island.
  useAutoGrowTextarea(inputRef, draft, 72)
  // P26: the same transcript-store read the chat header uses (Law 13 — one
  // source of truth for run state; no second subscription path).
  const running = useStore(transcriptStore, (state) => state.running)
  const currentActivity = useStore(
    transcriptStore,
    (state) => state.currentActivity,
  )
  // P30: the island's transcript tail — same store the Chat tab renders,
  // via the identity-stable hook (an inline filter+slice selector here caused
  // a snapshot-identity loop: "Maximum update depth exceeded", app dead on
  // white screen; see use-store-tail.ts).
  const { tail: tailBlocks, tailRef } = useTranscriptTail()
  const trimmed = draft.trim()

  const interrupt = (): void => {
    void getSharedGatewayClient()
      .interrupt()
      .catch(() => {})
  }

  // P28: chat branch — the live pill only (nothing when idle; the chat view
  // owns the full composer). No duplicate send surface.
  if (!expanded) {
    if (!running) return null
    return (
      <aside
        className="deck-minichat minichat-collapsed"
        aria-label="Run status"
      >
        <button
          type="button"
          className="minichat-pill minichat-pill-live"
          title="A run is streaming — click to interrupt"
          onClick={interrupt}
        >
          <span className="minichat-dot" aria-hidden="true" />
          {currentActivity === null
            ? 'Working…'
            : activityLabel(currentActivity)}
        </button>
      </aside>
    )
  }

  const submit = (): void => {
    if (trimmed === '' || props.disabled) return
    void sendViaGateway(trimmed)
    setDraft('')
    // Keep focus in the island so a back-and-forth exchange doesn't fight
    // the WebGL canvas for keyboard focus.
    inputRef.current?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <aside className="deck-minichat" aria-label="Quick chat">
      {running ? (
        <button
          type="button"
          className="minichat-pill minichat-pill-live"
          title="A run is streaming — click to interrupt"
          onClick={interrupt}
        >
          <span className="minichat-dot" aria-hidden="true" />
          {currentActivity === null
            ? 'Working…'
            : activityLabel(currentActivity)}
        </button>
      ) : tailBlocks.length === 0 ? (
        <span className="minichat-pill">{IDLE_PILL}</span>
      ) : null}
      {/* P30: the shared transcript's tail — user bubbles right, savant text
          left, markdown rendered by the same MarkdownBlock the Chat tab uses.
          Bounded window (VISIBLE_BLOCKS) with internal scroll; never the full
          history (the Chat tab owns that). */}
      {tailBlocks.length > 0 ? (
        <div className="minichat-tail" ref={tailRef} aria-live="polite">
          {tailBlocks.map((block) =>
            block.kind === 'user' ? (
              <div key={block.id} className="minichat-user">
                {block.text}
              </div>
            ) : block.kind === 'text' ? (
              <div key={block.id} className="minichat-agent">
                <MarkdownBlock text={block.text} />
              </div>
            ) : null,
          )}
        </div>
      ) : null}
      <div className="minichat-row">
        <textarea
          ref={inputRef}
          className="minichat-input"
          value={draft}
          rows={1}
          placeholder={
            props.disabled ? 'waiting for gateway…' : 'message the agent…'
          }
          onChange={(event) => {
            setDraft(event.target.value)
          }}
          onKeyDown={handleKeyDown}
          disabled={props.disabled}
        />
        {running ? (
          <button
            type="button"
            className="minichat-send minichat-stop"
            title="Interrupt the running turn"
            onClick={interrupt}
          >
            stop
          </button>
        ) : (
          <button
            type="button"
            className="minichat-send"
            onClick={submit}
            disabled={props.disabled || trimmed === ''}
          >
            send
          </button>
        )}
      </div>
    </aside>
  )
}
