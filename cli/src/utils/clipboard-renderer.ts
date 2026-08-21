/** Selection object shape returned by some OpenTUI renderers.
 * Assumes the renderer exposes selected text via `getSelectedText`. */
export interface ClipboardRendererSelection {
  getSelectedText?: () => string
}

// Minimal interface for the OpenTUI renderer features used by the clipboard.
export interface ClipboardRenderer {
  copyToClipboardOSC52?: (text: string) => boolean | undefined
  on?: (
    event: 'selection',
    listener: (event: ClipboardRendererSelection | string) => void,
  ) => void
  off?: (
    event: 'selection',
    listener: (event: ClipboardRendererSelection | string) => void,
  ) => void
  getSelection?: () => ClipboardRendererSelection | null | undefined
}

// Global renderer reference for clipboard operations.
// Registered once by the useClipboard hook so all callers of
// copyTextToClipboard automatically benefit from renderer-based
// OSC 52 without threading the renderer through every call site.
export let registeredRenderer: ClipboardRenderer | null = null

export function registerClipboardRenderer(renderer: ClipboardRenderer): void {
  registeredRenderer = renderer
}

export function unregisterClipboardRenderer(): void {
  registeredRenderer = null
}
