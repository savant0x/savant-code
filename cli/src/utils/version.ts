import { readFileSync } from 'fs'
import { join } from 'path'

const VERSION_PATH = join(import.meta.dir, '..', '..', '..', 'VERSION')

let cachedVersion: string | null = null

export function getVersion(): string {
  if (cachedVersion) return cachedVersion

  const injectedVersion = process.env.SAVANT_CODE_CLI_VERSION?.trim()
  if (injectedVersion) {
    cachedVersion = injectedVersion
    return cachedVersion
  }

  try {
    cachedVersion = readFileSync(VERSION_PATH, 'utf-8').trim()
  } catch {
    cachedVersion = '0.0.0'
  }
  return cachedVersion
}

/**
 * Test isolation: clears the memoized version — process-lifetime state
 * `bun test` shares across files (FID-2026-1007-002).
 */
export function resetCachedVersion(): void {
  cachedVersion = null
}
