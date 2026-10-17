import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { SliceStore } from './store'

import type { Artifact, Assignment } from './types'

const assignment: Assignment = {
  id: 'A',
  question: 'Read source',
  files: ['source.ts'],
  dependsOn: [],
}
const artifact: Artifact = {
  taskId: 'A',
  answer: 'Actual unit-test artifact for transaction checks',
  citations: [
    { path: 'source.ts', line: 1, quote: 'source quotation' },
    { path: 'source.ts', line: 2, quote: 'second quotation' },
  ],
  usedHandoffs: [],
}

describe('experimental durable task ownership', () => {
  test('duplicate admission and completion deliver once; changed identity fails', () => {
    const store = new SliceStore(':memory:', 'source')
    try {
      store.admit(assignment)
      store.admit(assignment)
      expect(() => store.admit({ ...assignment, question: 'Changed' })).toThrow(
        'identity conflict',
      )
      const claim = store.claim('A')
      expect(
        store.complete('A', claim.generation, claim.attempt, artifact),
      ).toBe(true)
      expect(
        store.complete('A', claim.generation, claim.attempt, artifact),
      ).toBe(true)
      expect(() =>
        store.complete('A', claim.generation, claim.attempt, {
          ...artifact,
          answer: 'A different completed response',
        }),
      ).toThrow('identity conflict')
      expect(store.consume()).toEqual([artifact])
      expect(store.consume()).toEqual([])
      expect(JSON.parse(store.owner().context)).toHaveLength(1)
    } finally {
      store.close()
    }
  })

  test('state/ack rollback retains a completion, stale revisions refuse', () => {
    const store = new SliceStore(':memory:', 'source')
    try {
      store.admit(assignment)
      const claim = store.claim('A')
      store.complete('A', claim.generation, claim.attempt, artifact)
      expect(() =>
        store.consume(0, () => {
          throw new Error('injected boundary failure')
        }),
      ).toThrow('injected')
      expect(store.owner().revision).toBe(0)
      expect(store.owner().context).toBe('[]')
      expect(store.consume()).toEqual([artifact])
      expect(() => store.consume(0)).toThrow('revision conflict')
    } finally {
      store.close()
    }
  })

  test('cancellation fences late completion and preserves an honest state', () => {
    const store = new SliceStore(':memory:', 'source')
    try {
      store.admit(assignment)
      const claim = store.claim('A')
      store.cancel()
      expect(
        store.complete('A', claim.generation, claim.attempt, artifact),
      ).toBe(false)
      expect(store.task('A').state).toBe('cancelled')
      expect(store.owner().context).toBe('[]')
    } finally {
      store.close()
    }
  })

  test('close/reopen retains pending delivery and requires explicit interrupted-task resume', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'parallel-slice-'))
    const filename = path.join(directory, 'tasks.sqlite')
    let store = new SliceStore(filename, 'source')
    try {
      store.admit(assignment)
      let claim = store.claim('A')
      store.complete('A', claim.generation, claim.attempt, artifact)
      store.close()
      store = new SliceStore(filename, 'source')
      store.admit({ ...assignment, id: 'B' })
      const old = store.claim('B')
      store.close()
      store = new SliceStore(filename, 'source')
      store.recover()
      expect(store.task('B').state).toBe('interrupted')
      expect(() => store.claim('B')).toThrow('paused')
      store.resume()
      expect(store.consume()).toEqual([artifact])
      claim = store.claim('B')
      expect(claim.attempt).toBe(old.attempt + 1)
      expect(
        store.complete('B', old.generation, old.attempt, {
          ...artifact,
          taskId: 'B',
        }),
      ).toBe(false)
      expect(
        store.complete('B', claim.generation, claim.attempt, {
          ...artifact,
          taskId: 'B',
        }),
      ).toBe(true)
      expect(() => new SliceStore(filename, 'changed-source')).toThrow(
        'fingerprint changed',
      )
    } finally {
      store.close()
      const resolved = path.resolve(directory)
      if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep))
        throw new Error('Unsafe test cleanup target')
      rmSync(resolved, { recursive: true, force: true })
    }
  })

  test('a killed writer leaves a committed completion available after process restart', async () => {
    const directory = mkdtempSync(
      path.join(os.tmpdir(), 'parallel-slice-crash-'),
    )
    const filename = path.join(directory, 'tasks.sqlite')
    const child = Bun.spawn(
      [
        process.execPath,
        '-e',
        `import { SliceStore } from './scripts/probes/parallel-agent-slice/store';
       const store = new SliceStore(process.argv[1], 'source');
       store.admit(${JSON.stringify(assignment)});
       const claim = store.claim('A');
       store.complete('A', claim.generation, claim.attempt, ${JSON.stringify(artifact)});
       process.stdout.write('COMMITTED');
       await Bun.sleep(60000);`,
        filename,
      ],
      {
        cwd: path.resolve(import.meta.dir, '../../..'),
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    let store: SliceStore | undefined
    try {
      const ready = await child.stdout.getReader().read()
      expect(new TextDecoder().decode(ready.value)).toBe('COMMITTED')
      child.kill('SIGKILL')
      await child.exited
      store = new SliceStore(filename, 'source')
      store.recover()
      store.resume()
      expect(store.consume()).toEqual([artifact])
      expect(store.consume()).toEqual([])
    } finally {
      if (child.exitCode === null) {
        child.kill('SIGKILL')
        await child.exited
      }
      store?.close()
      const resolved = path.resolve(directory)
      if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep))
        throw new Error('Unsafe test cleanup target')
      rmSync(resolved, { recursive: true, force: true })
    }
  })
})
