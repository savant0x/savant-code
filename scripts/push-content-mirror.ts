// FID-2026-0819-005 Loop 234: pushed-content materialization, extracted
// verbatim from pre-push-scan.ts (over the 300-line ceiling). The scan
// orchestrator imports this via a re-export so the hook-facing API and the
// public-release reuse stay unchanged.

import { spawnSync } from 'child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { findVendorBinaryPin, VENDOR_BINARY_PINS } from './vendor-binary-pins'

import type { VendorBinaryPin } from './vendor-binary-pins'

export const SCAN_SIZE_CAP_BYTES = 2 * 1024 * 1024

/** Git blob id of `<commit>:<file>`; throws so callers fail closed. */
function pushedBlobSha(root: string, commitSha: string, file: string): string {
  const result = spawnSync('git', ['rev-parse', `${commitSha}:${file}`], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
    windowsHide: true,
    shell: false,
  })
  const sha = String(result.stdout ?? '').trim()
  if (result.status !== 0 || !/^[0-9a-f]{40,64}$/i.test(sha)) {
    const detail = String(result.stderr ?? '').trim()
    throw new Error(
      `unable to resolve pushed blob id for ${file}: ${detail || 'git rev-parse failed'}`,
    )
  }
  return sha
}

/**
 * Materializes the pushed content of every changed file into a fresh temp
 * mirror (path structure preserved), so the scan reads exactly what the remote
 * would receive — never the working tree, which may already be clean.
 * Blobs over the scan cap are counted as oversized and skipped up front: they
 * cannot be content-scanned anyway, and size-checking avoids blowing the
 * spawn buffer on huge blobs (which would otherwise fail the whole push with
 * an opaque error instead of a bounded "oversized" notice). Pinned vendored
 * binaries over the cap (vendor-binary-pins.ts) are exempt from the oversized
 * refusal and reported via `pinnedExcluded` instead; identity is the exact git
 * blob id, so a swapped file at a pinned path still fails closed.
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
    for (const file of files) {
      const size = spawnSync(
        'git',
        ['cat-file', '-s', `${commitSha}:${file}`],
        {
          cwd: root,
          encoding: 'utf8',
          stdio: 'pipe',
          windowsHide: true,
          shell: false,
        },
      )
      // A path absent from the commit is a confirmed deletion. Do not infer
      // deletion from stderr text: corrupted/unavailable objects fail closed.
      if (size.status !== 0) {
        const membership = spawnSync(
          'git',
          ['ls-tree', '-r', '--name-only', commitSha, '--', file],
          {
            cwd: root,
            encoding: 'utf8',
            stdio: 'pipe',
            windowsHide: true,
            shell: false,
          },
        )
        if (membership.status !== 0) {
          throw new Error(
            `unable to confirm pushed path membership for ${file}: ${String(membership.stderr ?? '').trim() || 'git ls-tree failed'}`,
          )
        }
        if (!String(membership.stdout ?? '').trim()) continue
        const detail = String(size.stderr ?? '').trim()
        throw new Error(
          `unable to determine pushed blob size for ${file}: ${detail || 'git cat-file failed'}`,
        )
      }
      const blobSize = Number(String(size.stdout ?? '').trim())
      if (!Number.isSafeInteger(blobSize) || blobSize < 0) {
        throw new Error(`invalid pushed blob size for ${file}`)
      }
      if (blobSize > SCAN_SIZE_CAP_BYTES) {
        // Operator-pinned vendored binaries are exempt from the cap refusal;
        // the identity check is the exact git blob, so a swapped file still
        // fails closed (vendor-binary-pins.ts).
        const pinned = findVendorBinaryPin(
          file,
          pushedBlobSha(root, commitSha, file),
          pins,
        )
        if (pinned) {
          pinnedExcluded.push(file)
        } else {
          oversizedFiles.push(file)
        }
        continue
      }
      const shown = spawnSync('git', ['show', `${commitSha}:${file}`], {
        cwd: root,
        encoding: 'buffer',
        stdio: 'pipe',
        windowsHide: true,
        shell: false,
        maxBuffer: 16 * 1024 * 1024,
      })
      if (shown.status !== 0) {
        const detail = String(shown.stderr ?? '').trim()
        throw new Error(
          `unable to read pushed blob ${file}: ${detail || 'git show failed'}`,
        )
      }
      let content = Buffer.alloc(0)
      let offset = 0
      while (offset < shown.stdout.length) {
        const chunk = shown.stdout.subarray(offset, offset + 64 * 1024)
        content = Buffer.concat([content, chunk])
        offset += chunk.length
      }
      const target = path.join(mirror, file)
      mkdirSync(path.dirname(target), { recursive: true })
      writeFileSync(target, content)
      materialized.push(file)
    }
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
