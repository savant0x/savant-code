/**
 * Law 4 wiring-detector scope — FID-2026-1001-003 step 6.
 *
 * Row H: the detector was a raw `/export\s/` over arbitrary content, so a
 * governance markdown document quoting `export` in a code fence registered as
 * a wired feature; Law 4 then blocked turn end demanding a caller grep for a
 * document. Contract pinned here:
 *   1. docs-classified paths never register — the markdown-quoting negative
 *      pin — even when a fence carries a real export line;
 *   2. a code path registers only on a line-anchored export DECLARATION, not
 *      on the bare word in a string or comment (parse structure);
 *   3. a false registration cannot wedge turn end (the livelock): a
 *      docs-path entry is evicted at turn-end evaluation and does not block.
 */
import { describe, expect, it } from 'bun:test'

import { EchoEnforcement } from '../enforcement'

function write(enf: EchoEnforcement, path: string, content: string): void {
  enf.afterToolCall({
    toolName: 'write_file',
    input: { path },
    result: {},
    writtenContent: content,
    writeSucceeded: true,
  })
}

describe('Law 4 wiring detector — file-type + declaration scope (FID-2026-1001-003 step 6)', () => {
  it('markdown quoting `export` in a code fence does NOT register (negative pin)', () => {
    const enf = new EchoEnforcement('hybrid')
    write(
      enf,
      '/proj/dev/fids/FID-2026-1001-003-example.md',
      '```ts\nexport function foo() {}\n```\n',
    )
    expect(enf.getState().featuresWired.size).toBe(0)
    expect(enf.evaluateTurnEnd().blocked).toBe(false)
  })

  it('a docs-classified path never registers, even with a bare export line', () => {
    const enf = new EchoEnforcement('hybrid')
    write(enf, '/proj/docs/notes.md', 'export const x = 1\n')
    expect(enf.getState().featuresWired.size).toBe(0)
  })

  it('a line-anchored declaration in a code file still registers (positive pin)', () => {
    const enf = new EchoEnforcement('hybrid')
    write(enf, '/proj/src/feature.ts', 'export const helper = 1\n')
    expect(enf.getState().featuresWired.has('/proj/src/feature.ts')).toBe(true)
    // Unverified wiring still blocks turn end — the Law 4 contract survives.
    expect(enf.evaluateTurnEnd().blocked).toBe(true)
  })

  it('the bare word `export` in a string or comment does NOT register', () => {
    const enf = new EchoEnforcement('hybrid')
    write(
      enf,
      '/proj/src/quotes.ts',
      'const s = "export const nope = 1"\n// export function nope() {}\n',
    )
    expect(enf.getState().featuresWired.size).toBe(0)
  })

  it('livelock: a seeded docs-path registration is evicted at turn end and does not block', () => {
    const enf = new EchoEnforcement('hybrid')
    enf.getState().featuresWired.add('/proj/dev/scratchpad/notes.md')
    const result = enf.evaluateTurnEnd()
    expect(result.blocked).toBe(false)
    expect(enf.getState().featuresWired.size).toBe(0)
  })

  it('livelock: a mixed ledger blocks only on the real code feature', () => {
    const enf = new EchoEnforcement('hybrid')
    enf.getState().featuresWired.add('/proj/dev/scratchpad/notes.md')
    enf.getState().featuresWired.add('/proj/src/feature.ts')
    const result = enf.evaluateTurnEnd()
    expect(result.blocked).toBe(true)
    expect(result.report).toContain('feature.ts')
    expect(result.report).not.toContain('notes.md')
  })
})
