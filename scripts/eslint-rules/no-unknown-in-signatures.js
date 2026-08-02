// ECHO Law 6 enforcement: ban `unknown` as a parameter type, return type, or
// standalone variable declaration — EXCEPT inside a user-defined type guard
// (`v is T`), where `unknown` is the legitimate input type.
//
// Rationale (ECHO.md Law 6, TypeScript row):
//   `unknown` is deferred `any`. Using it as a param/return/var type lets an
//   untyped value flow through the system; the only valid use is the INPUT of a
//   `v is T` predicate, which performs RUNTIME validation before the value is
//   treated as a known type. Casts (`as T`) are NOT verification.
//
// This rule is the machine-enforceable backing for the ECHO.md Law 6 table row.

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow `unknown` as a parameter/return/variable type except inside a `v is T` type guard',
      recommended: false,
    },
    schema: [],
    messages: {
      noUnknownSig:
        '`unknown` as a {{position}} type violates ECHO Law 6. Use the actual domain type, or — at a trust boundary — a user-defined type guard `v is T` with runtime validation. Never a cast.',
    },
  },

  create(context) {
    function isTypeGuardFunction(funcNode) {
      if (!funcNode) return false
      // A type guard is identified by its RETURN TYPE ANNOTATION being a
      // `v is T` predicate — in ESLint's AST this is a TSTypePredicate node.
      const rt = funcNode.returnType
      if (
        rt &&
        rt.typeAnnotation &&
        rt.typeAnnotation.type === 'TSTypePredicate'
      ) {
        return true
      }
      return false
    }

    function getEnclosingFunction(node) {
      let curr = node.parent
      while (curr) {
        if (
          curr.type === 'FunctionDeclaration' ||
          curr.type === 'FunctionExpression' ||
          curr.type === 'ArrowFunctionExpression'
        ) {
          return curr
        }
        curr = curr.parent
      }
      return null
    }

    function containsUnknown(node) {
      if (!node) return false
      if (node.type === 'TSUnknownKeyword') return true
      // Recurse into child type nodes
      for (const key of Object.keys(node)) {
        if (key === 'parent') continue
        const val = node[key]
        if (Array.isArray(val)) {
          for (const child of val) {
            if (
              typeof child === 'object' &&
              child &&
              child.type &&
              containsUnknown(child)
            )
              return true
          }
        } else if (val && typeof val === 'object' && val.type) {
          if (containsUnknown(val)) return true
        }
      }
      return false
    }

    return {
      TSTypeAnnotation(node) {
        const typeNode = node.typeAnnotation
        if (!typeNode || !containsUnknown(typeNode)) return

        const parent = node.parent

        // Case A: variable declaration — `const x: unknown = ...`
        if (parent.type === 'VariableDeclaration') {
          context.report({
            node: typeNode,
            messageId: 'noUnknownSig',
            data: { position: 'variable' },
          })
          return
        }

        // Case B: function return type — `fn(): unknown`
        if (
          parent.type === 'FunctionDeclaration' ||
          parent.type === 'FunctionExpression' ||
          parent.type === 'ArrowFunctionExpression'
        ) {
          // Arrow concise body that IS a predicate `v => v is T` is allowed.
          if (
            parent.type === 'ArrowFunctionExpression' &&
            parent.body &&
            parent.body.type === 'TSIsExpression'
          ) {
            return
          }
          context.report({
            node: typeNode,
            messageId: 'noUnknownSig',
            data: { position: 'return' },
          })
          return
        }

        // Case C: parameter type — `fn(x: unknown)`
        // In ESLint's AST, a param annotation's parent is `Identifier` (the param
        // name), whose parent is the function node. Walk up to confirm.
        if (parent.type === 'Identifier') {
          const fn = getEnclosingFunction(parent)
          if (fn && isTypeGuardFunction(fn)) {
            return // unknown is allowed as the guard's input param
          }
          context.report({
            node: typeNode,
            messageId: 'noUnknownSig',
            data: { position: 'parameter' },
          })
          return
        }
      },
    }
  },
}
