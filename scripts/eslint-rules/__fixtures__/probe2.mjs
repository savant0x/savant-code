import { RuleTester } from 'eslint'
import * as tseslint from 'typescript-eslint'
const rt = new RuleTester({ languageOptions: { parser: tseslint.parser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } } })
rt.run('probe2', {
  meta: { messages: { x: '' } },
  create(context) {
    return {
      'FunctionDeclaration > TSTypeAnnotation'(node) {
        // this is the RETURN type annotation
        const fn = node.parent
        console.error('RETURN ANNOTATION:', JSON.stringify({
          fnReturnType: fn.returnType && fn.returnType.typeAnnotation && fn.returnType.typeAnnotation.type,
          nodeType: node.typeAnnotation.type,
        }))
        context.report({ node, messageId: 'x' })
      },
    }
  },
}, {
  valid: [],
  invalid: [
    { code: `function isUser(v: unknown): v is { id: string } { return true }`, errors: [{ messageId: 'x' }] },
  ],
})
console.log('PROBE2 DONE')
