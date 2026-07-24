/**
 * Toast Store + Hook (FID-2026-0720-033d Phase D Step 3)
 *
 * Zustand store for ephemeral toast notifications. Auto-dismiss after a
 * configurable duration (default 3000ms). Queue capped at 5 toasts — oldest
 * is dropped when a new toast is added beyond the cap (Law 14 — toast queue
 * overflow drops oldest, never blocks the UI).
 *
 * Law 11 (follow discovered patterns): uses the established Zustand `create`
 * pattern (matches `useChatStore`, `useLoginStore`).
 *
 * Usage:
 *   const { addToast, dismissToast } = useToast()
 *   addToast({ message: 'Copied to clipboard', variant: 'success' })
 */

import { create } from 'zustand'

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
  /** Auto-dismiss duration in ms. 0 = sticky (manual dismiss only). */
  duration: number
}

export interface ToastInput {
  message: string
  variant?: ToastVariant
  /** Auto-dismiss duration in ms. Default 3000. 0 = sticky. */
  duration?: number
}

interface ToastStore {
  toasts: Toast[]
  /** Add a toast; returns the toast id. Auto-dismisses after duration. */
  addToast: (input: ToastInput) => string
  /** Dismiss a toast by id. No-op if not found. */
  dismissToast: (id: string) => void
}

/** Maximum simultaneous toasts. Oldest dropped when exceeded. */
const MAX_TOASTS = 5
const DEFAULT_DURATION_MS = 3000

/** Monotonic counter for toast ids (unique per session). */
let toastIdCounter = 0

/** Track active timeout handles so dismissToast can cancel early. */
const activeTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const clearToastTimeout = (id: string) => {
  const handle = activeTimeouts.get(id)
  if (handle) {
    clearTimeout(handle)
    activeTimeouts.delete(id)
  }
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  addToast: (input) => {
    const id = `toast-${++toastIdCounter}`
    const toast: Toast = {
      id,
      message: input.message,
      variant: input.variant ?? 'info',
      duration: input.duration ?? DEFAULT_DURATION_MS,
    }

    set((state) => {
      // Law 14: queue overflow drops oldest, never blocks
      let nextToasts = [...state.toasts, toast]
      if (nextToasts.length > MAX_TOASTS) {
        // Drop the oldest and clear its timeout
        const dropped = nextToasts[0]
        if (dropped) clearToastTimeout(dropped.id)
        nextToasts = nextToasts.slice(nextToasts.length - MAX_TOASTS)
      }
      return { toasts: nextToasts }
    })

    // Schedule auto-dismiss (unless sticky — duration 0)
    if (toast.duration > 0) {
      const handle = setTimeout(() => {
        activeTimeouts.delete(id)
        get().dismissToast(id)
      }, toast.duration)
      activeTimeouts.set(id, handle)
    }

    return id
  },

  dismissToast: (id) => {
    clearToastTimeout(id)
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },
}))

/**
 * Convenience hook exposing addToast + dismissToast.
 * Component reads the toast queue via `useToastStore((s) => s.toasts)`.
 */
export const useToast = () => {
  const addToast = useToastStore((s) => s.addToast)
  const dismissToast = useToastStore((s) => s.dismissToast)
  return { addToast, dismissToast }
}
