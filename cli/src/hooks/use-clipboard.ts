import { useRenderer } from '@opentui/react'
import { useEffect, useRef, useState } from 'react'

import { CURSOR_CHAR } from '../components/multiline-input'
import {
  copyTextToClipboard,
  registerClipboardRenderer,
  subscribeClipboardMessages,
  unregisterClipboardRenderer,
} from '../utils/clipboard'

import type {
  ClipboardRenderer,
  ClipboardRendererSelection,
} from '../utils/clipboard'

function isSelectionLike(
  value: unknown,
): value is ClipboardRendererSelection {
  return typeof value === 'object' && value !== null && 'getSelectedText' in value
}

function extractSelectedText(
  selectionEvent: ClipboardRendererSelection | string,
  renderer: ClipboardRenderer | null,
): string | null {
  const rendererSelection = renderer?.getSelection?.()
  const selectionObj = selectionEvent ?? rendererSelection
  const rawText: string | null =
    selectionObj && isSelectionLike(selectionObj)
      ? selectionObj.getSelectedText?.() ?? null
      : typeof selectionObj === 'string'
        ? selectionObj
        : null
  return rawText
}

function formatDefaultClipboardMessage(text: string): string | null {
  const preview = text.replace(/\s+/g, ' ').trim()
  if (!preview) {
    return null
  }
  const truncated = preview.length > 40 ? `${preview.slice(0, 37)}…` : preview
  return `Copied: "${truncated}"`
}

export const useClipboard = () => {
  const renderer = useRenderer()
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [hasSelection, setHasSelection] = useState(false)
  const pendingCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const pendingSelectionRef = useRef<string | null>(null)
  const lastCopiedRef = useRef<string | null>(null)

  useEffect(() => {
    return subscribeClipboardMessages(setStatusMessage)
  }, [])

  // Register the renderer globally so all copyTextToClipboard callers
  // can use the renderer's OSC 52 method when available.
  useEffect(() => {
    if (renderer) {
      registerClipboardRenderer(renderer as ClipboardRenderer)
      return () => {
        unregisterClipboardRenderer()
      }
    }
    return undefined
  }, [renderer])

  useEffect(() => {
    const handleSelection = (
      selectionEvent: ClipboardRendererSelection | string,
    ) => {
      const rawText = extractSelectedText(selectionEvent, renderer as ClipboardRenderer | null)

      // Filter out cursor character from selected text
      const cleanedText = rawText?.replace(new RegExp(CURSOR_CHAR, 'g'), '') ?? null

      if (!cleanedText || cleanedText.trim().length === 0) {
        pendingSelectionRef.current = null
        setHasSelection(false)
        if (pendingCopyTimeoutRef.current) {
          clearTimeout(pendingCopyTimeoutRef.current)
          pendingCopyTimeoutRef.current = null
        }
        return
      }

      if (cleanedText === pendingSelectionRef.current) {
        return
      }

      // Track that there's an active selection for visual feedback
      setHasSelection(true)

      pendingSelectionRef.current = cleanedText

      if (pendingCopyTimeoutRef.current) {
        clearTimeout(pendingCopyTimeoutRef.current)
      }

      pendingCopyTimeoutRef.current = setTimeout(() => {
        pendingCopyTimeoutRef.current = null
        const pending = pendingSelectionRef.current
        if (!pending || pending === lastCopiedRef.current) {
          return
        }

        lastCopiedRef.current = pending
        const successMessage = formatDefaultClipboardMessage(pending)
        void copyTextToClipboard(pending, {
          successMessage,
          durationMs: 3000,
        })
          .then(() => {
            // Clear selection visual state after successful copy
            setHasSelection(false)
          })
          .catch(() => {
            // Errors are logged within copyTextToClipboard
          })
      }, 250)
    }

    if (renderer?.on) {
      renderer.on('selection', handleSelection)
      return () => {
        renderer.off?.('selection', handleSelection)
      }
    }
    return undefined
  }, [renderer])

  useEffect(() => {
    return () => {
      if (pendingCopyTimeoutRef.current) {
        clearTimeout(pendingCopyTimeoutRef.current)
        pendingCopyTimeoutRef.current = null
      }
    }
  }, [])

  return {
    statusMessage,
    hasSelection,
  }
}
