import { RuleTester } from 'eslint'
import * as tseslint from 'typescript-eslint'
import rule from '../no-unknown-in-signatures.js'

const rt = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  },
})

try {
  rt.run('no-unknown-in-signatures', rule, {
    valid: [
      `function isUser(v: unknown): v is { id: string } { return typeof v === 'object' }`,
      `function isUser2(v: unknown): v is User { return true }`,
      `function ok(u: { id: string }): void {}`,
      `const x: { id: string } = { id: '1' }`,
      `const arrow = (v: unknown): v is number => typeof v === 'number'`,
    ],
    invalid: [
      {
        code: `function bad(x: unknown): void {}`,
        errors: [{ messageId: 'noUnknownSig' }],
      },
      {
        code: `function bad(): unknown { return 1 }`,
        errors: [{ messageId: 'noUnknownSig' }],
      },
      { code: `const x: unknown = 1`, errors: [{ messageId: 'noUnknownSig' }] },
      {
        code: `const bad = (x: unknown) => x`,
        errors: [{ messageId: 'noUnknownSig' }],
      },
      {
        code: `function wrap(input: unknown[]): void {}`,
        errors: [{ messageId: 'noUnknownSig' }],
      },
    ],
  })
  console.log('RULE TESTS PASSED')
} catch (e) {
  console.log('RULE TEST FAILED:', e.message)
}
