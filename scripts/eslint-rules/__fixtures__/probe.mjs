import { RuleTester } from 'eslint'
import * as tseslint from 'typescript-eslint'

const rt = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  },
})
rt.run(
  'type-probe',
  {
    meta: { messages: { bad: '' } },
    create(context) {
      return {
        TSTypeAnnotation(node) {
          const inner = node.typeAnnotation
          context.report({ node, messageId: 'bad' })
          if (process.env.PROBE)
            console.error(
              'INNER TYPE:',
              inner.type,
              '| code:',
              context.sourceCode.getText(inner),
            )
        },
      }
    },
  },
  {
    valid: [],
    invalid: [
      {
        code: `function bad(x: unknown): void {}`,
        errors: [{ messageId: 'bad' }],
      },
      { code: `const y: unknown = 1`, errors: [{ messageId: 'bad' }] },
    ],
  },
)
console.log('PROBE DONE')
