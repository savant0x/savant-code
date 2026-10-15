import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  discardDesignDraft,
  getDesignDraft,
  listDesignDrafts,
  saveDesignDraft,
  type DesignAuthoringInputV1,
} from '../index'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function input(): DesignAuthoringInputV1 {
  return {
    schemaVersion: '1',
    id: 'draft-system',
    displayName: 'Draft System',
    description: 'A draft system.',
    scope: 'project',
    targets: ['terminal'],
    colors: { primary: '#123456' },
    typography: { body: { fontFamily: 'Inter, sans-serif' } },
    spacing: { sm: '8px' },
    radius: { sm: '4px' },
    components: {},
    accessibility: { contrastReview: true },
    activate: false,
  }
}

function root(): string {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), 'design-drafts-'))
  roots.push(value)
  return value
}

describe('design-system drafts', () => {
  test('rejects future-dated drafts and malformed inputs', () => {
    const directory = root()
    fs.mkdirSync(path.join(directory, 'drafts'), { recursive: true })
    const future = new Date(Date.now() + 60_000).toISOString()
    fs.writeFileSync(
      path.join(directory, 'drafts', 'future.json'),
      JSON.stringify({
        id: 'future',
        createdAt: future,
        updatedAt: future,
        input: input(),
      }),
    )
    fs.writeFileSync(
      path.join(directory, 'drafts', 'malformed.json'),
      JSON.stringify({
        id: 'malformed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        input: { id: 'bad' },
      }),
    )
    expect(listDesignDrafts(directory)).toEqual([])
    expect(getDesignDraft(directory, 'future')).toBeUndefined()
  })

  test('evicts the oldest draft at the 20-item cap', () => {
    const directory = root()
    for (let index = 0; index < 21; index += 1) {
      saveDesignDraft(
        directory,
        input(),
        `draft-${String(index).padStart(2, '0')}`,
      )
    }
    expect(listDesignDrafts(directory)).toHaveLength(20)
    expect(getDesignDraft(directory, 'draft-00')).toBeUndefined()
    expect(getDesignDraft(directory, 'draft-20')?.id).toBe('draft-20')
  })

  test('expires old drafts during lookup and listing', () => {
    const directory = root()
    const draft = saveDesignDraft(directory, input(), 'expired')
    const draftPath = path.join(directory, 'drafts', `${draft.id}.json`)
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
    fs.writeFileSync(draftPath, JSON.stringify({ ...draft, updatedAt: old }))
    expect(getDesignDraft(directory, draft.id)).toBeUndefined()
    expect(listDesignDrafts(directory)).toEqual([])
    expect(fs.existsSync(draftPath)).toBe(false)
  })

  test('saves, reloads, and discards a draft', () => {
    const directory = root()
    const draft = saveDesignDraft(directory, input(), 'draft-1')
    expect(getDesignDraft(directory, draft.id)?.input.id).toBe('draft-system')
    expect(listDesignDrafts(directory).map((item) => item.id)).toEqual([
      'draft-1',
    ])
    expect(discardDesignDraft(directory, 'draft-1')).toBe(true)
    expect(listDesignDrafts(directory)).toEqual([])
  })
})
