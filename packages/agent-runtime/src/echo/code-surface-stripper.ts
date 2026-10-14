/**
 * @module echo/code-surface-stripper
 *
 * Splits a written file's text into two scan surfaces for ECHO Law 6
 * (FID-2026-1013-012 W3-4). `@ts-ignore` / `@ts-expect-error` live inside
 * comments and must be matched against the RAW text; the `any` type keyword is
 * code and must be matched against text whose comments and string literals are
 * blanked, or the English word "any" in prose (`// returns true when any entry
 * matches`, `'Could not find any files'`) false-positives the law.
 *
 * Extracted from `./post-write-scanners` so the scanner module stays under the
 * 300-line quality ceiling and the stripper can be pinned on its own
 * (`./__tests__/code-surface-stripper.test.ts`).
 */

import ts from 'typescript'

/**
 * Replaces comment bodies and string-literal contents with spaces so code
 * tokens can be matched without matching prose. Template literals keep their
 * `${...}` interpolations (the code inside them stays scannable) and newlines
 * survive so line structure is preserved.
 */
export function stripCommentsAndStrings(
  source: string,
  fileName = 'written.ts',
): string {
  const tree = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    false,
    /\.[jt]sx$/i.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const surface = source.split('')
  const visit = (node: ts.Node): void => {
    const start = node.getStart(tree)
    if (
      ts.isStringLiteral(node) ||
      ts.isRegularExpressionLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node)
    ) {
      maskRange(surface, start, node.end)
      return
    }
    if (node.kind === ts.SyntaxKind.TemplateHead)
      maskRange(surface, start, node.end - 2)
    else if (node.kind === ts.SyntaxKind.TemplateMiddle)
      maskRange(surface, start + 1, node.end - 2)
    else if (node.kind === ts.SyntaxKind.TemplateTail)
      maskRange(surface, start + 1, node.end)
    ts.forEachChild(node, visit)
  }
  visit(tree)
  // Mask literals first so regex quotes/comment markers cannot poison trivia scanning.
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    surface.join(''),
  )
  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      maskRange(surface, scanner.getTokenPos(), scanner.getTextPos())
    }
  }
  return surface.join('')
}

function maskRange(surface: string[], start: number, end: number): void {
  for (let index = start; index < end; index++) {
    if (surface[index] !== '\n' && surface[index] !== '\r') surface[index] = ' '
  }
}
