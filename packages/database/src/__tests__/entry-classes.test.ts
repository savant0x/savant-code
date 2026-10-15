import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeEach, describe, expect, it } from 'bun:test'

// FID-006 DB-tests pattern: isolated in-memory DB. The env var must be set
// BEFORE importing the module (DB_PATH is computed at import; the connection
// opens lazily on first use).
//
// `bun test` shares one module registry across files, so this file owns its
// OWN temp-file path (not `:memory:`, which service.test.ts owns) and
// re-asserts it per test; `afterAll` hands the escape hatch back so file
// order cannot leak this file's database into a sibling suite (the
// durable-races.test.ts pattern; see `resolveDbPath`'s per-path connection
// cache).
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'entry-classes-'))
process.env.SAVANT_DB_PATH = path.join(tempDir, 'echo.db')

const { createSession } = await import('../sessions')
const {
  createCustomEntry,
  createCustomMessageEntry,
  createEntry,
  createLabelEntry,
  createMessage,
  saveConversationMessages,
  createModelChangeEntry,
  createThinkingLevelChangeEntry,
  getEntriesByKind,
  getInContextMessages,
  getMessage,
  getMessagesBySessionId,
  setEntryExcludeFromContext,
} = await import('../history')

afterAll(() => {
  // Hand the escape hatch back to the in-memory path the sibling suite uses,
  // so file order cannot leak this file's database into it.
  process.env.SAVANT_DB_PATH = ':memory:'
  // Windows refuses to remove an open file — best-effort cleanup.
  try {
    fs.rmSync(tempDir, { recursive: true, force: true })
  } catch {
    // ignored: the lazily-opened connection may still hold the file
  }
})

let sessionId = ''

beforeEach(() => {
  process.env.SAVANT_DB_PATH = path.join(tempDir, 'echo.db')
  const session = createSession(
    `chat-${Math.random().toString(36).slice(2)}`,
    'agent-wp11',
    { test: 'entry-classes' },
  )
  sessionId = session.id
})

describe('entry classes: custom vs custom_message (FID-2026-1006-002 WP11)', () => {
  it('custom entries are extension state OUTSIDE the LLM context', () => {
    const entry = createCustomEntry(sessionId, { panel: 'sidebar-state' })
    expect(entry.entry_kind).toBe('custom')
    expect(entry.exclude_from_context).toBe(true)
    expect(entry.content).toEqual({ panel: 'sidebar-state' })
  })

  it('custom_message entries are custom content IN context', () => {
    const entry = createCustomMessageEntry(
      sessionId,
      'user',
      'operator note pinned into context',
    )
    expect(entry.entry_kind).toBe('custom_message')
    expect(entry.exclude_from_context).toBe(false)
  })

  it('getInContextMessages drops custom entries but keeps custom_message entries', () => {
    createCustomEntry(sessionId, { hidden: true })
    const inContext = createCustomMessageEntry(sessionId, 'user', 'visible')
    const visible = getInContextMessages(sessionId)
    expect(visible.map((e) => e.id)).toEqual([inContext.id])
  })
})

describe('entry classes: label bookmarks', () => {
  it('stores the label as a bookmark entry outside the LLM context', () => {
    const entry = createLabelEntry(sessionId, 'before-refactor')
    expect(entry.entry_kind).toBe('label')
    expect(entry.exclude_from_context).toBe(true)
    expect(entry.content).toEqual({ label: 'before-refactor' })
    const labels = getEntriesByKind(sessionId, 'label')
    expect(labels).toHaveLength(1)
    expect(labels[0].content).toEqual({ label: 'before-refactor' })
  })
})

describe('entry classes: audit entries', () => {
  it('model_change records from → to outside the LLM context', () => {
    const entry = createModelChangeEntry(sessionId, 'glm-5.3-flash', 'glm-5.3')
    expect(entry.entry_kind).toBe('model_change')
    expect(entry.exclude_from_context).toBe(true)
    expect(entry.content).toEqual({ from: 'glm-5.3-flash', to: 'glm-5.3' })
  })

  it('thinking_level_change records from → to outside the LLM context', () => {
    const entry = createThinkingLevelChangeEntry(sessionId, 'low', 'high')
    expect(entry.entry_kind).toBe('thinking_level_change')
    expect(entry.exclude_from_context).toBe(true)
    expect(entry.content).toEqual({ from: 'low', to: 'high' })
  })

  it('audit entries never leak into getInContextMessages', () => {
    createModelChangeEntry(sessionId, 'a', 'b')
    createThinkingLevelChangeEntry(sessionId, 'low', 'high')
    const plain = createMessage(sessionId, 'user', 'hello')
    expect(getInContextMessages(sessionId).map((e) => e.id)).toEqual([plain.id])
  })
})

describe('entry classes: excludeFromContext on raw-output entries', () => {
  it('createEntry honors an explicit exclusion bit', () => {
    const entry = createEntry({
      sessionId,
      role: 'tool',
      content: { raw: 'x'.repeat(4096) },
      entryKind: 'message',
      excludeFromContext: true,
    })
    expect(entry.exclude_from_context).toBe(true)
    expect(getInContextMessages(sessionId)).toHaveLength(0)
  })

  it('setEntryExcludeFromContext flips the bit on an existing entry', () => {
    const entry = createMessage(sessionId, 'tool', { raw: 'output' })
    expect(entry.entry_kind).toBe('message')
    expect(entry.exclude_from_context).toBe(false)
    expect(setEntryExcludeFromContext(entry.id, true)).toBe(true)
    expect(getMessage(entry.id)?.exclude_from_context).toBe(true)
    expect(getInContextMessages(sessionId)).toHaveLength(0)
    expect(setEntryExcludeFromContext(entry.id, false)).toBe(true)
    expect(getInContextMessages(sessionId)).toHaveLength(1)
  })

  it('returns false when the entry id does not exist', () => {
    expect(setEntryExcludeFromContext('missing-id', true)).toBe(false)
  })
})

describe('FID-2026-1011-006 mutable conversations', () => {
  it('updates stable content without moving history or overwriting audits', () => {
    const id = `mutable:${sessionId}`
    saveConversationMessages(sessionId, [
      { id, role: 'assistant', content: 'initial' },
    ])
    const created = getMessage(id)?.created_at
    saveConversationMessages(sessionId, [
      { id, role: 'assistant', content: 'final' },
    ])
    expect(getMessage(id)?.content).toBe('final')
    expect(getMessage(id)?.created_at).toBe(created)
    const audit = createCustomEntry(sessionId, { secret: 'audit' })
    expect(() =>
      saveConversationMessages(sessionId, [
        { id: audit.id, role: 'assistant', content: 'bad' },
      ]),
    ).toThrow('owner')
    const other = createSession('other', 'agent', {})
    expect(() =>
      saveConversationMessages(other.id, [
        { id, role: 'assistant', content: 'bad' },
      ]),
    ).toThrow('owner')
    expect(getMessage(id)?.content).toBe('final')
    expect(getInContextMessages(sessionId)).toHaveLength(1)
  })
})

describe('entry classes: backward compatibility + dedup', () => {
  it('plain createMessage rows land as in-context message entries', () => {
    const entry = createMessage(sessionId, 'assistant', 'plain reply')
    expect(entry.entry_kind).toBe('message')
    expect(entry.exclude_from_context).toBe(false)
    const all = getMessagesBySessionId(sessionId)
    expect(all).toHaveLength(1)
    expect(all[0].entry_kind).toBe('message')
  })

  it('stable ids dedup via INSERT OR IGNORE', () => {
    const first = createEntry({
      sessionId,
      role: 'user',
      content: 'once',
      id: 'stable-entry-id',
    })
    const second = createEntry({
      sessionId,
      role: 'user',
      content: 'once',
      id: 'stable-entry-id',
    })
    expect(first.id).toBe('stable-entry-id')
    expect(second.id).toBe('stable-entry-id')
    expect(getMessagesBySessionId(sessionId)).toHaveLength(1)
  })

  it('getEntriesByKind returns only the requested class', () => {
    createCustomEntry(sessionId, { a: 1 })
    createLabelEntry(sessionId, 'l1')
    createCustomMessageEntry(sessionId, 'user', 'in context')
    expect(getEntriesByKind(sessionId, 'custom')).toHaveLength(1)
    expect(getEntriesByKind(sessionId, 'label')).toHaveLength(1)
    expect(getEntriesByKind(sessionId, 'custom_message')).toHaveLength(1)
    expect(getEntriesByKind(sessionId, 'message')).toHaveLength(0)
  })
})
