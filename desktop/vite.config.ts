import { readFileSync } from 'node:fs'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Single-source app version: the root VERSION file (FID-2026-0824-032 audit
// condition). Exposed to index.html via the %VITE_APP_VERSION% placeholder
// and to JS via import.meta.env.VITE_APP_VERSION.
process.env.VITE_APP_VERSION = readFileSync(
  new URL('../VERSION', import.meta.url),
  'utf8',
).trim()

// Tauri expects a fixed dev port; strictPort fails loudly instead of letting a
// silent port drift break the WebView devUrl handshake (FID-2026-0820-009).
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: 'chrome110',
    outDir: 'dist',
    sourcemap: false,
  },
})
