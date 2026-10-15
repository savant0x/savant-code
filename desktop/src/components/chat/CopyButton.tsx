// FID-2026-0820-010 Loop 9 — copy affordance for assistant responses.
// Copies the RAW markdown source (what the model actually said) to the
// clipboard. Primary path is the async Clipboard API; a legacy
// document.execCommand('copy') fallback covers WebView2 builds where the
// async API is unavailable or denied. Law 14: every path resolves to an
// explicit copied/failed state — never a silent no-op.

import { memo, useEffect, useRef, useState } from 'react'

import type { JSX } from 'react'

const RESET_MS = 1600

type CopyState = 'idle' | 'copied' | 'failed'

function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }
  document.body.removeChild(textarea)
  return copied
}

/** Resolve a clipboard write to an explicit boolean — never throws. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard !== undefined) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Permission denial / unfocused document — fall through to legacy.
  }
  return legacyCopy(text)
}

export const CopyButton = memo(function CopyButton({
  text,
  label = 'copy',
}: {
  text: string
  label?: string
}): JSX.Element {
  const [state, setState] = useState<CopyState>('idle')
  const timerRef = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )
  const handleCopy = (): void => {
    void copyText(text).then((copied) => {
      setState(copied ? 'copied' : 'failed')
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        setState('idle')
        timerRef.current = null
      }, RESET_MS)
    })
  }
  const className = `blk-copy${state === 'copied' ? ' copied' : ''}${
    state === 'failed' ? ' failed' : ''
  }`
  return (
    <button
      type="button"
      className={className}
      onClick={handleCopy}
      aria-label={`copy response (${state})`}
    >
      {state === 'copied' ? 'copied ✓' : state === 'failed' ? 'failed' : label}
    </button>
  )
})
