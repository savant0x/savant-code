import eslintConfigPrettier from 'eslint-config-prettier'
import pluginImport from 'eslint-plugin-import'
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
      'agents-graveyard/**', // Archived/deprecated agents - no need to lint
      'cli/src/agents/bundled-agents.generated.ts', // Auto-generated agent code with embedded console strings
      'cli/src/agents/bundled-agents.generated.d.ts', // Auto-generated type declarations
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
      // Currently 'warn' — flips to 'error' after the cleanup FID (FID-2026-0720-???)
      // resolves the 367 existing `: unknown` usages in src. See dev/fids/.
      'savant/no-unknown-in-signatures': 'warn',
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'], // Allow console.warn/error for diagnostic fallback
        },
      ],
      'react-hooks/exhaustive-deps': 'off', // Disabled: plugin not configured for all packages
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

  // Prettier config (last to override formatting rules)
  eslintConfigPrettier,
)
