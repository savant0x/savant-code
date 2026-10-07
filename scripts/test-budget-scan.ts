/**
 * Pure text primitives for `./audit-test-budget-injection.ts` (split for the
 * 300-line ceiling). No filesystem reads beyond the walk, no policy: the guard
 * owns which files are helpers and what counts as a finding.
 */
import fs from 'node:fs'
import path from 'node:path'

/** Directories whose non-test modules are shared test-helper surfaces. */
const HELPER_DIR_NAMES = new Set(['__tests__', 'test'])
const TEST_FILE = /\.(test|spec)\.tsx?$/
const SOURCE_FILE = /\.tsx?$/
/** Vendored/generated trees are not authored test surface. */
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.next',
  'target',
  'resources',
  'website',
])
/** Test-framework entry points: their callbacks are test bodies, not helpers. */
export const FRAMEWORK_CALLS = new Set([
  'describe',
  'it',
  'test',
  'xit',
  'xdescribe',
  'beforeAll',
  'beforeEach',
  'afterAll',
  'afterEach',
  'mock',
  'spyOn',
])

export function isTestFile(relativePath: string): boolean {
  return TEST_FILE.test(relativePath)
}

/** True when the path is a shared (non-test) module inside a test directory. */
export function isHelperModule(relativePath: string): boolean {
  if (isTestFile(relativePath)) return false
  const segments = relativePath.split('/')
  return (
    segments.length > 1 &&
    segments.slice(0, -1).some((segment) => HELPER_DIR_NAMES.has(segment))
  )
}

function walk(dir: string, root: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walk(path.join(dir, entry.name), root, out)
      continue
    }
    if (!SOURCE_FILE.test(entry.name)) continue
    const relative = path.relative(root, path.join(dir, entry.name))
    out.push(relative.split(path.sep).join('/'))
  }
}

/** Every authored test file plus every shared helper module in the tree. */
export function testSurfaceFiles(root: string): string[] {
  const all: string[] = []
  walk(root, root, all)
  return all.filter(
    (relative) => isTestFile(relative) || isHelperModule(relative),
  )
}

/**
 * Replace comment and string contents with spaces, preserving every offset so
 * spans still line up with the original source. Template interpolations are
 * masked with the rest of the literal — a budgeted call written inside `${...}`
 * is not detected (a stated limit, not an oversight).
 */
export function maskNonCode(code: string): string {
  const out = [...code]
  let quote: string | null = null
  let i = 0
  while (i < code.length) {
    const ch = code[i]
    if (quote !== null) {
      if (ch === '\\' && i + 1 < code.length) {
        out[i] = ' '
        out[i + 1] = ' '
        i += 2
        continue
      }
      if (ch === quote) {
        quote = null
        i += 1
        continue
      }
      if (ch !== '\n') out[i] = ' '
      i += 1
      continue
    }
    if (ch === '/' && code[i + 1] === '/') {
      while (i < code.length && code[i] !== '\n') {
        out[i] = ' '
        i += 1
      }
      continue
    }
    if (ch === '/' && code[i + 1] === '*') {
      out[i] = ' '
      out[i + 1] = ' '
      i += 2
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) {
        if (code[i] !== '\n') out[i] = ' '
        i += 1
      }
      i += 2
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      i += 1
      continue
    }
    i += 1
  }
  return out.join('')
}

/**
 * The owner of each line, used to tell a helper from a test body: a top-level
 * `function`/const-arrow declaration names its own block, a framework call
 * (`describe(`, `it(`) names a test body, and `''` means neither.
 */
export function ownerLines(masked: string): string[] {
  const lines = masked.split('\n')
  const owners: string[] = []
  let owner = ''
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (/^[\]}]/.test(line)) owner = ''
    const header = lines.slice(index, index + 3).join(' ')
    const declared =
      /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([\w$]+)/.exec(
        line,
      )?.[1]
    const assigned = /^(?:export\s+)?const\s+([\w$]+)\s*[:=]/.exec(line)?.[1]
    const assignedIsFunction =
      assigned !== undefined &&
      (header.includes('=>') || header.includes('function'))
    const called = /^([\w$]+)\s*\(/.exec(line)?.[1]
    if (declared) owner = declared
    else if (assignedIsFunction) owner = assigned as string
    else if (called) owner = called
    owners.push(owner)
  }
  return owners
}

/** Argument text of every `name(...)` call in `masked`, parens balanced. */
export function callArgumentTexts(masked: string, name: string): string[] {
  const found: string[] = []
  const pattern = new RegExp(`(?<![\\w$.])${name}\\s*\\(`, 'g')
  for (const match of masked.matchAll(pattern)) {
    const open = match.index + match[0].length - 1
    let depth = 0
    for (let i = open; i < masked.length; i += 1) {
      if (masked[i] === '(') depth += 1
      else if (masked[i] === ')') {
        depth -= 1
        if (depth === 0) {
          found.push(masked.slice(open + 1, i))
          break
        }
      }
    }
  }
  return found
}
