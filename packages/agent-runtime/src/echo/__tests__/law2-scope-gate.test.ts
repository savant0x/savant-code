/**
 * FID-2026-1001-003 step 5a — the Law 2 write-time scope gate.
 *
 * Contract (Ruling 2: "if it's in scope, then it's mechanically presented"):
 *   - a write target covered by an approved register pattern passes;
 *   - a target no pattern covers BLOCKS, fail-closed, naming the path;
 *   - an item without patterns is non-covering by construction;
 *   - governance surfaces the protocol itself mandates are gate-level
 *     exemptions (operator ruling 2026-10-02), not register items;
 *   - the classified TERMINAL mutation targets resolve through the same
 *     gate as write-tool targets (the bypass closure extends to scope);
 *   - a missing register is a stated limit: presence/structure of SCOPE.md
 *     is the repo gate's contract (validate:repository → scope.*), so the
 *     write-time gate is inert only where the register does not exist.
 *   - a target that does not resolve under cwd is OUTSIDE the gate's
 *     jurisdiction (closure correction 2026-10-02): the register speaks
 *     repo-relative paths, so a synthetic `/proj/...` target cannot be
 *     matched against it — out-of-project writes are the G-law's surface.
 *
 * The register is injected (`scopePath`) — the tests exercise the REAL gate
 * chain against fixture registers instead of the repo's live SCOPE.md.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import { createEnforcementState } from '../enforcement-state'
import { runPreWriteGates } from '../pre-write-gates'
import { globToRegExp, loadScopeArtifact } from '../pre-write-gates-law2'

const FIXTURE_REGISTER = `# SCOPE — fixture

## Machine-readable scope targets

- T-fix: \`src/**\`, \`README.md\`
- T-nopattern: (no write surface)
`

function fixtureState() {
  const state = createEnforcementState()
  state.hasVerifiedSinceLastDirty = false
  return state
}

describe('FID-2026-1001-003 step 5a — Law 2 scope gate', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0))
      rmSync(dir, { recursive: true, force: true })
  })

  function writeRegister(content: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'law2-scope-'))
    dirs.push(dir)
    const p = join(dir, 'SCOPE.md')
    writeFileSync(p, content)
    return p
  }

  function attempt(
    state: ReturnType<typeof fixtureState>,
    path: string,
    scopePath: string,
  ) {
    return runPreWriteGates({
      toolName: 'write_file',
      input: { path },
      agentId: 'savant',
      state,
      mode: 'hybrid',
      tier: 'core_4',
      scopePath,
    })
  }

  it('PASSES a write target covered by an approved item pattern', () => {
    const scopePath = writeRegister(FIXTURE_REGISTER)
    // Targets are repo-relative (the register's namespace): production
    // write targets resolve under process.cwd().
    const result = attempt(fixtureState(), 'src/a.ts', scopePath)
    expect(result.blocked).toBe(false)
  })

  it('BLOCKS a target no pattern covers, naming the path (fail-closed)', () => {
    const scopePath = writeRegister(FIXTURE_REGISTER)
    const result = attempt(fixtureState(), 'docs/other.md', scopePath)
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('Law 2')
    expect(result.reason).toContain('no approved scope item covers')
    expect(result.reason).toContain('present it first')
  })

  it('an item without patterns is non-covering by construction', () => {
    const scopePath = writeRegister(FIXTURE_REGISTER)
    // T-nopattern contributes no globs; a path outside every pattern blocks.
    const result = attempt(fixtureState(), 'elsewhere/x.ts', scopePath)
    expect(result.blocked).toBe(true)
  })

  it('a register that exists but has NO target section covers nothing', () => {
    const scopePath = writeRegister('# SCOPE — fixture\n\nProse only.\n')
    const result = attempt(fixtureState(), 'src/a.ts', scopePath)
    expect(result.blocked).toBe(true)
  })

  it('governance surfaces are gate-level exemptions (operator ruling 2026-10-02)', () => {
    const scopePath = writeRegister(FIXTURE_REGISTER)
    // Register every fixture target as read: this test exercises Law 2's
    // exemption surface, not Law 1's read gate. From the repo root these
    // spellings collide with REAL repo files (`SCOPE.md` etc. exist there),
    // and Law 1 correctly blocks an unread write regardless of Law 2's
    // exemptions — a fixture collision found at closure 2026-10-02, not a
    // product defect (production sessions register their reads).
    const state = fixtureState()
    for (const target of [
      'dev/fids/FID-2026-1001-003-x.md',
      'dev/scratchpad/probe.ts',
      'SCOPE.md',
      'CHANGELOG.md',
      'ECHO.md',
      'protocol.config.yaml',
    ]) {
      state.filesRead.add(target)
    }
    for (const target of [
      'dev/fids/FID-2026-1001-003-x.md',
      'dev/scratchpad/probe.ts',
      'SCOPE.md',
      'CHANGELOG.md',
      'ECHO.md',
      'protocol.config.yaml',
    ]) {
      expect(attempt(state, target, scopePath).blocked).toBe(false)
    }
  })

  it('a classified TERMINAL mutation target resolves through the same gate', () => {
    const scopePath = writeRegister(FIXTURE_REGISTER)
    const state = fixtureState()
    // Simulate the pipeline stash for a mutating terminal call (sed -i).
    state.pendingMutation = {
      mutates: true,
      targets: ['docs/other.md'],
      scope: 'targeted',
    }
    const result = runPreWriteGates({
      toolName: 'run_terminal_command',
      input: { command: 'sed -i s/a/b/ docs/other.md' },
      agentId: 'savant',
      state,
      mode: 'hybrid',
      tier: 'core_4',
      scopePath,
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('docs/other.md')
  })

  it('a MISSING register is inert at write time (stated limit; repo gate owns presence)', () => {
    const result = attempt(
      fixtureState(),
      '/proj/src/a.ts',
      join(tmpdir(), 'law2-scope-does-not-exist', 'SCOPE.md'),
    )
    expect(result.blocked).toBe(false)
  })

  it('a target OUTSIDE cwd is outside the gate jurisdiction (closure boundary, 2026-10-02)', () => {
    // The register exists and covers nothing about this shape: a synthetic
    // absolute fixture target does not resolve under process.cwd(), and the
    // register's repo-relative patterns cannot match it. The gate must not
    // claim it (pinned on BOTH platforms: win32 resolves '/proj/...' to the
    // current drive, POSIX takes it absolutely — relative() yields '..' or
    // an absolute path either way).
    const scopePath = writeRegister(FIXTURE_REGISTER)
    const result = attempt(fixtureState(), '/proj/src/a.ts', scopePath)
    expect(result.blocked).toBe(false)
  })

  // FID-2026-1004-006 (B): the register writes long entries across INDENTED
  // continuation lines, and the previous line-only match dropped those globs —
  // so the register silently under-covered its own approved write surfaces (a
  // Law 2 block on a target the item already listed).
  it("collects globs from an item's indented continuation lines (FID-2026-1004-006)", () => {
    const scopePath = writeRegister(
      '# SCOPE — fixture\n\n- T-fix: `src/**`,\n  `docs/**`,\n  `scripts/*.ts`\n',
    )
    const artifact = loadScopeArtifact(scopePath)
    expect(artifact.patterns).toEqual(['src/**', 'docs/**', 'scripts/*.ts'])
  })

  it('stops continuation at a blank line and at the next item (fail-closed)', () => {
    const scopePath = writeRegister(
      '# SCOPE — fixture\n\n- T-a: `src/a.ts`,\n  `src/b.ts`\n\n  `not/an/owned/glob.ts`\n- T-b: `other/**`\n',
    )
    const artifact = loadScopeArtifact(scopePath)
    // `not/an/owned/glob.ts` sits after a blank line, so it belongs to no item.
    expect(artifact.patterns).toEqual(['src/a.ts', 'src/b.ts', 'other/**'])
  })

  it('indented prose that follows NO item contributes nothing (fail-closed)', () => {
    const scopePath = writeRegister(
      '# SCOPE — fixture\n\nSome prose.\n  Indented `stray/glob` under no item.\n- T-fix: `src/**`\n',
    )
    const artifact = loadScopeArtifact(scopePath)
    expect(artifact.patterns).toEqual(['src/**'])
  })

  it('loadScopeArtifact parses the machine-readable section only', () => {
    const scopePath = writeRegister(
      '# SCOPE — fixture\n\n- T-fix: `src/**`, `README.md`\nProse with a `stray/glob` not on a target line.\n',
    )
    const artifact = loadScopeArtifact(scopePath)
    expect(artifact.exists).toBe(true)
    expect(artifact.patterns).toEqual(['src/**', 'README.md'])
  })
})

describe('globToRegExp — register pattern vocabulary', () => {
  it('literal patterns match exactly', () => {
    expect(globToRegExp('README.md').test('README.md')).toBe(true)
    expect(globToRegExp('README.md').test('src/README.md')).toBe(false)
  })

  it('`*` stays within one segment', () => {
    const re = globToRegExp('scripts/*version*')
    expect(re.test('scripts/version-check.ts')).toBe(true)
    expect(re.test('scripts/release/version.ts')).toBe(false)
  })

  it('`**` crosses separators', () => {
    const re = globToRegExp('packages/agent-runtime/src/**')
    expect(re.test('packages/agent-runtime/src/echo/types.ts')).toBe(true)
    expect(re.test('packages/agent-runtime/src/echo/pre-write-gates.ts')).toBe(
      true,
    )
    expect(re.test('common/src/types/session-state-records.ts')).toBe(false)
  })

  it('dots are literal', () => {
    expect(globToRegExp('README.md').test('READMEXmd')).toBe(false)
  })
})
