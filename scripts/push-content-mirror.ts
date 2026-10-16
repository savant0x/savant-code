// Exact pushed-content mirror; metadata and raw blob reads are bounded batches.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import {
  readPushedBlobBatches,
  readPushedTree,
  SCAN_SIZE_CAP_BYTES,
} from './push-content-batch'
import { findVendorBinaryPin, VENDOR_BINARY_PINS } from './vendor-binary-pins'

import type { PushedTreeEntry } from './push-content-batch'
import type { VendorBinaryPin } from './vendor-binary-pins'

export { SCAN_SIZE_CAP_BYTES } from './push-content-batch'

/** Mirror paths must be representable without aliases or workspace escape. */
export function pushedMirrorTarget(mirror: string, file: string): string {
  const components = file.split('/')
  if (
    !file ||
    path.posix.isAbsolute(file) ||
    path.win32.isAbsolute(file) ||
    file.includes('\\') ||
    file.includes('\0') ||
    components.some((part) => !part || part === '.' || part === '..')
  )
    throw new Error(`unsafe pushed mirror path: ${file}`)
  if (
    process.platform === 'win32' &&
    components.some(
      (part) =>
        /[<>:"|?*\x00-\x1f]/.test(part) ||
        /[. ]$/.test(part) ||
        /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
    )
  )
    throw new Error(`unsupported Windows pushed path: ${file}`)
  const target = path.resolve(mirror, file)
  const relative = path.relative(mirror, target)
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error(`pushed path escapes mirror: ${file}`)
  return target
}

/**
 * Read exactly each changed path at its pushed commit. Cap/pin classification
 * happens before content reads; only confirmed absent paths count as deletions.
 * The unchanged caller scans every commit, including later-reverted secrets.
 */
export function materializePushedContent(
  root: string,
  commitSha: string,
  files: readonly string[],
  pins: readonly VendorBinaryPin[] = VENDOR_BINARY_PINS,
): {
  mirror: string
  materialized: string[]
  oversized: number
  oversizedFiles: string[]
  pinnedExcluded: string[]
} {
  const mirror = mkdtempSync(path.join(os.tmpdir(), 'savant-push-scan-'))
  const materialized: string[] = []
  const oversizedFiles: string[] = []
  const pinnedExcluded: string[] = []
  try {
    const tree = readPushedTree(root, commitSha)
    const entries: PushedTreeEntry[] = []
    const targets = new Set<string>()
    for (const file of files) {
      const entry = tree.get(file)
      if (!entry) continue
      const target = pushedMirrorTarget(mirror, file)
      const key = process.platform === 'win32' ? target.toLowerCase() : target
      if (targets.has(key)) throw new Error(`colliding pushed paths: ${file}`)
      targets.add(key)
      if (entry.type !== 'blob' || entry.size === undefined)
        throw new Error(
          `unsupported pushed object type for ${file}: ${entry.type}`,
        )
      if (entry.size > SCAN_SIZE_CAP_BYTES) {
        if (findVendorBinaryPin(file, entry.sha, pins))
          pinnedExcluded.push(file)
        else oversizedFiles.push(file)
      } else entries.push(entry)
    }
    readPushedBlobBatches(root, entries, (entry, content) => {
      const target = pushedMirrorTarget(mirror, entry.file)
      mkdirSync(path.dirname(target), { recursive: true })
      writeFileSync(target, content, { flag: 'wx' })
      materialized.push(entry.file)
    })
  } catch (error) {
    rmSync(mirror, { recursive: true, force: true })
    throw error
  }
  return {
    mirror,
    materialized,
    oversized: oversizedFiles.length,
    oversizedFiles,
    pinnedExcluded,
  }
}
