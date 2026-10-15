import * as ts from 'typescript'
import { readFileSync } from 'fs'
const src = readFileSync(
  'scripts/eslint-rules/__fixtures__/unknown-bad.ts',
  'utf8',
)
const sf = ts.createSourceFile('x.ts', src, ts.ScriptTarget.Latest, true)
function walk(node, depth = 0) {
  if (node.kind === ts.SyntaxKind.UnknownKeyword) {
    let p = node.parent
    const chain = []
    while (p && chain.length < 6) {
      chain.push(ts.SyntaxKind[p.kind])
      p = p.parent
    }
    console.log('UnknownKeyword chain:', chain.join(' -> '))
  }
  ts.forEachChild(node, (c) => walk(c, depth + 1))
}
walk(sf)
