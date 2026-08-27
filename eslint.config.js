import eslintConfigPrettier from 'eslint-config-prettier'
import pluginImport from 'eslint-plugin-import'
import pluginReactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

import noUnknownInSignatures from './scripts/eslint-rules/no-unknown-in-signatures.js'

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      '**/dist/*',
      '**/.next/*',
      '**/.contentlayer/*',
      '**/node_modules/*',
      'cli/bin/**', // Generated compiled binaries and sibling release assets; never lint build output
      'cli/.tmp/**', // Generated sigma bundle artifacts (cli/scripts/generate-sigma.ts) — machine output, never source
      'agents-graveyard/**', // Archived/deprecated agents - no need to lint
      'resources/**', // Vendored resource files - not linted (see .prettierignore / .markdownlintignore)
      'research/**', // Vendored research snapshots - not linted (see .prettierignore / .markdownlintignore)
      'devvy-main/**', // Vendored reference codebase (Discord Rich Presence design source) - not part of the monorepo
      'master-fetch-master/**', // Vendored reference codebase (Hound keyless-search design source) - not part of the monorepo
      'dev/scratchpad/**', // Ephemeral working area (gitignored, see .gitignore) — ad-hoc tools may use console freely
      '.qoder/**', // Better-harness run artifacts (renderer-generated reports) — machine output, not source
      'cli/src/agents/bundled-agents.generated.ts', // Auto-generated agent code with embedded console strings
      'cli/src/agents/bundled-agents.generated.d.ts', // Auto-generated type declarations
      'cli/src/constants/cytoscape.ts', // Auto-generated 373KB inline JS constant (single-token template literal)
      'packages/code-map/__tests__/test-langs/', // Test fixture files (JS/TS for code-map tests)
      'packages/llm-providers/src/openai-compatible/chat/stream-transform.test.ts', // Test fixture: console.log in transformation test
      'scripts/eslint-rules/**', // The rule implementations themselves are not linted by this rule
    ],
  },

  // CLI package: enforce using CliProcessEnv instead of ProcessEnv
  {
    files: ['cli/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@savant-code/common/env-process',
              importNames: ['getProcessEnv', 'processEnv'],
              message:
                'CLI should use getCliEnv() from "../utils/env" or "./env" instead of getProcessEnv() from common. This ensures CLI uses CliEnv type.',
            },
          ],
          patterns: [
            {
              group: ['@savant-code/common/types/contracts/env'],
              importNames: ['ProcessEnv'],
              message:
                'CLI should use CliEnv from "../types/env" instead of ProcessEnv from common.',
            },
          ],
        },
      ],
    },
  },

  // Teacher UI components: zero-authority surface (FID-2026-0813-022).
  // The sidebar panel + overlay render a passive mirror of the teacher runtime
  // singleton and must never import runtime, write, filesystem, child-process,
  // or crypto primitives. The runtime bridge (cli/src/teacher/runtime.ts)
  // legitimately uses node:fs/crypto/path and is deliberately NOT covered.
  {
    files: [
      'cli/src/components/savant-ui/teacher/*.tsx',
      'cli/src/components/right-sidebar.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'node:fs',
              message:
                'Teacher UI is read-only; filesystem access is forbidden.',
            },
            {
              name: 'node:child_process',
              message:
                'Teacher UI is read-only; subprocess access is forbidden.',
            },
            {
              name: 'node:path',
              message: 'Teacher UI is read-only; path access is forbidden.',
            },
            {
              name: 'node:crypto',
              message: 'Teacher UI is read-only; crypto access is forbidden.',
            },
          ],
          patterns: [
            {
              group: [
                '@savant-code/agent-runtime',
                '@savant-code/agent-runtime/*',
              ],
              message:
                'Teacher UI must consume the passive store mirror, not the runtime.',
            },
          ],
        },
      ],
    },
  },

  // SDK package: enforce using SdkProcessEnv instead of ProcessEnv
  {
    files: ['sdk/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@savant-code/common/env-process',
              importNames: ['getProcessEnv', 'processEnv'],
              message:
                'SDK should use getSdkEnv() from "./env" instead of getProcessEnv() from common. This ensures SDK uses SdkEnv type.',
            },
          ],
          patterns: [
            {
              group: ['@savant-code/common/types/contracts/env'],
              importNames: ['ProcessEnv'],
              message:
                'SDK should use SdkEnv from "./types/env" instead of ProcessEnv from common.',
            },
          ],
        },
      ],
    },
  },

  // Base config for JS/TS files
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      import: pluginImport,
      '@typescript-eslint': tseslint.plugin,
      'react-hooks': pluginReactHooks,
      savant: {
        rules: {
          'no-unknown-in-signatures': noUnknownInSignatures,
        },
      },
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      'import/order': [
        'warn',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
            'type',
          ],
          alphabetize: { order: 'asc', caseInsensitive: true },
          'newlines-between': 'always',
        },
      ],
      'import/no-unresolved': 'off', // Disabled: TypeScript/Bun handles module resolution; this rule produces false positives with path aliases
      'import/no-duplicates': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          args: 'none',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
      '@typescript-eslint/no-explicit-any': [
        'error',
        {
          ignoreRestArgs: true,
          fixToUnknown: false, // Do NOT auto-fix any -> unknown; unknown is also forbidden by our rule below
        },
      ],
      // ECHO Law 6: ban `unknown` as param/return/var type (except inside `v is T` type guards)
      // Temporarily disabled while the dedicated unknown-cleanup FID is drafted (see FID-069 notes).
      // NOTE: re-enable as 'error' once all non-guard `unknown` usages are typed or suppressed.
      'savant/no-unknown-in-signatures': 'off',
      // React Rules of Hooks (FID-2026-0815-014): hooks must run unconditionally
      // in the same order every render; a conditional `return` before a hook
      // crashes React with "Rendered more hooks than during the previous render".
      'react-hooks/rules-of-hooks': 'error',
      // exhaustive-deps is OFF for now: its pre-existing warnings would fail the
      // `--max-warnings 0` gate; a separate triage FID owns them.
      'react-hooks/exhaustive-deps': 'off',
      'no-console': 'warn', // Production code must use the structured logger; suppress locally with a justification comment
      '@next/next/no-img-element': 'off', // Disabled: plugin not configured for all packages
    },
  },

  // Allow console in TUI user-facing output files (login, TUI components)
  {
    files: [
      'cli/src/login/**/*.{ts,tsx}',
      'cli/src/components/tui/**/*.{ts,tsx}',
    ],
    rules: {
      'no-console': 'off',
    },
  },

  // Test files: allow console and explicit any while the dedicated test-cleanup FID is queued.
  // NOTE(FID-068 follow-up): remove this override once test-only `any`/`console` cleanup is complete.
  {
    files: [
      '**/__tests__/**/*.{ts,tsx}',
      '**/*.test.{ts,tsx}',
      '**/*.integration.test.{ts,tsx}',
      'cli/src/**/helpers/*.{ts,tsx}',
    ],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Tooling directories: console IS the output mechanism (benchmark harnesses,
  // build/release scripts, smoke tests, type-compat fixtures). Per FID-070
  // (law-5-and-14: remove todos and console in production), console is allowed
  // in dedicated CLI scripts and tooling; all production source dirs
  // (cli/src, sdk/src, common/src, packages/*/src, agents) stay governed.
  {
    files: [
      'desktop/scripts/**', // Sidecar build pipeline (FID-2026-0820-009): console is the output mechanism
      'evals/**',
      'scripts/**',
      '.agents/skills/**/scripts/**', // Skill tooling (FID-2026-0806-007): console is the output mechanism
      '.agents/skills/**/templates/engine/**', // Skill browser engine templates (FID-2026-0823-001): console is a legitimate output mechanism there too
      'sdk/scripts/**',
      'sdk/test/**',
      'sdk/smoke-test-dist.ts',
      'cli/scripts/**',
      'cli/release*/**',
      'savant-free/cli/**',
      // Manual E2E harnesses (renamed from *.test.ts so `bun test` discovery
      // does not execute them): console is the output mechanism for these CLI
      // scripts, same as scripts/** tooling.
      'agents/browser-use/manual-e2e.ts',
      'agents/librarian/manual-e2e.ts',
    ],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Prettier config (last to override formatting rules)
  eslintConfigPrettier,
)
