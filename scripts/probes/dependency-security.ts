import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

interface Frontmatter {
  (text: string): {
    data: { title?: string; enabled?: boolean }
    content: string
  }
  stringify: (text: string, data: { title: string }) => string
}

interface Braces {
  (pattern: string, options: { expand: boolean }): string[]
  parse: (pattern: string) => object
}

function main(): void {
  const sdkRequire = createRequire(
    resolve(import.meta.dir, '../../sdk/package.json'),
  )
  const matter = sdkRequire('gray-matter') as Frontmatter
  const micromatchRequire = createRequire(sdkRequire.resolve('micromatch'))
  const braces = micromatchRequire('braces') as Braces

  const parsed = matter('---\ntitle: Release\nenabled: true\n---\nBody')
  assert.equal(parsed.data.title, 'Release')
  assert.equal(parsed.data.enabled, true)
  assert.equal(parsed.content.trim(), 'Body')
  assert.equal(
    matter(matter.stringify('Body', { title: 'Roundtrip' })).data.title,
    'Roundtrip',
  )
  assert.throws(() =>
    matter('---\nvalue: !!js/function "function() {}"\n---\n'),
  )

  assert.deepEqual(braces('src/{one,two}.ts', { expand: true }), [
    'src/one.ts',
    'src/two.ts',
  ])
  for (const [open, close] of [
    ['{', '}'],
    ['(', ')'],
  ]) {
    assert.doesNotThrow(() =>
      braces.parse(open.repeat(64) + 'a,b' + close.repeat(64)),
    )
    assert.throws(
      () => braces.parse(open.repeat(3000) + 'a,b' + close.repeat(3000)),
      (error: Error) =>
        error instanceof SyntaxError &&
        error.message.includes('maximum nesting depth'),
    )
  }
  console.log(
    'dependency-security: PASS — safe YAML roundtrip/tags and bounded brace/paren nesting',
  )
}

if (import.meta.main) main()
