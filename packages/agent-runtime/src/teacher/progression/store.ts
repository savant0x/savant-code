/**
 * Teacher progression store — FID-2026-0813-019.
 *
 * Local-only SQLite with a versioned migration. It persists immutable attempt
 * records (content hashes + version metadata, never raw source, prompts, or
 * critique text) and competency DAG edges. Attempt records are idempotent
 * (INSERT OR IGNORE); a single attempt is an attempt record, not a mastery
 * claim. Reads fail safe on corrupt rows, and a newer on-disk schema refuses
 * to open rather than silently downgrading.
 */
import {
  parseCompetencyEdge,
  parseProgressionRecord,
} from '@savant-code/common/teacher'
import { Database } from 'bun:sqlite'

import type {
  CompetencyEdge,
  ProgressionRecord,
} from '@savant-code/common/teacher'

export const PROGRESSION_SCHEMA_VERSION = 1

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attempts (
  attempt_id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  challenge_hash TEXT NOT NULL,
  skill TEXT NOT NULL,
  completion_state TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  corpus_version TEXT NOT NULL,
  sandbox_policy_version TEXT NOT NULL,
  grader_version TEXT NOT NULL,
  mutation_version TEXT NOT NULL,
  receipt_status TEXT NOT NULL,
  receipt_json TEXT,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS competency_edges (
  skill TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  evidence_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attempts_skill ON attempts(skill);
`

type AttemptRow = {
  attempt_id: string
  challenge_id: string
  challenge_hash: string
  skill: string
  completion_state: string
  evidence_json: string
  corpus_version: string
  sandbox_policy_version: string
  grader_version: string
  mutation_version: string
  receipt_status: string
  receipt_json: string | null
  timestamp: string
}

type CompetencyRow = {
  skill: string
  state: string
  evidence_json: string
}

/** Apply the schema and refuse to open a store newer than this build. */
export function applyProgressionSchema(db: Database): void {
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(SCHEMA_SQL)

  const existing = db
    .query('SELECT MAX(version) AS version FROM schema_version')
    .get() as { version: number | null } | null
  const onDisk = existing?.version ?? 0
  if (onDisk > PROGRESSION_SCHEMA_VERSION) {
    throw new Error(
      `progression store schema v${onDisk} is newer than supported v${PROGRESSION_SCHEMA_VERSION}; refusing to downgrade`,
    )
  }
  db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)').run(
    PROGRESSION_SCHEMA_VERSION,
  )
}

function rowToRecord(row: AttemptRow): ProgressionRecord {
  return {
    attemptId: row.attempt_id,
    challengeId: row.challenge_id,
    challengeHash: row.challenge_hash,
    skill: row.skill,
    completionState:
      row.completion_state as ProgressionRecord['completionState'],
    evidenceHashes: JSON.parse(
      row.evidence_json,
    ) as ProgressionRecord['evidenceHashes'],
    versions: {
      corpus: row.corpus_version,
      sandboxPolicy: row.sandbox_policy_version,
      grader: row.grader_version,
      mutation: row.mutation_version,
    },
    timestamp: row.timestamp,
    receiptStatus: row.receipt_status as ProgressionRecord['receiptStatus'],
    receipt: row.receipt_json ? JSON.parse(row.receipt_json) : null,
  }
}

function rowToCompetency(row: CompetencyRow): CompetencyEdge {
  return {
    skill: row.skill,
    state: row.state as CompetencyEdge['state'],
    evidence: JSON.parse(row.evidence_json) as string[],
  }
}

export class ProgressionStore {
  private readonly db: Database

  constructor(db: Database) {
    this.db = db
  }

  /** Open a store at a path (or ':memory:' for tests). */
  static open(path: string): ProgressionStore {
    const db = new Database(path)
    try {
      applyProgressionSchema(db)
    } catch (error) {
      db.close()
      throw error
    }
    return new ProgressionStore(db)
  }

  close(): void {
    try {
      this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    } catch {
      // in-memory or already closed — nothing to checkpoint
    }
    this.db.close()
  }

  /** Insert an attempt idempotently. Returns true when newly recorded. */
  recordAttempt(record: ProgressionRecord): boolean {
    const parsed = parseProgressionRecord(record)
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO attempts
         (attempt_id, challenge_id, challenge_hash, skill, completion_state,
          evidence_json, corpus_version, sandbox_policy_version,
          grader_version, mutation_version, receipt_status, receipt_json,
          timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        parsed.attemptId,
        parsed.challengeId,
        parsed.challengeHash,
        parsed.skill,
        parsed.completionState,
        JSON.stringify(parsed.evidenceHashes),
        parsed.versions.corpus,
        parsed.versions.sandboxPolicy,
        parsed.versions.grader,
        parsed.versions.mutation,
        parsed.receiptStatus,
        parsed.receipt ? JSON.stringify(parsed.receipt) : null,
        parsed.timestamp,
      )
    return result.changes > 0
  }

  /** Read an attempt; returns null when absent or corrupt (fail-safe). */
  getAttempt(attemptId: string): ProgressionRecord | null {
    const row = this.db
      .query('SELECT * FROM attempts WHERE attempt_id = ?')
      .get(attemptId) as AttemptRow | null
    if (!row) return null
    try {
      return parseProgressionRecord(rowToRecord(row))
    } catch {
      return null
    }
  }

  listAttempts(skill?: string): ProgressionRecord[] {
    const rows = (
      skill
        ? this.db
            .query(
              'SELECT * FROM attempts WHERE skill = ? ORDER BY timestamp ASC',
            )
            .all(skill)
        : this.db.query('SELECT * FROM attempts ORDER BY timestamp ASC').all()
    ) as AttemptRow[]
    const records: ProgressionRecord[] = []
    for (const row of rows) {
      try {
        records.push(parseProgressionRecord(rowToRecord(row)))
      } catch {
        // skip corrupt rows rather than failing the whole listing
      }
    }
    return records
  }

  upsertCompetency(edge: CompetencyEdge): void {
    const parsed = parseCompetencyEdge(edge)
    this.db
      .prepare(
        `INSERT INTO competency_edges (skill, state, evidence_json)
         VALUES (?, ?, ?)
         ON CONFLICT(skill) DO UPDATE SET state = excluded.state, evidence_json = excluded.evidence_json`,
      )
      .run(parsed.skill, parsed.state, JSON.stringify(parsed.evidence))
  }

  getCompetency(skill: string): CompetencyEdge | null {
    const row = this.db
      .query('SELECT * FROM competency_edges WHERE skill = ?')
      .get(skill) as CompetencyRow | null
    if (!row) return null
    try {
      return parseCompetencyEdge(rowToCompetency(row))
    } catch {
      return null
    }
  }

  listCompetencies(): CompetencyEdge[] {
    const rows = this.db
      .query('SELECT * FROM competency_edges')
      .all() as CompetencyRow[]
    const edges: CompetencyEdge[] = []
    for (const row of rows) {
      try {
        edges.push(parseCompetencyEdge(rowToCompetency(row)))
      } catch {
        // skip corrupt rows
      }
    }
    return edges
  }
}
