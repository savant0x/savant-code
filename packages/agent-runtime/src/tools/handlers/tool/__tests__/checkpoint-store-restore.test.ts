// FID-2026-0819-005 Loop 281: the listTurns, retention, restoreTurn,
// forkFrom, and openTurn-isolation suites moved verbatim from
// checkpoint-store.test.ts; harness copied verbatim, import header pruned
// to symbols this file uses.
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
  describe('listTurns', () => {
    it('returns newest first with summaries', async () => {
      openTurn({ checkpointDir: checkpointDir(), turnId: 'a', prompt: 'one' })
      await closeTurn({
        checkpointDir: checkpointDir(),
        turnId: 'a',
        prompt: 'one',
      })
      openTurn({ checkpointDir: checkpointDir(), turnId: 'b', prompt: 'two' })
      await closeTurn({
        checkpointDir: checkpointDir(),
        turnId: 'b',
        prompt: 'two',
      })

      const turns = listTurns(checkpointDir())
      expect(turns.map((t) => t.turnId)).toEqual(['b', 'a'])
      expect(turns[0].prompt).toBe('two')
    })
  })

  describe('retention', () => {
    it('prunes to the most recent CHECKPOINT_RETENTION turns on close', async () => {
      const dir = checkpointDir()
      for (let i = 0; i < 25; i++) {
        openTurn({ checkpointDir: dir, turnId: `t${i}` })
        await closeTurn({ checkpointDir: dir, turnId: `t${i}` })
      }
      const turns = listTurns(dir)
      expect(turns.length).toBe(20)
      // Newest 20 kept (t5..t24); oldest 5 pruned.
      expect(turns.some((t) => t.turnId === 't24')).toBe(true)
      expect(turns.some((t) => t.turnId === 't3')).toBe(false)
    })
  })

  describe('restoreTurn', () => {
    it('restores files to their pre-edit content', async () => {
      const file = path.join(tmpDir, 'a.ts')
      write(file, 'original')
      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })
      await captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: file,
      })
      write(file, 'edited')
      await closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

      const restored = restoreTurn({
        checkpointDir: checkpointDir(),
        turnId: 't',
        projectRoot: tmpDir,
      })
      expect(restored).toEqual([file])
      expect(read(file)).toBe('original')
    })

    it('deletes files that were created during the turn (content null)', async () => {
      const file = path.join(tmpDir, 'new.ts')
      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })
      await captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: file,
      })
      write(file, 'created')
      await closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

      restoreTurn({
        checkpointDir: checkpointDir(),
        turnId: 't',
        projectRoot: tmpDir,
      })
      expect(fs.existsSync(file)).toBe(false)
    })

    it('skips paths that escape the project root (tampered checkpoint)', async () => {
      const outside = path.join(path.dirname(tmpDir), 'outside.txt')
      write(outside, 'precious')
      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })
      await captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: outside,
      })
      await closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

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
    it('restores files and returns the checkpoint for seeding a new session', async () => {
      const file = path.join(tmpDir, 'a.ts')
      write(file, 'original')
      openTurn({
        checkpointDir: checkpointDir(),
        turnId: 't',
        prompt: 'seed',
        messageCount: 4,
        historyLength: 3,
      })
      await captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: file,
      })
      write(file, 'edited')
      await closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

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

    it('deletes files created during the turn (content null) when forking', async () => {
      const file = path.join(tmpDir, 'new.ts')
      openTurn({ checkpointDir: checkpointDir(), turnId: 't' })
      await captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't',
        filePath: file,
      })
      write(file, 'created')
      await closeTurn({ checkpointDir: checkpointDir(), turnId: 't' })

      forkFrom({
        checkpointDir: checkpointDir(),
        turnId: 't',
        projectRoot: tmpDir,
      })
      expect(fs.existsSync(file)).toBe(false)
    })
  })

  describe('openTurn isolation', () => {
    it('separates buffers per (dir, turnId)', async () => {
      const fileA = path.join(tmpDir, 'a.ts')
      const fileB = path.join(tmpDir, 'b.ts')
      write(fileA, 'a0')
      write(fileB, 'b0')
      openTurn({ checkpointDir: checkpointDir(), turnId: 't1' })
      openTurn({ checkpointDir: checkpointDir(), turnId: 't2' })
      await captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't1',
        filePath: fileA,
      })
      await captureSnapshot({
        checkpointDir: checkpointDir(),
        turnId: 't2',
        filePath: fileB,
      })
      await closeTurn({ checkpointDir: checkpointDir(), turnId: 't1' })
      await closeTurn({ checkpointDir: checkpointDir(), turnId: 't2' })

      const t1 = getTurn(checkpointDir(), 't1')
      const t2 = getTurn(checkpointDir(), 't2')
      expect(t1!.files.map((f) => f.path)).toEqual([fileA])
      expect(t2!.files.map((f) => f.path)).toEqual([fileB])
    })
  })
})
