import fs from 'fs'
import os from 'os'
import path from 'path'

import type { Database } from 'bun:sqlite'

// bun:sqlite is Bun-only. The database connection is opened lazily (see
// getDb) so importing this module never requires bun:sqlite — the package
// stays loadable under Node.js, and only an actual database call resolves it
// (failing with a clear error outside Bun). Same hardening as
// agent-runtime's sqlite-adapter (FID-2026-0804-004); the small
// getRuntimeRequire/resolveBunSqliteDatabaseModule helpers are deliberately
// duplicated here rather than extracted to common — packages/database has
// zero dependencies and adding one for a ~20-line helper is not worth the
// edge.

/** The module-scope `require` when it exists; `undefined` under Node ESM. */
function getRuntimeRequire(): ((id: string) => unknown) | undefined {
  // `typeof` is safe even where `require` is undeclared (Node ESM) — it
  // evaluates to 'undefined' without throwing a ReferenceError.
  return typeof require === 'function' ? require : undefined
}

/**
 * Resolve the bun:sqlite Database constructor, or throw a clear error when
 * the runtime cannot provide it (Node.js CJS/ESM consumers). `requireFn` is
 * injectable for tests; pass explicit `null` to simulate an environment
 * without `require` (Node ESM).
 */
export function resolveBunSqliteDatabaseModule(
  requireFn: ((id: string) => unknown) | null | undefined = getRuntimeRequire(),
): { Database: typeof Database } {
  if (typeof requireFn !== 'function') {
    throw new Error(
      'The database package requires the Bun runtime: bun:sqlite is only available under Bun. Run the CLI/agent with Bun (e.g. `bun run savant-code`) instead of Node.js.',
    )
  }
  try {
    return requireFn('bun:sqlite') as { Database: typeof Database }
  } catch (error) {
    throw new Error(
      `The database package requires the Bun runtime: failed to load bun:sqlite (${
        error instanceof Error ? error.message : String(error)
      }). Run the CLI/agent with Bun instead of Node.js.`,
    )
  }
}

// Database path. SAVANT_DB_PATH is an escape hatch for tests (e.g. ':memory:'
// or a temp file) so the module can be imported against an isolated database
// (FID-2026-0802-006 DB4/DB-tests).
const DB_PATH =
  process.env.SAVANT_DB_PATH ||
  path.join(os.homedir(), '.savant-free', 'echo.db')

function hasColumn(
  connection: Database,
  table: string,
  column: string,
): boolean {
  const rows = connection
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name?: string }>
  return rows.some((row) => row.name === column)
}

// FID-2026-0824-009: migrate the existing sessions seam instead of creating a
// parallel thread database. The migration is idempotent for existing installs
// and is also applied to fresh databases created from the canonical schema.
function applySchemaMigrations(connection: Database): void {
  if (!hasColumn(connection, 'sessions', 'scope_type')) {
    connection.exec(
      "ALTER TABLE sessions ADD COLUMN scope_type TEXT NOT NULL DEFAULT 'project'",
    )
  }
  if (!hasColumn(connection, 'sessions', 'scope_id')) {
    connection.exec(
      "ALTER TABLE sessions ADD COLUMN scope_id TEXT NOT NULL DEFAULT ''",
    )
  }
  if (!hasColumn(connection, 'sessions', 'unread')) {
    connection.exec(
      'ALTER TABLE sessions ADD COLUMN unread INTEGER NOT NULL DEFAULT 0',
    )
  }
  if (!hasColumn(connection, 'sessions', 'pinned')) {
    connection.exec(
      'ALTER TABLE sessions ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0',
    )
  }
}

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
      scope_type TEXT NOT NULL DEFAULT 'project',
      scope_id TEXT NOT NULL DEFAULT '',
      unread INTEGER NOT NULL DEFAULT 0,
      pinned INTEGER NOT NULL DEFAULT 0,
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
    const DatabaseCtor = resolveBunSqliteDatabaseModule().Database
    const connection = new DatabaseCtor(pathToOpen)
    // Enable WAL mode for better performance
    connection.exec('PRAGMA journal_mode = WAL')
    connection.exec('PRAGMA foreign_keys = ON')
    // Initialize schema and record the applied schema version (FID-006 DB4:
    // the schema_version table was created but never written; it now anchors a
    // migration path — see getSchemaVersion).
    createSchema(connection)
    applySchemaMigrations(connection)
    connection
      .prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (1)')
      .run()
    connection
      .prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (2)')
      .run()
    connection
      .prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (3)')
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

// The database connection is opened lazily on first use (FID-2026-0803-002
// DB-1 fail-open semantics preserved — initDatabase still falls back to an
// in-memory database on open failure), so importing this module never touches
// bun:sqlite. This keeps the package loadable under Node.js; only an actual
// database call resolves bun:sqlite and throws a clear error outside Bun.
let db: Database | undefined

/**
 * Returns the lazily-opened database connection, initializing it (and the
 * schema) on first use. The open is guarded by initDatabase's fail-open
 * fallback.
 */
export function getDb(): Database {
  if (db === undefined) {
    db = initDatabase(DB_PATH)
  }
  return db
}

/**
 * Returns the highest applied schema version. Future schema changes must bump
 * the version here and guard with `if (getSchemaVersion() < N) { ... }`.
 */
export function getSchemaVersion(): number {
  const row = getDb()
    .prepare('SELECT MAX(version) as version FROM schema_version')
    .get() as { version: number | null } | null
  return row?.version ?? 0
}

// Export database and types
// FID-2026-0803-002 DB-4: `getDatabase`/`closeDatabase` had zero callers and
// duplicated the `db` export; removed.
export type DatabaseType = Database
