import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { CIRCULAR_REFERENCE_MARKER } from '@savant-code/common/util/safe-json'
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nested-session-state-'))
const databasePath = path.join(tempDir, 'echo.db')
process.env.SAVANT_DB_PATH = databasePath

const { createSession, getSession } = await import('../service')
const { getDb, resolveBunSqliteDatabaseModule } = await import('../index')
const db = getDb()

afterAll(() => {
  process.env.SAVANT_DB_PATH = ':memory:'
  try {
    fs.rmSync(tempDir, { recursive: true, force: true })
  } catch {
    // The lazily-opened connection may still hold the file on Windows.
  }
})

beforeEach(() => {
  db.exec('DELETE FROM sessions; DELETE FROM message_history;')
})

describe('LF-003 durable nested session state', () => {
  it('preserves child state and marks unexpected cycles', () => {
    const childState = { conversation: ['child message'] }
    const mainAgentState: Record<string, unknown> = {
      child: { state: childState },
    }
    mainAgentState.runtime = { parent: mainAgentState }

    const session = createSession('chat-nested-cycle', 'base', {
      mainAgentState,
    })
    const persisted = getSession(session.id)?.session_state as {
      mainAgentState: Record<string, unknown>
    }

    expect(persisted.mainAgentState.child).toEqual({ state: childState })
    expect(
      (persisted.mainAgentState.runtime as Record<string, unknown>).parent,
    ).toBe(CIRCULAR_REFERENCE_MARKER)

    const DatabaseCtor = resolveBunSqliteDatabaseModule().Database
    const reopened = new DatabaseCtor(databasePath)
    try {
      const row = reopened
        .prepare('SELECT session_state FROM sessions WHERE id = ?')
        .get(session.id) as { session_state: string }
      const restored = JSON.parse(row.session_state) as {
        mainAgentState: Record<string, unknown>
      }

      expect(restored.mainAgentState.child).toEqual({ state: childState })
      expect(
        (restored.mainAgentState.runtime as Record<string, unknown>).parent,
      ).toBe(CIRCULAR_REFERENCE_MARKER)
    } finally {
      reopened.close()
    }
  })
})
