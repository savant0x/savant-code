import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import { validateActiveFidLedger } from './fid-ledger'

const tempRoots: string[] = []

afterEach(() => {
  for (const root of tempRoots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function createLedger(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'savant-fid-ledger-'))
  tempRoots.push(root)
  mkdirSync(path.join(root, 'dev', 'fids', 'archive'), { recursive: true })
  for (const [file, content] of Object.entries(files)) {
    writeFileSync(path.join(root, 'dev', 'fids', file), content)
  }
  return root
}

function fid(id: string, extra = ''): string {
  return `# FID: test

**Filename:** \`${id}-test.md\`
**ID:** ${id}
**Severity:** high
**Status:** analyzed

## Summary
ok
## Perfection Loop
ok
### Missed Questions
1. What is the default? → Keep the record active.
2. What is the evidence? → Use command output.
### Code Verification Evidence
ok
## Resolution
ok
${extra}
`
}

describe('validateActiveFidLedger', () => {
  it('accepts a valid active record and archived references', () => {
    const root = createLedger({
      'FID-2026-0811-001-test.md': fid('FID-2026-0811-001'),
    })
    expect(validateActiveFidLedger(root)).toEqual([])
  })

  it('rejects forbidden attribution and invalid status', () => {
    const root = createLedger({
      'FID-2026-0811-001-test.md': fid(
        'FID-2026-0811-001',
        '**Author:** forbidden\n',
      ).replace('**Status:** analyzed', '**Status:** closed'),
    })
    const issues = validateActiveFidLedger(root)
    expect(issues.map((issue) => issue.code)).toContain(
      'fid.policy.attribution',
    )
    expect(issues.map((issue) => issue.code)).toContain('fid.metadata.status')
  })

  it('rejects duplicate active IDs and missing references', () => {
    const root = createLedger({
      'FID-2026-0811-001-first.md': fid('FID-2026-0811-001'),
      'FID-2026-0811-001-second.md': fid(
        'FID-2026-0811-001',
        '**Depends On:** FID-2026-0811-999\n',
      ),
    })
    const issues = validateActiveFidLedger(root)
    expect(issues.map((issue) => issue.code)).toContain(
      'fid.metadata.duplicate-active-id',
    )
    expect(issues.map((issue) => issue.code)).toContain(
      'fid.graph.dependency-missing',
    )
  })

  it('rejects dependency cycles and an incomplete master child register', () => {
    const root = createLedger({
      'FID-2026-0811-004-master.md': fid(
        'FID-2026-0811-004',
        'Child register: FID-2026-0811-001.\n',
      ),
      'FID-2026-0811-001-first.md': fid(
        'FID-2026-0811-001',
        '**Master FID:** FID-2026-0811-004\n**Depends On:** FID-2026-0811-002\n',
      ),
      'FID-2026-0811-002-second.md': fid(
        'FID-2026-0811-002',
        '**Master FID:** FID-2026-0811-004\n**Depends On:** FID-2026-0811-001\n',
      ),
    })
    const issues = validateActiveFidLedger(root)
    expect(issues.map((issue) => issue.code)).toContain(
      'fid.graph.master-child-missing',
    )
    expect(issues.map((issue) => issue.code)).toContain(
      'fid.graph.dependency-cycle',
    )
  })

  it('does not certify an untracked archived-looking FID as a dependency', () => {
    const root = createLedger({
      'FID-2026-0811-001-test.md': fid(
        'FID-2026-0811-001',
        '**Depends On:** FID-2026-0810-001\n',
      ),
    })
    writeFileSync(
      path.join(root, 'dev', 'fids', 'archive', 'FID-2026-0810-001-old.md'),
      '# historical\n',
    )
    expect(validateActiveFidLedger(root).map((issue) => issue.code)).toContain(
      'fid.graph.dependency-missing',
    )
  })
})

describe('validateActiveFidLedger — Anti-Deferral step-status scan (FID-2026-0817-005)', () => {
  it('rejects an archived closed FID with unresolved steps', () => {
    const root = createLedger({})
    writeFileSync(
      path.join(root, 'dev', 'fids', 'archive', 'FID-2026-0810-001-old.md'),
      '# FID: old\n\n**Status:** closed\n\n## Step Status\n' +
        '- [x] 1. done — implemented\n' +
        '- [ ] 2. not done\n',
    )
    const issues = validateActiveFidLedger(root)
    expect(issues.map((issue) => issue.code)).toContain('fid.steps.unresolved')
    expect(
      issues.find((issue) => issue.code === 'fid.steps.unresolved')?.message,
    ).toContain('not done')
  })

  it('accepts an archived closed FID whose steps are all resolved', () => {
    const root = createLedger({})
    writeFileSync(
      path.join(root, 'dev', 'fids', 'archive', 'FID-2026-0810-002-old.md'),
      '# FID: old\n\n**Status:** closed\n\n## Step Status\n' +
        '- [x] 1. done — implemented\n',
    )
    expect(validateActiveFidLedger(root)).toEqual([])
  })

  it('accepts an archived closed FID with an operator-approved deferral', () => {
    const root = createLedger({})
    writeFileSync(
      path.join(root, 'dev', 'fids', 'archive', 'FID-2026-0810-003-old.md'),
      '# FID: old\n\n**Status:** closed\n\n## Step Status\n' +
        '- [x] 1. done — implemented\n' +
        '- [ ] 2. later — deferred::operator-approved 2026-08-16\n',
    )
    expect(validateActiveFidLedger(root)).toEqual([])
  })

  it('ignores FIDs without a Step Status section (section-conditional)', () => {
    const root = createLedger({
      'FID-2026-0811-003-test.md': fid('FID-2026-0811-003'),
    })
    expect(validateActiveFidLedger(root)).toEqual([])
  })
})
