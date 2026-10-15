/**
 * fid-watcher tests
 *
 * Verifies the harness-side FID file watcher that keeps the sidebar's Active
 * FIDs panel live as the Recorder creates, updates, or archives FID files.
 */

import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, test } from 'bun:test'

import { startFidWatcher } from '../fid-watcher'

const tempRoot = mkdtempSync(join(tmpdir(), 'fid-watcher-'))

function makeCaseDir(): string {
  return join(tempRoot, `case-${Math.random().toString(36).slice(2)}`)
}

async function waitFor(
  condition: () => boolean,
  timeoutMs = 3000,
): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (condition()) return true
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return condition()
}

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true })
})

describe('startFidWatcher', () => {
  test('fires onChange when a FID file is added', async () => {
    const fidsDir = makeCaseDir()
    mkdirSync(fidsDir, { recursive: true })

    let changes = 0
    const watcher = startFidWatcher({
      fidsDir,
      debounceMs: 50,
      onChange: () => {
        changes++
      },
    })

    try {
      writeFileSync(join(fidsDir, 'FID-2026-0804-005-test.md'), '# FID\n')
      expect(await waitFor(() => changes > 0)).toBe(true)
    } finally {
      watcher.close()
    }
  })

  test('fires onChange when a FID is archived (moved to archive/)', async () => {
    const fidsDir = makeCaseDir()
    mkdirSync(join(fidsDir, 'archive'), { recursive: true })
    writeFileSync(join(fidsDir, 'FID-2026-0804-006-test.md'), '# FID\n')

    let changes = 0
    const watcher = startFidWatcher({
      fidsDir,
      debounceMs: 50,
      onChange: () => {
        changes++
      },
    })

    try {
      renameSync(
        join(fidsDir, 'FID-2026-0804-006-test.md'),
        join(fidsDir, 'archive', 'FID-2026-0804-006-test.md'),
      )
      expect(await waitFor(() => changes > 0)).toBe(true)
    } finally {
      watcher.close()
    }
  })

  test('close() stops further callbacks', async () => {
    const fidsDir = makeCaseDir()
    mkdirSync(fidsDir, { recursive: true })

    let changes = 0
    const watcher = startFidWatcher({
      fidsDir,
      debounceMs: 50,
      onChange: () => {
        changes++
      },
    })

    try {
      // Prove the watcher is live first.
      writeFileSync(join(fidsDir, 'FID-a.md'), '# FID\n')
      expect(await waitFor(() => changes > 0)).toBe(true)

      watcher.close()

      const afterClose = changes
      writeFileSync(join(fidsDir, 'FID-b.md'), '# FID\n')
      writeFileSync(join(fidsDir, 'FID-c.md'), '# FID\n')
      // Allow any (incorrect) late events to fire.
      await new Promise((resolve) => setTimeout(resolve, 300))
      expect(changes).toBe(afterClose)
    } finally {
      watcher.close()
    }
  })

  test('picks up dev/fids/ created after start (self-healing fallback)', async () => {
    // Nothing exists yet: not even the dev/ parent. The watcher falls back to
    // watching the project root so the agent creating dev/fids/ is noticed.
    const root = makeCaseDir()
    mkdirSync(root, { recursive: true })
    const fidsDir = join(root, 'dev', 'fids')

    let changes = 0
    const watcher = startFidWatcher({
      fidsDir,
      debounceMs: 50,
      onChange: () => {
        changes++
      },
    })

    try {
      mkdirSync(fidsDir, { recursive: true })
      writeFileSync(join(fidsDir, 'FID-2026-0804-007-test.md'), '# FID\n')
      expect(await waitFor(() => changes > 0)).toBe(true)
    } finally {
      watcher.close()
    }
  })
})
