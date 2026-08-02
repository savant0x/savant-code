import { create } from 'zustand'

import type { ProviderSetupName } from '../utils/provider-setup'

/**
 * Drives the interactive /provider picker overlay.
 *
 * Opened by the /provider command when no args are given,
 * rendered as an overlay in chat.tsx, and navigated with the keyboard.
 * On select it enters providerSetup input mode for the chosen provider.
 */
interface ProviderPickerStore {
  isOpen: boolean
  providers: Array<{
    name: ProviderSetupName
    label: string
    configured: boolean
  }>
  selectedIndex: number
  open: (
    providers: Array<{
      name: ProviderSetupName
      label: string
      configured: boolean
    }>,
  ) => void
  close: () => void
  setSelectedIndex: (index: number) => void
}

export const useProviderPickerStore = create<ProviderPickerStore>((set) => ({
  isOpen: false,
  providers: [],
  selectedIndex: 0,
  open: (providers) =>
    set({
      isOpen: true,
      providers,
      // Start selection on the first unconfigured provider (most likely intent),
      // or the first provider if all are configured.
      selectedIndex: Math.max(0, providers.findIndex((p) => !p.configured)),
    }),
  close: () => set({ isOpen: false, providers: [], selectedIndex: 0 }),
  setSelectedIndex: (index) => set({ selectedIndex: index }),
}))

/** Imperative read for non-React callers. */
export function isProviderPickerOpen(): boolean {
  return useProviderPickerStore.getState().isOpen
}
