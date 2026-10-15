/**
 * The undeclared-dependency audit (T188).
 *
 * The defect these tests exist for is not a wrong import — it is an import
 * nothing declares, which passes every local gate because the machine that
 * once installed it still has it (v0.0.24 `@noble/hashes`, v0.0.35 `ajv`).
 * So the tests pin both halves: the finding, and the false positives that
 * would make the gate unusable if it cried wolf.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import {
  extractSpecifiers,
  findUndeclaredImports,
  isRuntimeBuiltin,
  packageNameOf,
} from '../undeclared-imports'
import {
  auditedFiles,
  collectUndeclaredImportIssues,
  EXCLUDED_SURFACES,
  installedNames,
} from '../undeclared-imports-audit'

import type { ImportContext } from '../undeclared-imports'

const root = path.resolve(import.meta.dir, '..', '..')

function context(overrides: Partial<ImportContext> = {}): ImportContext {
  return {
    provided: new Set<string>(),
    installed: new Set<string>(),
    linked: new Set<string>(),
    owners: new Map(),
    ...overrides,
  }
}

function packageNames(source: string, ctx: ImportContext): string[] {
  return findUndeclaredImports('file.ts', source, ctx).map((i) => i.packageName)
}

describe('the v0.0.35 incident is the case this grades', () => {
  const source = "import Ajv from 'ajv/dist/2020.js'\n"

  test('a package only a transitive dependency hoists is a finding', () => {
    // eslint's tree supplied ajv 6; `packages/connectors` wanted the v8
    // `dist/2020.js`. No manifest declared ajv, so nothing described the gap.
    const issues = findUndeclaredImports(
      'packages/connectors/src/engine/validate.ts',
      source,
      context({ installed: new Set(['ajv']) }),
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]?.packageName).toBe('ajv')
    expect(issues[0]?.tier).toBe('transitive')
    expect(issues[0]?.line).toBe(1)
  })

  test('a package no manifest declares and no lockfile carries is absent', () => {
    const issues = findUndeclaredImports('file.ts', source, context())
    expect(issues[0]?.tier).toBe('absent')
  })

  test('declaring it clears the finding — the fix the incident needed', () => {
    expect(
      packageNames(source, context({ provided: new Set(['ajv']) })),
    ).toEqual([])
  })

  test('a workspace member resolves by linking', () => {
    const issues = findUndeclaredImports(
      'cli/src/index.tsx',
      "import { x } from '@savant-code/common/util/hash'\n",
      context({ linked: new Set(['@savant-code/common']) }),
    )
    expect(issues).toEqual([])
  })

  test('a package declared by ANOTHER manifest resolves by hoisting', () => {
    // `cli` imports lodash; the root devDependencies declare it. This is the
    // ordinary monorepo shape and must never fail the gate.
    expect(
      packageNames(
        "import _ from 'lodash'\n",
        context({ provided: new Set(['lodash']) }),
      ),
    ).toEqual([])
  })
})

describe('imports inside literals and comments are not imports', () => {
  const cases: Record<string, string> = {
    'a line comment describing an import': "// replaced from '@shared/core'\n",
    'a block comment describing an import':
      "/* was: import x from 'ghost' */\n",
    'an import quoted in a string literal':
      'const s = "import \'ghost-pkg\'"\n',
    'a regex asserting on import text':
      "expect(src).not.toMatch(/from '\\.\\/office\\/office-scene'/)\n",
    'a minified payload embedded in a string':
      'const chunk = "function a(){return b.from(\\"@sigma/ghost\\")}"\n',
    'Array.from with a literal array': "const a = Array.from(['a'])\n",
    'a property called from': "const a = x.from('y')\n",
  }

  for (const [name, source] of Object.entries(cases)) {
    test(`ignores ${name}`, () => {
      expect(extractSpecifiers(source)).toEqual([])
    })
  }
})

describe('every static import form is read', () => {
  test('reads from, dynamic import, require and side-effect forms', () => {
    const source = [
      "import { a } from 'alpha'",
      "export * from 'bravo'",
      "const c = await import('charlie')",
      "const d = require('delta')",
      "import 'echo'",
      "import type { E } from 'foxtrot'",
    ].join('\n')
    expect(extractSpecifiers(source).map((s) => s.specifier)).toEqual([
      'alpha',
      'bravo',
      'charlie',
      'delta',
      'echo',
      'foxtrot',
    ])
  })

  test('reports the line a specifier sits on', () => {
    const source = "const a = 1\n/* two\n   lines */\nimport x from 'late'\n"
    expect(extractSpecifiers(source)).toEqual([{ line: 4, specifier: 'late' }])
  })

  test('a computed import names no module id and is skipped', () => {
    expect(extractSpecifiers('const m = await import(somePath)\n')).toEqual([])
  })
})

describe('specifier classification', () => {
  test('names the package, not the subpath', () => {
    expect(packageNameOf('ajv/dist/2020.js')).toBe('ajv')
    expect(packageNameOf('@scope/pkg/sub/path')).toBe('@scope/pkg')
    expect(packageNameOf('plain')).toBe('plain')
  })

  test('a path, a subpath import and a bare scope name no package', () => {
    for (const specifier of ['./a', '../a', '/abs', '#subpath', '@scope', '']) {
      expect(packageNameOf(specifier)).toBeNull()
    }
  })

  test('Node and Bun runtime modules are never findings', () => {
    for (const specifier of [
      'fs',
      'node:fs',
      'bun',
      'bun:sqlite',
      'bun:test',
    ]) {
      expect(isRuntimeBuiltin(specifier)).toBe(true)
    }
    expect(isRuntimeBuiltin('lodash')).toBe(false)
    expect(
      packageNames(
        "import 'bun:sqlite'\nimport { readFileSync } from 'node:fs'\n",
        context(),
      ),
    ).toEqual([])
  })

  test('a types package satisfies an import whose package is absent', () => {
    // `cli/src/utils/markdown-inline.ts` imports `type { Root } from 'mdast'`;
    // `mdast` is not installed and `@types/mdast` is.
    expect(
      packageNames(
        "import type { Root } from 'mdast'\n",
        context({ installed: new Set(['@types/mdast']) }),
      ),
    ).toEqual([])
  })
})

describe('the lockfile index is read from tracked state', () => {
  test('reads scoped and unscoped entries, ignoring non-package strings', () => {
    // The real lockfile stores integrity as `sha512-<base64>` and carries
    // ~979 entries; the shapes that must NOT be scraped are pinned here.
    const lock = [
      '{"p": {"picocolors": ["picocolors@1.1.1", "", {}, "sha512-AbC+/="],',
      '"@types/mdast": ["@types/mdast@4.0.4", "", {}],',
      '"weird": ["weird@not-a-version", "", {}]}}',
    ].join('')
    expect([...installedNames(lock)].sort()).toEqual([
      '@types/mdast',
      'picocolors',
    ])
  })

  test('reads every entry of the real lockfile', () => {
    // A regression pin: the parser must not silently lose package names, since
    // a lost name reads as `absent` and fails the gate with a wrong reason.
    const names = installedNames(
      readFileSync(path.join(root, 'bun.lock'), 'utf8'),
    )
    expect(names.size).toBeGreaterThan(900)
    for (const expected of [
      'picocolors',
      'playwright',
      'playwright-core',
      'globals',
      '@types/mdast',
      'ajv',
    ]) {
      expect(names.has(expected)).toBe(true)
    }
  })
})

describe('a failure to read tracked state fails closed', () => {
  const failingGit = () => ({
    status: 128,
    stdout: '',
    stderr: 'fatal: not a git repository',
  })

  test('a git failure is an error, never an empty passing index', () => {
    // An empty file list would mean "nothing to check" — a PASS drawn from
    // not looking. It must surface as an error instead.
    const files = auditedFiles(root, failingGit)
    expect(files.files).toEqual([])
    expect(files.error).toContain('git ls-files exit 128')
    expect(collectUndeclaredImportIssues(root, failingGit).error).toBeDefined()
  })

  test('the audited surface drops exactly the reasoned surfaces', () => {
    const listing = auditedFiles(root, () => ({
      status: 0,
      stdout: [
        'scripts/undeclared-imports.ts',
        'sdk/test/esm-compatibility/test-types.ts',
        'scripts/eslint-rules/__fixtures__/unknown-bad.ts',
        'common/src/templates/initial-agents-dir/my-custom-agent.ts',
        '',
      ].join('\n'),
      stderr: '',
    }))
    expect(listing.error).toBeUndefined()
    expect(listing.files).toEqual(['scripts/undeclared-imports.ts'])
  })
})

describe('every exclusion states its reason', () => {
  test('no surface is excluded without a written reason', () => {
    expect(EXCLUDED_SURFACES.length).toBeGreaterThan(0)
    for (const surface of EXCLUDED_SURFACES) {
      expect(surface.prefix.endsWith('/')).toBe(true)
      expect(surface.reason.trim().length).toBeGreaterThan(20)
    }
  })
})

describe('the audit passes on the tree it guards', () => {
  test('no tracked source imports a package no manifest declares', () => {
    const { issues, error } = collectUndeclaredImportIssues(root)
    expect(error).toBeUndefined()
    expect(
      issues.map((issue) => `${issue.file}:${issue.line} ${issue.packageName}`),
    ).toEqual([])
  })

  test('the connectors package owns the dependencies it imports', () => {
    // The regression the guard exists for: this package shipped importing ajv
    // without declaring it, and every local gate stayed green.
    const manifest = JSON.parse(
      readFileSync(path.join(root, 'packages/connectors/package.json'), 'utf8'),
    ) as { dependencies: Record<string, string> }
    const source = readFileSync(
      path.join(root, 'packages/connectors/src/engine/validate.ts'),
      'utf8',
    )
    const names = extractSpecifiers(source)
      .map((entry) => packageNameOf(entry.specifier))
      .filter((name): name is string => name !== null)
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) {
      if (name.startsWith('@savant-code/')) continue
      expect(Object.keys(manifest.dependencies)).toContain(name)
    }
  })
})
