/**
 * Unit pins for the pristine-install bundle engine (FID-2026-1011-005).
 *
 * The gate itself takes ~2 minutes because it really installs; what is pinned
 * here is the part that must be right no matter what the install does — where
 * the scratch tree may live, what counts as release input, and which metafile
 * inputs mean "this module came from an install the release will not have".
 * The last one is the v0.0.35 precondition, so it is pinned by shape.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, describe, expect, test } from 'bun:test'

import {
  BUNDLE_ARGV,
  CLEAN_BUNDLE_ROOT_ENV,
  PREBUNDLE_STEPS,
  collectTreeFiles,
  isInsideTree,
  isPathLikeInput,
  materializeTree,
  outsideTreeInputs,
  parseMetafileInputs,
  scratchRoot,
  scratchRootProblem,
} from '../clean-install-bundle'

const REPO_ROOT = path.resolve(import.meta.dir, '..', '..')
const TMP = os.tmpdir()
const TREE = path.join(TMP, 'savant-clean-bundle-1')
const SANDBOX = path.join(TMP, 'savant-clean-bundle-unit')
const SANDBOX_TREE = path.join(SANDBOX, 'tree')

afterAll(() => {
  fs.rmSync(SANDBOX, { recursive: true, force: true })
})

describe('scratch root', () => {
  test('honours the operator override, trimmed', () => {
    const root = scratchRoot(
      { [CLEAN_BUNDLE_ROOT_ENV]: '  /clean/here  ' },
      TMP,
      7,
    )
    expect(root).toBe(path.resolve('/clean/here'))
  })

  test('defaults to a pid-scoped directory under the OS temp dir', () => {
    expect(scratchRoot({}, '/tmp', 4242)).toBe(
      path.join('/tmp', 'savant-clean-bundle-4242'),
    )
  })

  test('the default never lands inside the repository', () => {
    expect(isInsideTree(REPO_ROOT, scratchRoot({}, TMP, 1))).toBe(false)
    expect(
      scratchRootProblem(REPO_ROOT, scratchRoot({}, TMP, 1)),
    ).toBeUndefined()
  })

  test('a tree inside the repository is refused, with a reason', () => {
    const inside = path.join(REPO_ROOT, 'cli', 'bin', '.clean-bundle')
    expect(scratchRootProblem(REPO_ROOT, inside)).toContain(
      'inside the repository',
    )
    expect(scratchRootProblem(REPO_ROOT, REPO_ROOT)).toBeDefined()
  })
})

describe('containment', () => {
  test('the tree itself and its descendants are inside', () => {
    expect(isInsideTree(TREE, TREE)).toBe(true)
    expect(isInsideTree(TREE, path.join(TREE, 'node_modules', 'ajv'))).toBe(
      true,
    )
  })

  test('a sibling sharing a name prefix is NOT inside', () => {
    expect(isInsideTree(TREE, `${TREE}-x`)).toBe(false)
    expect(isInsideTree(TREE, `${TREE}-x/package.json`)).toBe(false)
  })

  test('a parent directory is not inside', () => {
    expect(isInsideTree(TREE, TMP)).toBe(false)
    expect(isInsideTree(TREE, path.dirname(TREE))).toBe(false)
  })
})

describe('metafile provenance', () => {
  test('the engine keys on paths, not on runtime builtins', () => {
    expect(isPathLikeInput('node:fs')).toBe(false)
    expect(isPathLikeInput('bun:ffi')).toBe(false)
    expect(isPathLikeInput('cli/src/index.tsx')).toBe(true)
    expect(isPathLikeInput('node_modules/ajv/dist/2020.js')).toBe(true)
  })

  test('an input resolving up the ancestor chain is a violation (v0.0.35)', () => {
    const specifier = path.join(
      '..',
      '..',
      'node_modules',
      'ajv',
      'dist',
      '2020.js',
    )
    expect(outsideTreeInputs([specifier], TREE)).toEqual([specifier])
  })

  test('inputs inside the tree are clean, builtins are ignored', () => {
    const inputs = [
      'cli/src/index.tsx',
      path.join('cli', 'src', 'agents', 'bundled-agents.generated.ts'),
      path.join('node_modules', 'ajv', 'dist', '2020.js'),
      'node:fs',
      'bun:ffi',
    ]
    expect(outsideTreeInputs(inputs, TREE)).toEqual([])
  })

  test('parses the bundler shape and fails soft on a non-metafile', () => {
    const metafile = JSON.stringify({
      inputs: { 'cli/src/index.tsx': { bytes: 10, imports: [] } },
      outputs: {},
    })
    expect(parseMetafileInputs(metafile)).toEqual(['cli/src/index.tsx'])
    expect(parseMetafileInputs('{}')).toEqual([])
  })
})

describe('release file set', () => {
  test('is git state: no install, no credentials', () => {
    const files = collectTreeFiles(REPO_ROOT)
    expect(files).toContain('package.json')
    expect(files).toContain('bun.lock')
    expect(files.length).toBeGreaterThan(1000)
    expect(files.some((file) => file.startsWith('node_modules/'))).toBe(false)
    expect(files.some((file) => /\.env(\.local)?$/.test(file))).toBe(false)
  })

  test('materializeTree copies the tracked shape, nested directories included', () => {
    const source = path.join(SANDBOX, 'source')
    fs.mkdirSync(path.join(source, 'cli', 'src'), { recursive: true })
    fs.writeFileSync(path.join(source, 'package.json'), '{"name":"x"}\n')
    fs.writeFileSync(
      path.join(source, 'cli', 'src', 'index.tsx'),
      'export {}\n',
    )
    materializeTree(source, SANDBOX_TREE, ['package.json', 'cli/src/index.tsx'])
    expect(
      fs.readFileSync(path.join(SANDBOX_TREE, 'package.json'), 'utf8'),
    ).toBe('{"name":"x"}\n')
    expect(
      fs.existsSync(path.join(SANDBOX_TREE, 'cli', 'src', 'index.tsx')),
    ).toBe(true)
  })
})

describe('the release build shape', () => {
  test('the prebundle steps run the SDK before the generated agents', () => {
    // Order is load-bearing: the CLI resolves `@savant-code/sdk` through
    // `sdk/dist`, which does not exist in a pristine tree until it is built.
    expect(PREBUNDLE_STEPS.map((step) => step.cwd)).toEqual(['sdk', 'cli'])
    expect(PREBUNDLE_STEPS[0]?.argv).toEqual(['run', 'scripts/build.ts'])
    expect(PREBUNDLE_STEPS[1]?.argv).toEqual([
      'run',
      'scripts/prebuild-agents.ts',
    ])
  })

  test('the bundle entry, target and externals are pinned', () => {
    expect(BUNDLE_ARGV[0]).toBe('build')
    expect(BUNDLE_ARGV[1]).toBe('cli/src/index.tsx')
    expect(BUNDLE_ARGV).toContain('--production')
    expect(BUNDLE_ARGV).toContain('--target=bun')
    // Dropping the wildcard would false-fail on every single-OS machine
    // (A–Z v0.0.25 AV-001); dropping the entry would test nothing at all.
    expect(BUNDLE_ARGV[BUNDLE_ARGV.indexOf('--external') + 1]).toBe(
      '@opentui/core-*',
    )
  })
})
