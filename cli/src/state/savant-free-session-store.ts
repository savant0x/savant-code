import { create } from 'zustand'

import type { SavantFree$1 } from '../types/savant-free-session'

/**
 * Shared state for the savant-free free session.
 *
 * The hook in `use-savant-free-session.ts` owns the poll loop and writes into
 * this store; React components subscribe via selectors, and non-React code
 * reads via `useFreebuffSessionStore.getState()`.
 *
 * Imperative session controls (force re-POST, mark superseded/ended) live on
 * the module exports of `use-savant-free-session.ts` rather than on this store —
 * that way callers don't need to null-check a "driver" slot whose lifetime
 * is tied to the React tree.
 */
interface SavantFree$1 {
  session: SavantFree$1 | null
  error: string | null

  setSession: (session: SavantFree$1 | null) => void
  setError: (error: string | null) => void
}

export const useFreebuffSessionStore = create<SavantFree$1>((set) => ({
  session: null,
  error: null,
  setSession: (session) => set({ session }),
  setError: (error) => set({ error }),
}))
