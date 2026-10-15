// FID-2026-0928-009 Parts 1+2 — utility-tier duplication enforcement.
//
// ECHO Laws 7 ("search for existing code BEFORE creating new") and 13 ("one
// function, one truth"), made mechanical for the small-helper tier: a
// top-level function/const whose NAME is a registered shared primitive is an
// ERROR unless this file is the symbol's declared canonical owner.
//
// The registry (`shared-primitives.json`, beside this rule) maps symbol →
// owner module. Adding a canonical export = one registry entry in the same
// PR. Test files are exempt by design: test-local copies never ship and
// forcing imports there adds churn without a two-truth risk.
//
// Precedent: `no-unknown-in-signatures.js` in this directory (locally
// authored rule wired through eslint.config.js as the `savant` plugin).
//
// HARVEST INHERITANCE (Part 5): the standing `eslint . --max-warnings 0`
// pre-push leg executes this rule over every workspace, so any future
// provider-harvest session that copies a shim (or re-invents sleep/
// withTimeout/isRecord/sha256 inline) inherits the ban mechanically — the
// failure mode that produced the 17 duplicated guards across
// `cli/src/utils/openrouter-models/` cannot recur silently. A harvested
// shim must import `asOptionalString`/`asOptionalNumber` from
// `cli/src/utils/openrouter-models/wire-guards.ts`.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REGISTRY_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'shared-primitives.json',
)

/** Process-level registry cache: { name → owner } plus exempt file set. */
let cache = null

function loadRegistry() {
  if (cache) return cache
  let raw
  try {
    raw = fs.readFileSync(REGISTRY_PATH, 'utf8')
  } catch (error) {
    // A missing/unreadable registry must fail LOUD — a gate that silently
    // passes is worse than none (Law 14).
    throw new Error(
      `no-duplicate-shared-primitive: cannot read registry at ${REGISTRY_PATH}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
  const parsed = JSON.parse(raw)
  const owners = new Map()
  for (const [name, entry] of Object.entries(parsed)) {
    if (
      name.startsWith('$') ||
      name === 'allowedFiles' ||
      name === 'allowedTests'
    )
      continue
    owners.set(name, typeof entry === 'string' ? entry : entry.owner)
  }
  const allowedFiles = new Set(
    (parsed.allowedFiles ?? []).map((f) => String(f).replace(/\\/g, '/')),
  )
  cache = { owners, allowedFiles, allowedTests: parsed.allowedTests === true }
  return cache
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow local top-level declarations of registered shared primitives outside their canonical home',
      recommended: false,
      schema: [],
    },
    messages: {
      duplicatePrimitive:
        "'{{name}}' is a registered shared primitive owned by '{{owner}}'. Import it instead of re-declaring it (ECHO Law 13). To move ownership, update the registry in the same PR: scripts/eslint-rules/shared-primitives.json.",
    },
  },

  create(context) {
    const filename = context.getFilename().replace(/\\/g, '/')
    // Test files never ship; local copies there are out of scope (scan + FID).
    if (
      filename.includes('.test.') ||
      filename.includes('/__tests__/') ||
      filename.includes('/fixtures/')
    ) {
      return {}
    }

    const { owners, allowedFiles } = loadRegistry()
    // Registry paths are repo-relative; ESLint reports absolute — match on
    // the path END with a `/` boundary (`xprimitives.ts` cannot match).
    const isAllowedFile = [...allowedFiles].some(
      (f) => filename === f || filename.endsWith(`/${f}`),
    )
    if (isAllowedFile) return {}

    function check(node, idName) {
      const owner = owners.get(idName)
      if (!owner) return
      if (filename.includes(owner.replace(/\\/g, '/'))) return
      context.report({
        node,
        messageId: 'duplicatePrimitive',
        data: { name: idName, owner },
      })
    }

    return {
      FunctionDeclaration(node) {
        if (node.id?.name) check(node, node.id.name)
      },
      VariableDeclaration(node) {
        for (const declarator of node.declarations) {
          if (declarator.id.type !== 'Identifier') continue
          // Only top-level (program-child) declarations are governed; a
          // local inside a function body is a different binding.
          const parent = declarator.parent?.parent
          if (parent?.type !== 'Program') continue
          const init = declarator.init
          const isFnLike =
            init?.type === 'ArrowFunctionExpression' ||
            init?.type === 'FunctionExpression'
          if (!isFnLike) continue
          check(declarator.id, declarator.id.name)
        }
      },
    }
  },
}
