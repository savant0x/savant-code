// FID-2026-0901-006 P16 — simple tool-item parser tests (CLI parity).

import { describe, expect, test } from 'bun:test'

import {
  parseReadUrlItem,
  parseSkillItem,
  parseWebSearchItem,
} from '../simple-tool-items'

describe('parseWebSearchItem', () => {
  test('extracts the query as a muted description', () => {
    expect(
      parseWebSearchItem(JSON.stringify({ query: '  bun test paths  ' })),
    ).toEqual({ name: 'Web Search', description: 'bun test paths' })
  })

  test('rejects missing/blank query (Law 14 fail-safe)', () => {
    expect(parseWebSearchItem(null)).toBeNull()
    expect(parseWebSearchItem('{}')).toBeNull()
    expect(parseWebSearchItem(JSON.stringify({ query: '   ' }))).toBeNull()
    expect(parseWebSearchItem('not-json{')).toBeNull()
  })
})

describe('parseReadUrlItem', () => {
  test('extracts the url', () => {
    expect(
      parseReadUrlItem(JSON.stringify({ url: ' https://example.com/docs ' })),
    ).toEqual({ name: 'Read URL', description: 'https://example.com/docs' })
  })

  test('rejects missing url', () => {
    expect(parseReadUrlItem(JSON.stringify({ query: 'x' }))).toBeNull()
  })
})

describe('parseSkillItem', () => {
  test('extracts the skill name', () => {
    expect(
      parseSkillItem(JSON.stringify({ name: ' coding-typescript ' })),
    ).toEqual({ name: 'Load Skill', description: 'coding-typescript' })
  })

  test('rejects missing name', () => {
    expect(parseSkillItem(JSON.stringify({ skill: 'x' }))).toBeNull()
  })
})
