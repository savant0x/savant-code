import fs from 'node:fs'
import path from 'node:path'

import ts from 'typescript'

export interface MutatingMatcherIssue {
  code: string
  message: string
}

const SOURCE_ROOTS = [
  'scripts',
  'packages',
  'sdk',
  'cli',
  'common',
  'agents',
  'evals',
  'desktop',
]

function rootIdentifier(node: ts.Expression): string | undefined {
  if (ts.isIdentifier(node)) return node.text
  if (ts.isPropertyAccessExpression(node))
    return rootIdentifier(node.expression)
  return undefined
}

/** Exact inline pattern; indirect helper returns require separate review. */
export function auditMutatingMatcherSource(
  file: string,
  content: string,
): MutatingMatcherIssue[] {
  const source = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const expectNames = new Set(['expect'])
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== 'bun:test'
    )
      continue
    const bindings = statement.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings))
      for (const binding of bindings.elements)
        if ((binding.propertyName ?? binding.name).text === 'expect')
          expectNames.add(binding.name.text)
  }
  function containsMatcher(node: ts.Node): boolean {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const root = rootIdentifier(node.expression.expression)
      if (root && expectNames.has(root)) return true
    }
    return node.getChildren(source).some(containsMatcher)
  }
  const issues: MutatingMatcherIssue[] = []
  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'toMatchObject' &&
      node.arguments.some(containsMatcher)
    ) {
      const line =
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
      issues.push({
        code: 'audit.mutating-matcher',
        message: `${file}:${line}: inline asymmetric toMatchObject mutates Bun test evidence; use toEqual(expect.objectContaining(...))`,
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return issues
}

/** One git census includes new tests while honoring ignored repository copies. */
export function collectMutatingMatcherIssues(
  root: string,
): MutatingMatcherIssue[] {
  const census = Bun.spawnSync(
    [
      'git',
      'ls-files',
      '-z',
      '--cached',
      '--others',
      '--exclude-standard',
      '--',
      ...SOURCE_ROOTS,
    ],
    { cwd: root, stdout: 'pipe', stderr: 'pipe' },
  )
  if (census.exitCode !== 0)
    return [
      {
        code: 'audit.mutating-matcher.census',
        message: 'Test source census failed',
      },
    ]
  const issues: MutatingMatcherIssue[] = []
  for (const file of new Set(census.stdout.toString().split('\0'))) {
    if (!/\.test\.tsx?$/.test(file)) continue
    try {
      const absolute = fs.realpathSync(path.join(root, file))
      const relative = path.relative(fs.realpathSync(root), absolute)
      if (
        relative === '..' ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
      )
        throw new Error('Test source escapes the repository')
      issues.push(
        ...auditMutatingMatcherSource(file, fs.readFileSync(absolute, 'utf8')),
      )
    } catch (error) {
      issues.push({
        code: 'audit.mutating-matcher.source',
        message: `${file}: ${error instanceof Error ? error.message : 'Test source unavailable'}`,
      })
    }
  }
  return issues
}

if (import.meta.main) {
  const issues = collectMutatingMatcherIssues(
    path.resolve(import.meta.dir, '..'),
  )
  for (const issue of issues) console.error(`[${issue.code}] ${issue.message}`)
  console.log(
    `mutating matcher audit: ${issues.length ? 'FAIL' : 'PASS'} (${issues.length} issues)`,
  )
  process.exitCode = issues.length ? 1 : 0
}
