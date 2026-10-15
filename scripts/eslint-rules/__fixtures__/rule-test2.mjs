import { RuleTester } from 'eslint'
import * as tseslint from 'typescript-eslint'
import rule from '../no-unknown-in-signatures.js'
const rt = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  },
})
const cases = [
  `function bad(x: unknown): void {}`,
  `function bad(): unknown { return 1 }`,
  `const x: unknown = 1`,
  `const bad = (x: unknown) => x`,
  `function wrap(input: unknown[]): void {}`,
]
for (const code of cases) {
  try {
    rt.run('t', rule, {
      valid: [],
      invalid: [{ code, errors: [{ messageId: 'noUnknownSig' }] }],
    })
    console.log('PASS:', code)
  } catch (e) {
    console.log('FAIL:', code, '->', e.message.split('\n')[0])
  }
}
