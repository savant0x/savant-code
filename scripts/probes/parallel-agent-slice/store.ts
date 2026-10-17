import { z } from 'zod/v4'

import { resolveBunSqliteDatabaseModule } from '@savant-code/database'

import { artifactSchema } from './types'

import type { Artifact, Assignment } from './types'
import type { Database } from 'bun:sqlite'

interface OwnerRow {
  generation: number
  revision: number
  source: string
  paused: number
  context: string
}
interface TaskRow {
  id: string
  spec: string
  state: string
  attempt: number
  artifact: string | null
}

/** Experiment-owned database; never opens the operator's session database. */
export class SliceStore {
  readonly db: Database

  constructor(filename: string, source: string) {
    const Sqlite = resolveBunSqliteDatabaseModule().Database
    this.db = new Sqlite(filename)
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS owner (
        id INTEGER PRIMARY KEY CHECK(id=1), generation INTEGER NOT NULL,
        revision INTEGER NOT NULL, source TEXT NOT NULL,
        paused INTEGER NOT NULL DEFAULT 0, context TEXT NOT NULL DEFAULT '[]'
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, spec TEXT NOT NULL, state TEXT NOT NULL,
        attempt INTEGER NOT NULL DEFAULT 0, artifact TEXT
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY, task TEXT NOT NULL REFERENCES tasks(id),
        generation INTEGER NOT NULL, body TEXT NOT NULL,
        applied INTEGER NOT NULL DEFAULT 0
      );
    `)
    this.db
      .query(
        'INSERT OR IGNORE INTO owner(id,generation,revision,source) VALUES(1,1,0,?)',
      )
      .run(source)
    if (this.owner().source !== source) {
      this.db.close()
      throw new Error('Source fingerprint changed; resume refused')
    }
  }

  owner(): OwnerRow {
    const row = this.db
      .query<OwnerRow, []>('SELECT * FROM owner WHERE id=1')
      .get()
    if (!row) throw new Error('Missing experiment owner')
    return row
  }

  task(id: string): TaskRow {
    const row = this.db
      .query<TaskRow, [string]>('SELECT * FROM tasks WHERE id=?')
      .get(id)
    if (!row) throw new Error(`Unknown task ${id}`)
    return row
  }

  admit(assignment: Assignment): void {
    const spec = JSON.stringify(assignment)
    this.db
      .query("INSERT OR IGNORE INTO tasks(id,spec,state) VALUES(?,?,'queued')")
      .run(assignment.id, spec)
    if (this.task(assignment.id).spec !== spec)
      throw new Error('Admission identity conflict')
  }

  claim(id: string): { generation: number; attempt: number } {
    return this.db.transaction(() => {
      const owner = this.owner()
      if (owner.paused) throw new Error('Workflow paused')
      const updated = this.db
        .query("UPDATE tasks SET state='running' WHERE id=? AND state='queued'")
        .run(id)
      if (updated.changes !== 1) throw new Error(`Task ${id} is not queued`)
      return { generation: owner.generation, attempt: this.task(id).attempt }
    })()
  }

  complete(
    id: string,
    generation: number,
    attempt: number,
    artifact: Artifact,
  ): boolean {
    const body = JSON.stringify(artifactSchema.parse(artifact))
    return this.db.transaction(() => {
      const task = this.task(id)
      if (this.owner().generation !== generation || task.attempt !== attempt)
        return false
      if (task.state === 'succeeded') {
        if (task.artifact !== body)
          throw new Error('Completion identity conflict')
        return true
      }
      if (task.state !== 'running') return false
      if (artifact.taskId !== id)
        throw new Error('Artifact belongs to another task')
      this.db
        .query("UPDATE tasks SET state='succeeded', artifact=? WHERE id=?")
        .run(body, id)
      this.db
        .query('INSERT INTO events(id,task,generation,body) VALUES(?,?,?,?)')
        .run(`${id}:${generation}:${attempt}`, id, generation, body)
      return true
    })()
  }

  consume(
    expectedRevision = this.owner().revision,
    beforeAck?: () => void,
  ): Artifact[] {
    return this.db.transaction(() => {
      const owner = this.owner()
      if (owner.paused || owner.revision !== expectedRevision)
        throw new Error('Owner revision conflict')
      const events = this.db
        .query<{ id: string; body: string }, [number]>(
          'SELECT id,body FROM events WHERE generation=? AND applied=0 ORDER BY rowid',
        )
        .all(owner.generation)
      const context = z.array(artifactSchema).parse(JSON.parse(owner.context))
      const incoming = events.map((event) =>
        artifactSchema.parse(JSON.parse(event.body)),
      )
      if (events.length === 0) return []
      this.db
        .query('UPDATE owner SET context=?, revision=revision+1 WHERE id=1')
        .run(JSON.stringify([...context, ...incoming]))
      beforeAck?.()
      for (const event of events)
        this.db.query('UPDATE events SET applied=1 WHERE id=?').run(event.id)
      return incoming
    })()
  }

  fail(id: string): void {
    this.db
      .query("UPDATE tasks SET state='failed' WHERE id=? AND state='running'")
      .run(id)
  }

  cancel(): void {
    this.db.transaction(() => {
      this.db.exec(
        'UPDATE owner SET generation=generation+1, revision=revision+1, paused=2 WHERE id=1',
      )
      this.db.exec(
        "UPDATE tasks SET state='cancelled' WHERE state IN ('queued','running','interrupted')",
      )
    })()
  }

  recover(): void {
    this.db.transaction(() => {
      if (this.owner().paused === 2)
        throw new Error('Cancelled intent cannot recover')
      this.db.exec('UPDATE owner SET revision=revision+1, paused=1 WHERE id=1')
      this.db.exec("UPDATE tasks SET state='interrupted' WHERE state='running'")
    })()
  }

  resume(): void {
    this.db.transaction(() => {
      if (this.owner().paused !== 1)
        throw new Error('Only interrupted work can resume')
      this.db.exec(
        "UPDATE tasks SET state='queued', attempt=attempt+1 WHERE state='interrupted'",
      )
      this.db.exec('UPDATE owner SET paused=0 WHERE id=1')
    })()
  }

  close(): void {
    this.db.close(true)
  }
}
