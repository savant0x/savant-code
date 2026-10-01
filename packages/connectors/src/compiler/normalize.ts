/**
 * Fn source NORMALIZATION — one byte-form per meaning, so cosmetic edits
 * (comments, re-wrapping, indentation) never mint new fn ids or churn doc
 * hashes. The normal form is COMPACT: a single line with no newlines or
 * indentation (author whitespace is not preserved — it is replaced).
 *
 * Pipeline: parse (TS compiler, already a dependency for the closed-term
 * lint) → strip comments → deterministic AST print → COMPACT (re-tokenize
 * the printed output with TypeScript's own scanner and join tokens on one
 * line). Why the join is safe where naive whitespace-stripping is not:
 *   - the PRINTER's output never relies on ASI (every statement is
 *     semicolon-terminated), so its newlines are pure formatting;
 *   - string/template literals are single scanner tokens copied VERBATIM —
 *     semantic newlines INSIDE template strings survive untouched;
 *   - a space is inserted only where concatenation would merge tokens
 *     (`return x`, `a+ +b`);
 *   - a SAFETY GATE re-parses the compacted source and re-prints it — any
 *     token-structure drift (e.g. a mis-detected regex) throws at compile
 *     time instead of ever emitting a corrupted fn.
 * (Minifiers were rejected: esbuild adds a wasm/native dependency to the
 * compiler and couples byte-output to its version — design D18.)
 */
import ts from 'typescript'

const WRAP_PREFIX = 'const __fn = '

const cache = new Map<string, string>()

function parseWrapped(src: string): ts.SourceFile {
  const sourceFile = ts.createSourceFile(
    'fn.ts',
    `${WRAP_PREFIX}${src};\n`,
    ts.ScriptTarget.ES2022,
    /* setParentNodes */ false,
    ts.ScriptKind.TS,
  )
  const diagnostic = (
    sourceFile as unknown as {
      parseDiagnostics?: { messageText: unknown }[]
    }
  ).parseDiagnostics?.[0]
  if (diagnostic) {
    throw new Error(
      `fn source does not parse: ${ts.flattenDiagnosticMessageText(
        diagnostic.messageText as string,
        ' ',
      )}`,
    )
  }
  return sourceFile
}

/** Parse + comment-strip + canonical AST print (LF pinned, wrap removed). */
function printNormalized(src: string): string {
  const printer = ts.createPrinter({
    removeComments: true,
    newLine: ts.NewLineKind.LineFeed,
  })
  const printed = printer.printFile(parseWrapped(src)).trim()
  if (!printed.startsWith(WRAP_PREFIX) || !printed.endsWith(';')) {
    throw new Error('unexpected canonical printer output shape for fn source')
  }
  return printed.slice(WRAP_PREFIX.length, -1).trim()
}

const IDENTISH = /[A-Za-z0-9_$]/

/** Token kinds after which a `/` is DIVISION (expression just ended) —
 *  everywhere else a slash starts a regex and gets re-scanned as one.
 *  CloseBrace is treated as division (object-literal / block ambiguity —
 *  the safety gate catches a wrong guess loudly). */
const DIVISION_CONTEXT = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.Identifier,
  ts.SyntaxKind.PrivateIdentifier,
  ts.SyntaxKind.NumericLiteral,
  ts.SyntaxKind.BigIntLiteral,
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.RegularExpressionLiteral,
  ts.SyntaxKind.ThisKeyword,
  ts.SyntaxKind.SuperKeyword,
  ts.SyntaxKind.NullKeyword,
  ts.SyntaxKind.TrueKeyword,
  ts.SyntaxKind.FalseKeyword,
  ts.SyntaxKind.CloseParenToken,
  ts.SyntaxKind.CloseBracketToken,
  ts.SyntaxKind.CloseBraceToken,
  ts.SyntaxKind.PlusPlusToken,
  ts.SyntaxKind.MinusMinusToken,
])

/** Join the printed source's tokens on one line (see module doc for safety). */
function compact(printed: string): string {
  const scanner = ts.createScanner(
    ts.ScriptTarget.ES2022,
    /* skipTrivia */ true,
    ts.LanguageVariant.Standard,
    printed,
  )
  // brace-depth stack for template substitutions: `head${ … }tail`
  const templateDepths: number[] = []
  let out = ''
  let prevLast = ''
  let prevKind: ts.SyntaxKind | undefined

  while (true) {
    let token = scanner.scan()
    if (token === ts.SyntaxKind.EndOfFileToken) break

    // a `}` that closes a template substitution must be re-scanned as
    // the template's middle/tail (the scanner needs the parser's nudge)
    if (
      token === ts.SyntaxKind.CloseBraceToken &&
      templateDepths.length > 0 &&
      templateDepths[templateDepths.length - 1] === 0
    ) {
      token = scanner.reScanTemplateToken(/* isTaggedTemplate */ false)
      if (token === ts.SyntaxKind.TemplateTail) templateDepths.pop()
    } else if (templateDepths.length > 0) {
      if (token === ts.SyntaxKind.OpenBraceToken) {
        templateDepths[templateDepths.length - 1]++
      } else if (token === ts.SyntaxKind.CloseBraceToken) {
        templateDepths[templateDepths.length - 1]--
      }
    }
    if (token === ts.SyntaxKind.TemplateHead) templateDepths.push(0)

    // a `/` not in division context starts a regex literal
    if (
      (token === ts.SyntaxKind.SlashToken ||
        token === ts.SyntaxKind.SlashEqualsToken) &&
      (prevKind === undefined || !DIVISION_CONTEXT.has(prevKind))
    ) {
      token = scanner.reScanSlashToken()
    }

    const text = scanner.getTokenText()
    if (text.length === 0) continue
    const first = text[0]
    if (out.length > 0) {
      const merges =
        (IDENTISH.test(prevLast) && IDENTISH.test(first)) ||
        (prevLast === '+' && first === '+') ||
        (prevLast === '-' && first === '-')
      if (merges) out += ' '
    }
    out += text
    prevLast = text[text.length - 1]
    prevKind = token
  }
  return out
}

/** Structural AST equality — kind tree + leaf `text` (identifiers,
 *  literals, template parts). Deliberately ignores positions/layout. */
function astEqual(a: ts.Node, b: ts.Node): boolean {
  if (a.kind !== b.kind) return false
  const aChildren: ts.Node[] = []
  const bChildren: ts.Node[] = []
  a.forEachChild((child) => {
    aChildren.push(child)
  })
  b.forEachChild((child) => {
    bChildren.push(child)
  })
  if (aChildren.length !== bChildren.length) return false
  if (aChildren.length === 0) {
    const aText = (a as { text?: string }).text
    const bText = (b as { text?: string }).text
    if (aText !== bText) return false
  }
  return aChildren.every((child, index) => astEqual(child, bChildren[index]))
}

export function normalizeFnSource(src: string): string {
  const hit = cache.get(src)
  if (hit !== undefined) return hit

  const printed = printNormalized(src)
  const compacted = compact(printed)
  // SAFETY GATE, parser-authority (independent of the scanner heuristics
  // above): re-PARSE the compacted form and demand structural AST equality
  // with the printed form. A wrong regex/template guess produces different
  // nodes and fails HERE, loudly, instead of ever emitting a semantically
  // different fn. (Byte-comparing re-prints would not work: the TS printer
  // preserves the source's line-break layout, so it is not
  // layout-independent — which is also why compaction, not the printer,
  // is what makes the normal form truly canonical.)
  if (!astEqual(parseWrapped(printed), parseWrapped(compacted))) {
    throw new Error('fn source compaction altered the AST — refusing to emit')
  }
  cache.set(src, compacted)
  return compacted
}
