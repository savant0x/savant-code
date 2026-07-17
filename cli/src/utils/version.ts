import { readFileSync } from 'fs'
import { join } from 'path'

const VERSION_PATH = join(import.meta.dir, '..', '..', '..', 'VERSION')

let cachedVersion: string | null = null

export function getVersion(): string {
  if (cachedVersion) return cachedVersion
  try {
    cachedVersion = readFileSync(VERSION_PATH, 'utf-8').trim()
  } catch {
    cachedVersion = '0.0.0'
  }
  return cachedVersion
}
