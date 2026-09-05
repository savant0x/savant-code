// FID-2026-0819-005 Loop 281: the capture suites (round-trip, concurrency,
// skip-path) stay here; the restore-side suites live in
// checkpoint-store-restore.test.ts.
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'

import {
  captureSnapshot,
  clearOpenTurnsForTesting,
  closeTurn,
  getTurn,
  listTurns,
  openTurn,
  restoreTurn,
} from '../checkpoint-store'

let tmpDir: string

beforeEach(() => {
  clearOpenTurnsForTesting()
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ckpt-'))
})

afterEach(() => {
  clearOpenTurnsForTesting()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

const checkpointDir = () => path.join(tmpDir, 'checkpoints')

function write(path_: string, content: string): void {
  fs.mkdirSync(path.dirname(path_), { recursive: true })
  fs.writeFileSync(path_, content, 'utf8')
}

describe('checkpoint-store', () => {
  describe('capture + close round-trip', () => {
    it('persists a JSON per turn with captured pre-write content', async () => {
      const file = path.join(tmpDir, 'a.ts')
      write(file, 'original')

      openTurn({
        checkpointDir: checkpointDir(),
        turnId: 'turn-1',
        prompt: 'fix a',
      })
      await captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 'turn-1',
        filePath: file,
      })
      // The write happens after capture — content on disk is still original.
      write(file, 'edited')
      await closeTurn({
        checkpointDir: checkpointDir(),
        turnId: 'turn-1',
        prompt: 'fix a',
        messageCount: 3,
        historyLength: 2,
      })

      const checkpoint = getTurn(checkpointDir(), 'turn-1')
      expect(checkpoint).not.toBeNull()
      expect(checkpoint!.prompt).toBe('fix a')
      expect(checkpoint!.messageCount).toBe(3)
      expect(checkpoint!.historyLength).toBe(2)
      expect(checkpoint!.files).toEqual([{ path: file, content: 'original' }])
    })

    it('captures null for files that do not exist yet (created this turn)', async () => {
      const file = path.join(tmpDir, 'new.ts')
      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })
      await captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: file,
      })
      write(file, 'created')
      await closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

      const checkpoint = getTurn(checkpointDir(), 't')
      expect(checkpoint!.files).toEqual([{ path: file, content: null }])
    })

    it('dedupes per path — first capture wins across multiple writes', async () => {
      const file = path.join(tmpDir, 'a.ts')
      write(file, 'v0')
      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })
      await captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: file,
      })
      write(file, 'v1')
      await captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: file,
      })
      await closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

      const checkpoint = getTurn(checkpointDir(), 't')
      expect(checkpoint!.files).toEqual([{ path: file, content: 'v0' }])
    })

    it('openTurn resets a stale buffer so a re-run never inherits captures', async () => {
      const file = path.join(tmpDir, 'a.ts')
      write(file, 'v0')
      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })
      await captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: file,
      })
      write(file, 'v1')
      // Re-open the same turn (simulating a re-run after a crash) — the stale
      // capture must be discarded, and the fresh open captures current state.
      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })
      await captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: file,
      })
      write(file, 'v2')
      await closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

      const checkpoint = getTurn(checkpointDir(), 't')
      expect(checkpoint!.files).toEqual([{ path: file, content: 'v1' }])
    })

    it('is a no-op when checkpointDir is unset (checkpointing disabled)', async () => {
      const file = path.join(tmpDir, 'a.ts')
      write(file, 'original')
      openTurn({ turnId: 't' })
      await captureSnapshot({ turnId: 't', filePath: file })
      expect(await closeTurn({ turnId: 't' })).toBeNull()
      expect(listTurns(checkpointDir())).toEqual([])
    })
  })

  describe('capture concurrency (FID-2026-0815-005 F-04)', () => {
    it('coalesces concurrent captures of the same path onto one read (first-wins)', async () => {
      const file = path.join(tmpDir, 'a.ts')
      write(file, 'v0')
      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })

      const readFileSpy = spyOn(fs.promises, 'readFile')
      await Promise.all([
        captureSnapshot({
          checkpointDir: checkpointDir(),
          turnId: 't',
          filePath: file,
        }),
        captureSnapshot({
          checkpointDir: checkpointDir(),
          turnId: 't',
          filePath: file,
        }),
      ])
      const readCalls = readFileSpy.mock.calls.length
      readFileSpy.mockRestore()

      write(file, 'v1')
      await closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

      const checkpoint = getTurn(checkpointDir(), 't')
      expect(checkpoint!.files).toEqual([{ path: file, content: 'v0' }])
      expect(readCalls).toBe(1)
    })
  })

  describe('capture skip path (FID-2026-0803-005 P1a)', () => {
    it('does not record a non-ENOENT read failure as null (would delete on restore)', async () => {
      // A directory path forces a non-ENOENT read error (EISDIR) on every
      // platform — the old catch-all would have recorded it as `null` and a
      // rewind would have DELETED the directory.
      const dirPath = path.join(tmpDir, 'some-dir')
      fs.mkdirSync(dirPath)

      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })
      await captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: dirPath,
      })
      await closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

      // The path must NOT appear as a `null` (created) entry.
      const checkpoint = getTurn(checkpointDir(), 't')
      expect(checkpoint!.files).toEqual([])

      // Restore touches nothing: the directory survives.
      const restored = restoreTurn({
        checkpointDir: checkpointDir(),
        turnId: 't',
        projectRoot: tmpDir,
      })
      expect(restored).toEqual([])
      expect(fs.statSync(dirPath).isDirectory()).toBe(true)
    })

    it('keeps a skipped path skipped for the rest of the turn', async () => {
      const dirPath = path.join(tmpDir, 'some-dir')
      fs.mkdirSync(dirPath)
      const file = path.join(tmpDir, 'a.ts')
      write(file, 'original')

      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })
      await captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: dirPath,
      })
      // A later capture of the same unreadable path must not flip it to null.
      await captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: dirPath,
      })
      // A normal file is still captured normally in the same turn.
      await captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: file,
      })
      await closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

      const checkpoint = getTurn(checkpointDir(), 't')
      expect(checkpoint!.files).toEqual([{ path: file, content: 'original' }])
    })
  })
})
