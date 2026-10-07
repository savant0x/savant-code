/**
 * Process-wide test isolation for the database suite (FID-2026-1007-002).
 *
 * `bun test` loads every file into ONE process, so a module that keeps
 * process-lifetime state leaks across suites: a cached connection, a prepared
 * statement bound to it, or a serialized mutation lane one file established is
 * the one the next file finds, and a suite's verdict then depends on file
 * order. `bun run scripts/module-state-check.ts` enumerates every such binding;
 * this preload calls each reset before every case — the connection cache and
 * the statement cache TOGETHER, since a statement is only valid for the
 * connection it was prepared on.
 */
import { afterAll, beforeEach } from 'bun:test'

import { resetCommitJournal } from '../src/commit-journal'
import { resetDatabaseConnections } from '../src/index'
import { resetMutationLine } from '../src/mutation-line'
import { resetSqliteState } from '../src/sqlite'

beforeEach(() => {
  resetMutationLine()
  resetCommitJournal()
})

/**
 * The connection and statement caches are cleared at the FILE boundary, not per
 * case. An in-memory database's connection IS the database: clearing the cache
 * between cases hands the next case a different (empty) database, while a
 * handle the file captured earlier still points at the old one — measured, not
 * assumed: with a per-case clear, the DB5 corrupt-content test's insert failed
 * `FOREIGN KEY constraint failed` because `createSession` and the test's own
 * `db` handle were talking to two different in-memory databases. Clearing after
 * each file still removes the cross-file leak, which is the state this preload
 * exists to prevent.
 */
afterAll(() => {
  resetDatabaseConnections()
  resetSqliteState()
})
