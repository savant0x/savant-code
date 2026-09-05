// Shared harness for the sqlite-adapter test family.
// Sibling of the Loop 349 decomposition (suite files all import these).
import fs from 'fs'
import os from 'os'
import path from 'path'

import { Database } from 'bun:sqlite'
import { afterAll, beforeAll } from 'bun:test'

export const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
} as never

// Handlers take a single params object ({ previousToolCallFinished, toolCall,
// logger }); the handler executor resolves these at runtime. `previousToolCallFinished`
// must be a resolved promise (handlers await it) and `logger` must be a no-op Logger.
export const makeToolCall = (input: object) =>
  ({
    previousToolCallFinished: Promise.resolve(),
    toolCall: { input },
    logger: noopLogger,
  }) as never

// NOTE: a :memory: SQLite database is PER-CONNECTION — each handler call opens
// its own fresh :memory: DB (empty). The integration tests therefore use a
// temp FILE database so seeded tables survive across handler calls.
export const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-db-test-'))
export const DB_PATH = path.join(tempDir, 'test.db')

export function seed(db: Database) {
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      title TEXT NOT NULL
    );
    INSERT INTO users (id, email, name) VALUES (1, 'a@example.com', 'Alice');
    INSERT INTO users (id, email, name) VALUES (2, 'b@example.com', 'Bob');
    INSERT INTO posts (id, user_id, title) VALUES (1, 1, 'Hello');
  `)
}

let seededDb: Database | null = null

// Only the handler-integration suite registers this lifecycle; the pure
// helper suites never touch the temp-file database.
export function registerSeededDbLifecycle(): void {
  beforeAll(() => {
    seededDb = new Database(DB_PATH)
    seed(seededDb)
  })
  afterAll(() => {
    seededDb?.close()
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // best-effort cleanup
    }
  })
}
