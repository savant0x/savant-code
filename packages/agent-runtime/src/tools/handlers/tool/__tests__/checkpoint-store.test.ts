import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import {
  captureSnapshot,
  clearOpenTurnsForTesting,
  closeTurn,
  forkFrom,
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

function read(path_: string): string {
  return fs.readFileSync(path_, 'utf8')
}

describe('checkpoint-store', () => {
  describe('capture + close round-trip', () => {
    it('persists a JSON per turn with captured pre-write content', () => {
      const file = path.join(tmpDir, 'a.ts')
      write(file, 'original')

      openTurn({
        checkpointDir: checkpointDir(),
        turnId: 'turn-1',
        prompt: 'fix a',
      })
      captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 'turn-1',
        filePath: file,
      })
      // The write happens after capture — content on disk is still original.
      write(file, 'edited')
      closeTurn({
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

    it('captures null for files that do not exist yet (created this turn)', () => {
      const file = path.join(tmpDir, 'new.ts')
      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })
      captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: file,
      })
      write(file, 'created')
      closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

      const checkpoint = getTurn(checkpointDir(), 't')
      expect(checkpoint!.files).toEqual([{ path: file, content: null }])
    })

    it('dedupes per path — first capture wins across multiple writes', () => {
      const file = path.join(tmpDir, 'a.ts')
      write(file, 'v0')
      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })
      captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: file,
      })
      write(file, 'v1')
      captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: file,
      })
      closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

      const checkpoint = getTurn(checkpointDir(), 't')
      expect(checkpoint!.files).toEqual([{ path: file, content: 'v0' }])
    })

    it('openTurn resets a stale buffer so a re-run never inherits captures', () => {
      const file = path.join(tmpDir, 'a.ts')
      write(file, 'v0')
      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })
      captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: file,
      })
      write(file, 'v1')
      // Re-open the same turn (simulating a re-run after a crash) — the stale
      // capture must be discarded, and the fresh open captures current state.
      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })
      captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: file,
      })
      write(file, 'v2')
      closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

      const checkpoint = getTurn(checkpointDir(), 't')
      expect(checkpoint!.files).toEqual([{ path: file, content: 'v1' }])
    })

    it('is a no-op when checkpointDir is unset (checkpointing disabled)', () => {
      const file = path.join(tmpDir, 'a.ts')
      write(file, 'original')
      openTurn({ turnId: 't' })
      captureSnapshot({ turnId: 't', filePath: file })
      expect(closeTurn({ turnId: 't' })).toBeNull()
      expect(listTurns(checkpointDir())).toEqual([])
    })
  })

  describe('capture skip path (FID-2026-0803-005 P1a)', () => {
    it('does not record a non-ENOENT read failure as null (would delete on restore)', () => {
      // A directory path forces a non-ENOENT read error (EISDIR) on every
      // platform — the old catch-all would have recorded it as `null` and a
      // rewind would have DELETED the directory.
      const dirPath = path.join(tmpDir, 'some-dir')
      fs.mkdirSync(dirPath)

      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })
      captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: dirPath,
      })
      closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

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

    it('keeps a skipped path skipped for the rest of the turn', () => {
      const dirPath = path.join(tmpDir, 'some-dir')
      fs.mkdirSync(dirPath)
      const file = path.join(tmpDir, 'a.ts')
      write(file, 'original')

      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })
      captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: dirPath,
      })
      // A later capture of the same unreadable path must not flip it to null.
      captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: dirPath,
      })
      // A normal file is still captured normally in the same turn.
      captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: file,
      })
      closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

      const checkpoint = getTurn(checkpointDir(), 't')
      expect(checkpoint!.files).toEqual([{ path: file, content: 'original' }])
    })
  })

  describe('listTurns', () => {
    it('returns newest first with summaries', () => {
      openTurn({ checkpointDir: checkpointDir(), turnId: 'a', prompt: 'one' })
      closeTurn({ checkpointDir: checkpointDir(), turnId: 'a', prompt: 'one' })
      openTurn({ checkpointDir: checkpointDir(), turnId: 'b', prompt: 'two' })
      closeTurn({ checkpointDir: checkpointDir(), turnId: 'b', prompt: 'two' })

      const turns = listTurns(checkpointDir())
      expect(turns.map((t) => t.turnId)).toEqual(['b', 'a'])
      expect(turns[0].prompt).toBe('two')
    })
  })

  describe('retention', () => {
    it('prunes to the most recent CHECKPOINT_RETENTION turns on close', () => {
      const dir = checkpointDir()
      for (let i = 0; i < 25; i++) {
        openTurn({ checkpointDir: dir, turnId: `t${i}` })
        closeTurn({ checkpointDir: dir, turnId: `t${i}` })
      }
      const turns = listTurns(dir)
      expect(turns.length).toBe(20)
      // Newest 20 kept (t5..t24); oldest 5 pruned.
      expect(turns.some((t) => t.turnId === 't24')).toBe(true)
      expect(turns.some((t) => t.turnId === 't3')).toBe(false)
    })
  })

  describe('restoreTurn', () => {
    it('restores files to their pre-edit content', () => {
      const file = path.join(tmpDir, 'a.ts')
      write(file, 'original')
      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })
      captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: file,
      })
      write(file, 'edited')
      closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

      const restored = restoreTurn({
        checkpointDir: checkpointDir(),
        turnId: 't',
        projectRoot: tmpDir,
      })
      expect(restored).toEqual([file])
      expect(read(file)).toBe('original')
    })

    it('deletes files that were created during the turn (content null)', () => {
      const file = path.join(tmpDir, 'new.ts')
      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })
      captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: file,
      })
      write(file, 'created')
      closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

      restoreTurn({
        checkpointDir: checkpointDir(),
        turnId: 't',
        projectRoot: tmpDir,
      })
      expect(fs.existsSync(file)).toBe(false)
    })

    it('skips paths that escape the project root (tampered checkpoint)', () => {
      const outside = path.join(path.dirname(tmpDir), 'outside.txt')
      write(outside, 'precious')
      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })
      captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: outside,
      })
      closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

      const restored = restoreTurn({
        checkpointDir: checkpointDir(),
        turnId: 't',
        projectRoot: tmpDir,
      })
      expect(restored).toEqual([])
      expect(read(outside)).toBe('precious')
    })

    it('restores nothing for a missing turn', () => {
      expect(
        restoreTurn({
          checkpointDir: checkpointDir(),
          turnId: 'nope',
          projectRoot: tmpDir,
        }),
      ).toEqual([])
    })
  })

  describe('forkFrom', () => {
    it('restores files and returns the checkpoint for seeding a new session', () => {
      const file = path.join(tmpDir, 'a.ts')
      write(file, 'original')
      openTurn({
        checkpointDir: checkpointDir(),
        turnId: 't',
        prompt: 'seed',
        messageCount: 4,
        historyLength: 3,
      })
      captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: file,
      })
      write(file, 'edited')
      closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

      const forked = forkFrom({
        checkpointDir: checkpointDir(),
        turnId: 't',
        projectRoot: tmpDir,
      })
      expect(forked).not.toBeNull()
      expect(forked!.messageCount).toBe(4)
      expect(forked!.historyLength).toBe(3)
      expect(read(file)).toBe('original')
    })

    it('returns null for a missing turn', () => {
      expect(
        forkFrom({
          checkpointDir: checkpointDir(),
          turnId: 'nope',
          projectRoot: tmpDir,
        }),
      ).toBeNull()
    })

    it('deletes files created during the turn (content null) when forking', () => {
      const file = path.join(tmpDir, 'new.ts')
      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })
      captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: file,
      })
      write(file, 'created')
      closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

      forkFrom({
        checkpointDir: checkpointDir(),
        turnId: 't',
        projectRoot: tmpDir,
      })
      expect(fs.existsSync(file)).toBe(false)
    })
  })

  describe('openTurn isolation', () => {
    it('separates buffers per (dir, turnId)', () => {
      const fileA = path.join(tmpDir, 'a.ts')
      const fileB = path.join(tmpDir, 'b.ts')
      write(fileA, 'a0')
      write(fileB, 'b0')
      openTurn({ checkpointDir: checkpointDir(), turnId: 't1' })
      openTurn({ checkpointDir: checkpointDir(), turnId: 't2' })
      captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't1',
        filePath: fileA,
      })
      captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't2',
        filePath: fileB,
      })
      closeTurn({ checkpointDir: checkpointDir(), turnId: 't1' })
      closeTurn({ checkpointDir: checkpointDir(), turnId: 't2' })

      const t1 = getTurn(checkpointDir(), 't1')
      const t2 = getTurn(checkpointDir(), 't2')
      expect(t1!.files.map((f) => f.path)).toEqual([fileA])
      expect(t2!.files.map((f) => f.path)).toEqual([fileB])
    })
  })
})
