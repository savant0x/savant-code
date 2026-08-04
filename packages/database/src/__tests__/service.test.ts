import { beforeEach, describe, expect, it } from 'bun:test'

// FID-006 DB-tests: run against an isolated in-memory DB. The env var must be
// set BEFORE importing the module (index.ts opens the connection at import).
process.env.SAVANT_DB_PATH = ':memory:'

const {
  createSession,
  getSession,
  getSessionsByChatId,
  updateSession,
  createMessage,
  getMessagesBySessionId,
  createCostRecord,
  getTotalCostBySessionId,
  updateSessionModel,
  getLatestModel,
  createAgentTemplate,
  getAgentTemplate,
  updateAgentTemplate,
  createFidDocument,
  updateFidDocument,
} = await import('../service')
const { db, getSchemaVersion } = await import('../index')

describe('database service (FID-006)', () => {
  beforeEach(() => {
    // Fresh schema per test.
    db.exec(`
      DELETE FROM sessions;
      DELETE FROM agent_templates;
      DELETE FROM fid_documents;
      DELETE FROM message_history;
      DELETE FROM cost_tracking;
    `)
  })

  it('DB4: records and reads the schema version', () => {
    expect(getSchemaVersion()).toBe(1)
  })

  it('DB1: createMessage deduplicates by stable id (INSERT OR IGNORE)', () => {
    const session = createSession('chat-1', 'base', { step: 1 })
    const first = createMessage(
      session.id,
      'user',
      { type: 'text', text: 'hello' },
      'msg-stable-1',
    )
    // Re-persist the same message with the same id — must not create a row.
    const again = createMessage(
      session.id,
      'user',
      { type: 'text', text: 'hello' },
      'msg-stable-1',
    )
    const messages = getMessagesBySessionId(session.id)

    expect(first.id).toBe('msg-stable-1')
    expect(again.id).toBe('msg-stable-1')
    expect(messages).toHaveLength(1)
  })

  it('DB1: distinct messages with distinct ids are all persisted', () => {
    const session = createSession('chat-2', 'base', {})
    createMessage(session.id, 'user', 'a', 'id-a')
    createMessage(session.id, 'assistant', 'b', 'id-b')
    expect(getMessagesBySessionId(session.id)).toHaveLength(2)
  })

  it('DB2: getTotalCostBySessionId sums persisted delta records', () => {
    const session = createSession('chat-3', 'base', {})
    createCostRecord(session.id, 'base', 10, 2)
    createCostRecord(session.id, 'base', 5, 1)
    const totals = getTotalCostBySessionId(session.id)
    expect(totals.total_credits).toBe(15)
    expect(totals.total_direct_credits).toBe(3)
  })

  it('DB3: getLatestModel is scoped to a chat when chatId is given', () => {
    const chatA = createSession('chat-A', 'base', {}, 'model-a')
    const chatB = createSession('chat-B', 'base', {}, 'model-b')

    updateSessionModel(chatA.id, 'model-a-v2')
    expect(getLatestModel('chat-A')).toBe('model-a-v2')
    // The other chat's model is untouched.
    expect(getLatestModel('chat-B')).toBe('model-b')
    // Without a chatId the latest-session behavior still works.
    expect(getLatestModel()).toBe('model-b')
    expect(chatA.id.length).toBeGreaterThan(0)
    expect(chatB.id.length).toBeGreaterThan(0)
  })

  it('DB3: updateSessionModel reports whether a row changed (DB-6)', () => {
    const session = createSession('chat-3x', 'base', {})
    expect(updateSessionModel(session.id, 'model-1')).toBe(true)
    expect(updateSessionModel('missing-id', 'model-1')).toBe(false)
  })

  it('DB2: same-second rows are ordered by insertion (rowid tiebreaker)', () => {
    const session = createSession('chat-2x', 'base', {})
    // created_at has second granularity; all three land in the same second.
    createMessage(session.id, 'user', 'first', 'msg-ord-1')
    createMessage(session.id, 'assistant', 'second', 'msg-ord-2')
    createMessage(session.id, 'user', 'third', 'msg-ord-3')
    const messages = getMessagesBySessionId(session.id)
    expect(messages.map((m) => m.content)).toEqual(['first', 'second', 'third'])
  })

  it('DB6: updateSession / updateAgentTemplate / updateFidDocument report changes', () => {
    const session = createSession('chat-4x', 'base', {})
    expect(updateSession(session.id, { phase: 'green' })).toBe(true)
    expect(updateSession('missing-session', { phase: 'green' })).toBe(false)
    expect(getSession(session.id)?.session_state).toEqual({ phase: 'green' })

    const template = createAgentTemplate({ id: 'tpl-changes', system: 'x' })
    expect(
      updateAgentTemplate('tpl-changes', { id: 'tpl-changes', system: 'y' }),
    ).toBe(true)
    expect(updateAgentTemplate('missing-tpl', { system: 'z' })).toBe(false)
    expect(template.version).toBe(1)

    const fid = createFidDocument(session.id, 'content', 'fid-changes')
    expect(updateFidDocument('fid-changes', 'c2', 'verified', 'complete')).toBe(
      true,
    )
    expect(updateFidDocument('missing-fid', 'c', 'verified', 'complete')).toBe(
      false,
    )
    expect(fid.id).toBe('fid-changes')
  })

  it('DB5: corrupt stored JSON does not throw on read', () => {
    const session = createSession('chat-4', 'base', {})
    db.prepare('UPDATE sessions SET session_state = ? WHERE id = ?').run(
      '{corrupt json',
      session.id,
    )

    const reloaded = getSession(session.id)
    expect(reloaded).not.toBeNull()
    expect(reloaded!.session_state).toEqual({})
  })

  it('DB5: corrupt message content falls back to null, not a throw', () => {
    const session = createSession('chat-5', 'base', {})
    db.prepare(
      'INSERT INTO message_history (id, session_id, role, content) VALUES (?, ?, ?, ?)',
    ).run('corrupt-msg', session.id, 'user', '{nope')
    const messages = getMessagesBySessionId(session.id)
    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBeNull()
  })

  it('round-trips sessions and agent templates', () => {
    const session = createSession('chat-6', 'savant', { phase: 'red' })
    expect(getSession(session.id)?.session_state).toEqual({ phase: 'red' })
    expect(getSessionsByChatId('chat-6')).toHaveLength(1)

    const template = createAgentTemplate({ id: 'savant', system: 'x' })
    expect(getAgentTemplate('savant')?.template).toEqual({
      id: 'savant',
      system: 'x',
    })
    expect(template.version).toBe(1)
  })
})
