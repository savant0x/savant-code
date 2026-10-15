import { create } from 'zustand'

import type { TurnSummary } from '@savant-code/sdk'

/** FID-2026-0803-004 rewind modes. */
export type RewindMode = 'code' | 'conversation' | 'both' | 'fork'

export const REWIND_MODES: ReadonlyArray<{ id: RewindMode; label: string }> = [
  { id: 'code', label: 'Code only' },
  { id: 'conversation', label: 'Conversation only' },
  { id: 'both', label: 'Code + conversation' },
  { id: 'fork', label: 'Fork from here' },
]

/**
 * Drives the interactive /rewind picker overlay (FID-2026-0803-004).
 *
 * Two-stage flow, mirroring the model/provider pickers:
 *   - stage 'choose': list persisted turn checkpoints (prompt · time · touched
 *     files). Arrow keys navigate, Enter selects a turn, Esc closes.
 *   - stage 'mode': choose the restore mode (code / conversation / both /
 *     fork) for the selected turn. Enter confirms, Esc goes back.
 *
 * The chat screen renders the overlay and runs the restore on confirm; this
 * store stays side-effect free.
 */
interface RewindPickerStore {
  isOpen: boolean
  turns: TurnSummary[]
  selectedIndex: number
  stage: 'choose' | 'mode'
  mode: RewindMode
  open: (turns: TurnSummary[]) => void
  close: () => void
  setSelectedIndex: (index: number) => void
  setStage: (stage: 'choose' | 'mode') => void
  setMode: (mode: RewindMode) => void
}

export const useRewindPickerStore = create<RewindPickerStore>((set) => ({
  isOpen: false,
  turns: [],
  selectedIndex: 0,
  stage: 'choose',
  mode: 'both',
  open: (turns) =>
    set({
      isOpen: true,
      turns,
      selectedIndex: 0,
      stage: 'choose',
      mode: 'both',
    }),
  close: () =>
    set({
      isOpen: false,
      turns: [],
      selectedIndex: 0,
      stage: 'choose',
      mode: 'both',
    }),
  setSelectedIndex: (index) => set({ selectedIndex: index }),
  setStage: (stage) => set({ stage, selectedIndex: 0 }),
  setMode: (mode) => set({ mode }),
}))

/** Imperative read for non-React callers (commands). */
export const openRewindPicker = (turns: TurnSummary[]): void => {
  useRewindPickerStore.getState().open(turns)
}

export const closeRewindPicker = (): void => {
  useRewindPickerStore.getState().close()
}
