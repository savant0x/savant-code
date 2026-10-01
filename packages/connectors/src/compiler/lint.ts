import ts from 'typescript'

/**
 * Closed-term lint: a fn source may reference nothing beyond its own
 * parameters/locals and a small whitelist of pure globals. Free identifiers
 * (module imports, captured closure variables) are compile errors — the engine
 * reinstantiates sources in an empty scope, so capture would silently break.
 *
 * Scope model is a per-function over-approximation (any name declared anywhere
 * inside the fn counts as bound everywhere inside it) — sound for catching
 * genuine captures, lenient on shadowing corner cases.
 */
const GLOBAL_WHITELIST = new Set([
  'undefined',
  'NaN',
  'Infinity',
  'JSON',
  'Math',
  'Object',
  'Array',
  'String',
  'Number',
  'Boolean',
  'Error',
  'TypeError',
  'RangeError',
  // pure URL-escaping primitives (lifecycle fns build wire paths)
  'encodeURIComponent',
  'decodeURIComponent',
  // async lifecycle fns may name it (e.g. Promise.all over utils.http calls)
  'Promise',
])

export function lintClosedTerm(canonicalSrc: string, label: string): void {
  const source = ts.createSourceFile(
    'fn.ts',
    `const __fn = (${canonicalSrc});`,
    ts.ScriptTarget.ES2022,
    true,
  )

  const declared = new Set<string>(['__fn'])
  const references: string[] = []

  const collectBinding = (
    name: ts.BindingName | ts.PropertyName | undefined,
  ) => {
    if (!name) return
    if (ts.isIdentifier(name)) {
      declared.add(name.text)
    } else if (
      ts.isObjectBindingPattern(name) ||
      ts.isArrayBindingPattern(name)
    ) {
      for (const element of name.elements) {
        if (ts.isBindingElement(element)) collectBinding(element.name)
      }
    }
  }

  const isDeclarationName = (node: ts.Identifier): boolean => {
    const parent = node.parent
    if (
      (ts.isVariableDeclaration(parent) ||
        ts.isParameter(parent) ||
        ts.isBindingElement(parent) ||
        ts.isFunctionDeclaration(parent) ||
        ts.isFunctionExpression(parent) ||
        ts.isClassDeclaration(parent) ||
        ts.isClassExpression(parent)) &&
      parent.name === node
    )
      return true
    return false
  }

  const isNonReferencePosition = (node: ts.Identifier): boolean => {
    const parent = node.parent
    // obj.prop — `prop` is not a reference
    if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
      return true
    }
    // { key: value } — `key` is not a reference (shorthand IS one)
    if (ts.isPropertyAssignment(parent) && parent.name === node) {
      return true
    }
    if (
      (ts.isMethodDeclaration(parent) ||
        ts.isGetAccessor(parent) ||
        ts.isSetAccessor(parent)) &&
      parent.name === node
    )
      return true
    // ({ apiKey: renamed }) => — the propertyName side of a binding element
    if (ts.isBindingElement(parent) && parent.propertyName === node) {
      return true
    }
    return false
  }

  const walk = (node: ts.Node) => {
    if (ts.isParameter(node) || ts.isVariableDeclaration(node)) {
      collectBinding(node.name)
    } else if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isClassDeclaration(node)) &&
      node.name
    ) {
      declared.add(node.name.text)
    } else if (ts.isCatchClause(node) && node.variableDeclaration) {
      collectBinding(node.variableDeclaration.name)
    }
    if (
      ts.isIdentifier(node) &&
      !isDeclarationName(node) &&
      !isNonReferencePosition(node)
    ) {
      references.push(node.text)
    }
    ts.forEachChild(node, walk)
  }
  walk(source)

  const free = [...new Set(references)].filter(
    (name) => !declared.has(name) && !GLOBAL_WHITELIST.has(name),
  )
  if (free.length > 0) {
    throw new Error(
      `${label}: fn is not a closed term — free identifier(s): ${free.join(
        ', ',
      )}. ` +
        `Fns may reference only their own parameters/locals` +
        ` (and ${[...GLOBAL_WHITELIST].join('/')}).`,
    )
  }
}
