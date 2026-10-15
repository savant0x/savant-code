import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import {
  buildDeckTokensModule,
  buildTokenArtifacts,
} from './generate-design-tokens'

const SRC_DIR = path.resolve(import.meta.dir, '..', 'src')

describe('generate-design-tokens drift guard', () => {
  const artifacts = buildTokenArtifacts()

  test('committed design-tokens.generated.ts matches a fresh resolution', () => {
    const committed = readFileSync(
      path.join(SRC_DIR, 'design-tokens.generated.ts'),
      'utf8',
    )
    expect(committed).toBe(artifacts.ts)
  })

  test('committed tokens.css matches a fresh resolution', () => {
    const committed = readFileSync(path.join(SRC_DIR, 'tokens.css'), 'utf8')
    expect(committed).toBe(artifacts.css)
  })
})

describe('deck token drift guard (FID-2026-0822-012 P1)', () => {
  test('committed floor/deck-tokens.generated.ts matches a fresh resolution', () => {
    const committed = readFileSync(
      path.join(SRC_DIR, 'floor', 'deck-tokens.generated.ts'),
      'utf8',
    )
    expect(committed).toBe(buildDeckTokensModule())
  })

  test('declared subset pins inlineCodeFg #22d3ee (compaction-ripple consumer)', () => {
    expect(buildDeckTokensModule()).toContain("inlineCodeFg: '#22d3ee'")
  })
})
