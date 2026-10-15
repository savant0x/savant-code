import { existsSync, mkdirSync } from 'fs'
import os from 'os'
import path from 'path'

/**
 * Get a temp directory for clipboard images
 */
export function getClipboardTempDir(): string {
  const tempDir = path.join(os.tmpdir(), 'savant-code-clipboard-images')
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true })
  }
  return tempDir
}

/**
 * Generate a unique filename for a clipboard image
 */
export function generateImageFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `clipboard-${timestamp}.png`
}
