/**
 * Agent prompt-content CI gate — FID-2026-1001-003 step 8 (Detective
 * companion Verifier FAIL 2).
 *
 * The Source-of-the-Claim rules in `agents/detective/detective.ts` are string
 * literals: typecheck, eslint and prettier treat them as opaque, so nothing
 * fails when the wording erodes — the exact "prose that asserts instead of
 * enforcing" defect FID-2026-1001-003 indicts. This suite pins the
 * operator-ruled rules mechanically:
 *
 *   (a) the three source rules exist in the Detective definition and name
 *       their anchor phrases;
 *   (b) no agent DEFINITION instructs `file:line` citations — with one
 *       documented exception: the Verifier/Adversary double-audit contract
 *       (FID-2026-0805-004) MANDATES `file:line` verdict citations by
 *       operator ruling, and the Orchestrator's roster/system prompt
 *       describes that contract. The rule this gate enforces is the RED-phase
 *       evidence rule; the audit-layer exception is pinned, not silent.
 *   (c) no agent prompt names `dev/` as an evidence source for code claims —
 *       the only permitted mention is the Detective's prohibition of it.
 *
 * Deliberately narrow: it pins the operator-ruled rules; it does not attempt
 * to semantics-check prompts generally.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'bun:test'

const AGENTS_DIR = join(import.meta.dir, '..')

function readAgent(...segments: string[]): string {
  return readFileSync(join(AGENTS_DIR, ...segments), 'utf8')
}

const detective = readAgent('detective', 'detective.ts')

describe('Detective source-rule anchors (FID-2026-1001-003 step 8)', () => {
  it('carries rule 1 — cite code, never the dev/ folder (with the scoped-search mechanism)', () => {
    expect(detective).toContain('CITE CODE, NEVER THE dev/ FOLDER')
    // The scoped-search mechanism; quote style may vary with the string
    // literal, so pin the flag payload, not its quoting.
    expect(detective).toContain('!dev/**')
  })

  it('carries rule 2 — cite symbols, not line numbers (with the path → symbol form)', () => {
    expect(detective).toContain('CITE SYMBOLS, NOT LINE NUMBERS')
    expect(detective).toContain('`symbolName`')
  })

  it('carries rule 3 — the catalog is a pointer set, not a record', () => {
    expect(detective).toContain('YOUR CATALOG IS NOT A RECORD')
    expect(detective).toContain('IT IS A POINTER SET')
  })

  it('the spawner prompt states the evidence contract (symbol citations, never dev/)', () => {
    const spawner =
      detective.match(/spawnerPrompt:\s*\n?\s*"([^"]+)"/)?.[1] ?? ''
    expect(spawner).toContain('Cites code by symbol, never by line number')
    expect(spawner).toContain(
      'never cites the dev/ planning folder as evidence about code',
    )
  })
})

describe('file:line instruction prohibition across agent definitions (step 8b)', () => {
  // FID-2026-0805-004 (operator-ruled): the audit layer MUST cite file:line.
  // These are the exception set, pinned here so widening it is a visible,
  // deliberate diff — not silent drift.
  const FILE_LINE_EXCEPTIONS = [
    'verifier/verifier.ts',
    'adversary/adversary.ts',
    'savant/system-prompt.ts',
  ]

  const agentFiles = [
    'forge/forge.ts',
    'scout/scout.ts',
    'thinker/thinker.ts',
    'recorder/recorder.ts',
    'scribe/scribe.ts',
    'savant/savant.ts',
    'savant/prompts.ts',
    'editor/best-of-n/editor-implementor.ts',
    ...FILE_LINE_EXCEPTIONS,
  ]

  it('the exception set is exactly the audit layer + orchestrator roster/system prompt', () => {
    for (const file of FILE_LINE_EXCEPTIONS) {
      expect(readAgent(...file.split('/'))).toContain('file:line')
    }
  })

  it('no other agent definition instructs file:line citations', () => {
    for (const file of agentFiles) {
      if (FILE_LINE_EXCEPTIONS.includes(file)) continue
      const content = readAgent(...file.split('/'))
      // `file:line` or an explicit `path.ts:NN` line-citation pattern.
      expect(content.includes('file:line')).toBe(false)
      expect(/\b[\w-]+\.(?:ts|tsx|js|py|go|rs):\d+\b/.test(content)).toBe(false)
    }
  })

  it('the Detective names file:line only to reject it', () => {
    // Every occurrence in the Detective definition must be a negation of the
    // practice (the source rule), not an instruction to use it.
    const hits = detective.match(/.*file:line.*/g) ?? []
    expect(hits.length).toBe(1)
    expect(hits[0]).toContain('citation is a stored snapshot')
  })
})

describe('dev/ as evidence-source prohibition across agent prompts (step 8c)', () => {
  it('only the Detective mentions dev/ in an evidence context — as a prohibition', () => {
    const files = [
      'detective/detective.ts',
      'forge/forge.ts',
      'scout/scout.ts',
      'thinker/thinker.ts',
      'verifier/verifier.ts',
      'adversary/adversary.ts',
      'recorder/recorder.ts',
      'scribe/scribe.ts',
    ]
    const offenders: string[] = []
    for (const file of files) {
      const content = readAgent(...file.split('/'))
      for (const line of content.split('\n')) {
        if (!/dev\//.test(line)) continue
        // The Detective's prohibitions are the only sanctioned mentions.
        if (file.startsWith('detective/')) continue
        if (
          /evidence|proof|cite|citation|sourced from|source of/i.test(line) &&
          /dev\//.test(line)
        ) {
          offenders.push(`${file}: ${line.trim()}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
