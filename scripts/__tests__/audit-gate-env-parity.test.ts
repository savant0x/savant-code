// FID-2026-0909-002 (Step 3) — gate-environment parity detector tests.
// Positive fixtures pin the v0.0.30 incident shapes (bare runtime-name
// spawns under a sanitized gate PATH; Bun-only `import.meta` properties in
// the SDK dts program's input set); negatives pin the exemptions (the
// pinned-bun contract probe, test files, non-common/src surfaces, comments).

import { describe, expect, test } from 'bun:test'

import {
  detectGateEnvParityIssues,
  GATE_ENV_SURFACE_ARGS,
  PINNED_BUN_PROBE_PATH,
  type SourceLines,
} from '../audit-gate-env-parity'

function lines(file: string, ...entries: string[]): SourceLines {
  return { file, lines: entries }
}

/** Wraps a runtime name in quotes for building fixture lines. Fixtures MUST
 * assemble bare-runtime shapes via this helper: a literal `spawnSync('bun'`
 * in THIS file's source would be flagged by the repo-level self-scan (and
 * prettier's quote normalization unshields escaped-quote shields). */
const q = (s: string) => `'${s}'`

describe('detectGateEnvParityIssues (FID-2026-0909-002)', () => {
  test('class 1: flags a bare-runtime spawnSync in a test file (the ENOENT incident shape)', () => {
    const issues = detectGateEnvParityIssues(
      lines(
        'cli/src/server/__tests__/gateway-server-command.test.ts',
        `const child = spawnSync(${q('bun')}, ['--version'])`,
      ),
    )
    expect(issues).toHaveLength(1)
    expect(issues[0].file).toBe(
      'cli/src/server/__tests__/gateway-server-command.test.ts',
    )
    expect(issues[0].line).toBe(1)
    expect(issues[0].message).toContain('PATH-resolvable only in dev shells')
  })

  test('class 1: flags spawn and Bun.spawn variants alike', () => {
    const spawn = detectGateEnvParityIssues(
      lines('cli/src/tool.ts', `spawn(${q('bun')}, ['run'])`),
    )
    const bunSpawn = detectGateEnvParityIssues(
      lines('cli/src/tool.ts', `Bun.spawnSync([${q('bun')}, '--version'])`),
    )
    expect(spawn).toHaveLength(1)
    expect(bunSpawn).toHaveLength(1)
  })

  test('class 1: does not flag process.execPath or explicitly resolved runtimes', () => {
    const issues = detectGateEnvParityIssues(
      lines(
        'scripts/tool.ts',
        "spawnSync(process.execPath, ['--version'])",
        "spawnSync(path.join(bunDir, 'bun.exe'), ['run'])",
      ),
    )
    expect(issues).toHaveLength(0)
  })

  test('class 1: the pinned-bun contract probe is exempt (reasoned allowlist)', () => {
    const issues = detectGateEnvParityIssues(
      lines(
        PINNED_BUN_PROBE_PATH,
        `const probe = spawnSync(${q('bun')}, ['--version'], { env })`,
      ),
    )
    expect(issues).toHaveLength(0)
  })

  test('class 1: the exemption is path-exact, not pattern-wide', () => {
    const issues = detectGateEnvParityIssues(
      lines(
        'scripts/other.test.ts',
        `const probe = spawnSync(${q('bun')}, ['--version'], { env })`,
      ),
    )
    expect(issues).toHaveLength(1)
  })

  test('class 2: flags Bun-only import.meta properties in common/src production', () => {
    for (const lineText of [
      'const here = import.meta.dir',
      'if (import.meta.main) run()',
      'export const isMain = import.meta.mainland',
    ]) {
      const issues = detectGateEnvParityIssues(
        lines('common/src/env.ts', lineText),
      )
      expect(issues).toHaveLength(1)
      expect(issues[0].message).toContain('plain-TS dts program')
    }
  })

  test('class 2: common/src test files are out of scope', () => {
    const issues = detectGateEnvParityIssues(
      lines('common/src/__tests__/env-bootstrap.test.ts', 'import.meta.dir'),
    )
    expect(issues).toHaveLength(0)
  })

  test('class 2: surfaces outside common/src are out of scope (Bun-legal runtime)', () => {
    const issues = detectGateEnvParityIssues(
      lines('cli/src/main.ts', 'const here = import.meta.dir'),
    )
    expect(issues).toHaveLength(0)
  })

  test('comment lines are exempt from both classes', () => {
    const issues = detectGateEnvParityIssues(
      lines(
        'common/src/env.ts',
        '// Derive the module directory from import.meta.url — NOT import.meta.dir:',
        'scripts/tool.ts',
        `// spawn(${q('bun')}, ...) is fine to mention in prose`,
      ),
    )
    expect(issues).toHaveLength(0)
  })

  test('block-comment and JSDoc continuation lines are exempt (self-scan)', () => {
    // Fixture assembled by concatenation so THIS test file's own source
    // line does not carry the literal bare-runtime spawn shape — the
    // repo-level self-scan would otherwise flag the fixture itself.
    const jsdocLine = ' * its spawnSync' + "('bu" + "n', ...) is prose only"
    const issues = detectGateEnvParityIssues(
      lines('scripts/audit.ts', '/**', jsdocLine, ' */', 'const x = 1'),
    )
    expect(issues).toHaveLength(0)
  })

  test('audited surfaces pin the tracked source extensions', () => {
    expect(GATE_ENV_SURFACE_ARGS).toEqual([
      '*.ts',
      '*.tsx',
      '*.mts',
      '*.cts',
      '*.js',
      '*.mjs',
    ])
  })
})
