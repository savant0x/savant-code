import fs from 'fs'
import os from 'os'
import path from 'path'

import { Database } from 'bun:sqlite'

// Database path. SAVANT_DB_PATH is an escape hatch for tests (e.g. ':memory:'
// or a temp file) so the module can be imported against an isolated database
// (FID-2026-0802-006 DB4/DB-tests).
const DB_PATH =
  process.env.SAVANT_DB_PATH ||
  path.join(os.homedir(), '.savant-free', 'echo.db')

// Create schema (uses the passed connection so the fail-open fallback can
// initialize an in-memory database the same way).
function createSchema(connection: Database): void {
  connection.exec(`
    -- Schema version tracking
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Sessions: Core session state and metadata
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      selected_model TEXT DEFAULT '',
      session_state TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Agent Templates: Agent definition templates
    CREATE TABLE IF NOT EXISTS agent_templates (
      id TEXT PRIMARY KEY,
      template TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- FID Documents: Foundation Implementation Documents
    CREATE TABLE IF NOT EXISTS fid_documents (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id),
      content TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      perfection_loop_phase TEXT DEFAULT 'idle',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Message History: Chat messages
    CREATE TABLE IF NOT EXISTS message_history (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Cost Tracking: Cost and usage analytics
    CREATE TABLE IF NOT EXISTS cost_tracking (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id),
      agent_id TEXT NOT NULL,
      credits_used REAL DEFAULT 0,
      direct_credits_used REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_sessions_chat_id ON sessions(chat_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON sessions(agent_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_fid_documents_session_id ON fid_documents(session_id);
    CREATE INDEX IF NOT EXISTS idx_fid_documents_status ON fid_documents(status);
    CREATE INDEX IF NOT EXISTS idx_message_history_session_id ON message_history(session_id);
    CREATE INDEX IF NOT EXISTS idx_cost_tracking_session_id ON cost_tracking(session_id);
    CREATE INDEX IF NOT EXISTS idx_cost_tracking_agent_id ON cost_tracking(agent_id);
  `)
}

/**
 * Open a database connection with WAL + foreign keys enabled and the schema
 * initialized. FID-2026-0803-002 DB-1: the open + DDL are guarded so a corrupt
 * or unwritable database file (or a missing directory for a custom
 * SAVANT_DB_PATH) fails open to an in-memory database instead of crashing the
 * whole CLI at import time.
 */
function initDatabase(dbPath: string): Database {
  const initialize = (pathToOpen: string): Database => {
    const connection = new Database(pathToOpen)
    // Enable WAL mode for better performance
    connection.exec('PRAGMA journal_mode = WAL')
    connection.exec('PRAGMA foreign_keys = ON')
    // Initialize schema and record the applied schema version (FID-006 DB4:
    // the schema_version table was created but never written; it now anchors a
    // migration path — see getSchemaVersion).
    createSchema(connection)
    connection
      .prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (1)')
      .run()
    return connection
  }

  try {
    // Ensure directory exists (skipped for :memory: and other non-file targets)
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    }
    return initialize(dbPath)
  } catch (error) {
    // Fail-open: fall back to an in-memory database so the CLI can still run.
    // The write path is lost for the session, but startup and existing
    // sessions degrade gracefully instead of hard-crashing on import.
    // eslint-disable-next-line no-console -- startup diagnostic; no structured logger in this package
    console.warn(
      `[database] Could not open database at ${dbPath} (${error instanceof Error ? error.message : String(error)}); falling back to an in-memory database.`,
    )
    return initialize(':memory:')
  }
}

// Create database connection (guarded, see initDatabase)
const db = initDatabase(DB_PATH)

/**
 * Returns the highest applied schema version. Future schema changes must bump
 * the version here and guard with `if (getSchemaVersion() < N) { ... }`.
 */
export function getSchemaVersion(): number {
  const row = db
    .prepare('SELECT MAX(version) as version FROM schema_version')
    .get() as { version: number | null } | null
  return row?.version ?? 0
}

// Export database and types
// FID-2026-0803-002 DB-4: `getDatabase`/`closeDatabase` had zero callers and
// duplicated the `db` export; removed.
export { db }
export type DatabaseType = typeof db
