#!/usr/bin/env bun
/**
 * Generate the embedded harness grounding-set bundle
 * (FID-2026-0810-002 Change 1) AND the two condensed protocol copies
 * (FID-2026-0810-003).
 *
 * Reads the canonical repo files — the HARNESS grounding set only:
 *
 *   ECHO.md · ARCHITECTURE.md · protocol.config.yaml · docs/embedded-learnings.md ·
 *   templates/FID-TEMPLATE.md
 *
 * and emits:
 *
 *   1. `common/src/constants/protocol-bundle.generated.ts` — the FULL content
 *      of each grounding file, keyed to the harness variant with the resolved
 *      harness contract (version, strictMode, protocolFile) parsed from
 *      protocol.config.yaml.
 *   2. `common/src/constants/echo-protocol-instructions.generated.ts` — the
 *      condensed `ECHO_PROTOCOL_INSTRUCTIONS` (FID-2026-0810-003), rendered
 *      from ECHO.md facts + generator-hosted framing by scripts/protocol-copies.ts.
 *   3. `packages/agent-runtime/src/echo/protocol-refresh.generated.ts` — the
 *      condensed 15-turn refresh content, rendered by the same module.
 *
 * The single-agent protocol document is deliberately NOT bundled: it is the
 * protocol for outside agents working on the repo, not the harness product,
 * and does not ship with the package (operator directive 2026-08-10).
 *
 * Usage:
 *   bun run generate:protocol-bundle            # rewrite in place
 *   bun run generate:protocol-bundle --check    # exit 1 if any file is stale
 *
 * The `--check` mode is the drift guard (mirrors the provider-docs check):
 * - the generated modules must be byte-identical to disk (an ECHO.md edit
 *   without regeneration fails CI);
 * - `scripts/protocol-copies.ts` validates every condensed line against its
 *   ECHO.md anchor (law titles/directives, FSM states, circuit breakers, five
 *   questions, FID lifecycle, anti-patterns, authoring phrases), so drift
 *   fails fast;
 * - harness-injected context must contain ZERO references to the
 *   single-agent document (Loop 5 gate: `single[ _-]?agent`).
 *
 * All inputs resolve relative to the repo root via `import.meta.dir`
 * (up-walk) — never `process.cwd()` — so the generator is safe to run from
 * any workspace.
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

import { format as formatWithPrettier } from 'prettier'

import { validateEmbeddedLearningSource } from './learnings-core.js'
import {
  extractFacts,
  renderInstructions,
  renderRefresh,
  validateCondensedCopies,
} from './protocol-copies.js'
import { toolNames } from '../common/src/tools/constants'

const ROOT = resolve(import.meta.dir, '..')
const OUT_BUNDLE = resolve(
  ROOT,
  'common/src/constants/protocol-bundle.generated.ts',
)
const OUT_INSTRUCTIONS = resolve(
  ROOT,
  'common/src/constants/echo-protocol-instructions.generated.ts',
)
const OUT_REFRESH = resolve(
  ROOT,
  'packages/agent-runtime/src/echo/protocol-refresh.generated.ts',
)

const GROUNDING_FILES = [
  'ECHO.md',
  'ARCHITECTURE.md',
  'protocol.config.yaml',
  'docs/embedded-learnings.md',
  'templates/FID-TEMPLATE.md',
] as const

/**
 * Preserve the runtime's canonical grounding request while serving the
 * curated embedded source. Local projects still read their own
 * `dev/LEARNINGS.md`; embedded fallback maps that request to this bundle key.
 */
const EMBEDDED_PATH_ALIASES: Readonly<Record<string, string>> = {
  'docs/embedded-learnings.md': 'dev/learnings.md',
}

/** Normalize a relative path for bundle-key lookup (lowercase, fwd slashes). */
export function normalizeGroundingPath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\//, '')
    .toLowerCase()
}

/** Parse the harness `protocol:` block from protocol.config.yaml. */
function readHarnessContract(): { version: string; strictMode: boolean } {
  const config = readFileSync(resolve(ROOT, 'protocol.config.yaml'), 'utf8')
  const lines = config.replace(/\r\n/g, '\n').split('\n')
  const protocolIdx = lines.findIndex((line) => line.trim() === 'protocol:')
  if (protocolIdx === -1) {
    throw new Error(
      'protocol.config.yaml has no top-level `protocol:` harness block.',
    )
  }
  const version = lines
    .slice(protocolIdx + 1)
    .map((line) => line.match(/^\s+version:\s*['"]?([^'"\s]+)['"]?/)?.[1])
    .find((value): value is string => value !== undefined)
  const strictMode =
    lines
      .slice(protocolIdx + 1)
      .map((line) => line.match(/^\s+strict_mode:\s*(true|false)/)?.[1])
      .find((value): value is string => value !== undefined) === 'true'
  if (!version) {
    throw new Error(
      'protocol.config.yaml harness block has no `version` field.',
    )
  }
  return { version, strictMode }
}

/** Render the generated full-file bundle module source. */
function renderBundle(): string {
  const { version, strictMode } = readHarnessContract()
  const files = GROUNDING_FILES.map((filePath) => {
    const content = readFileSync(resolve(ROOT, filePath), 'utf8')
    const key = normalizeGroundingPath(filePath)
    const bundleKey = EMBEDDED_PATH_ALIASES[key] ?? key
    return `  ${JSON.stringify(bundleKey)}: ${JSON.stringify(content)},`
  }).join('\n')
  return `// GENERATED by scripts/generate-protocol-bundle.ts — DO NOT EDIT.
// Run \`bun run generate:protocol-bundle\` after changing the grounding set.
// Embedded HARNESS grounding set (FID-2026-0810-002 Change 1). The
// single-agent protocol document is intentionally NOT bundled — it belongs to
// a third-party harness for outside agents, not the savant-code product.
export const EMBEDDED_PROTOCOL_BUNDLE = {
  variant: 'harness' as const,
  protocolFile: 'ECHO.md',
  protocolVersion: ${JSON.stringify(version)},
  strictMode: ${strictMode},
  files: {
${files}
  },
} as const

/** Normalized bundle keys (lowercase, forward slashes) for lookups. */
export const EMBEDDED_PROTOCOL_FILE_KEYS: readonly string[] = [
  ${GROUNDING_FILES.map((f) => JSON.stringify(EMBEDDED_PATH_ALIASES[normalizeGroundingPath(f)] ?? normalizeGroundingPath(f))).join(',\n  ')}
] as const
`
}

/** Render the generated ECHO_PROTOCOL_INSTRUCTIONS module source. */
function renderInstructionsModule(): string {
  const { version } = readHarnessContract()
  const echoMd = readFileSync(resolve(ROOT, 'ECHO.md'), 'utf8')
  const instructions = renderInstructions(
    // validateCondensedCopies parses facts internally; renderInstructions needs
    // the parsed facts, so extract inline via the shared renderer path.
    parseFactsForRender(echoMd),
    version,
  )
  return `// GENERATED by scripts/generate-protocol-bundle.ts — DO NOT EDIT.
// Run \`bun run generate:protocol-bundle\` after changing ECHO.md or the
// framing in scripts/protocol-copies.ts (FID-2026-0810-003).
// Condensed ECHO protocol instructions rendered from ECHO.md facts + framing.
export const ECHO_PROTOCOL_INSTRUCTIONS: string = ${JSON.stringify(instructions)}
`
}

/** Render the generated 15-turn refresh content module source. */
function renderRefreshModule(): string {
  const { version } = readHarnessContract()
  const echoMd = readFileSync(resolve(ROOT, 'ECHO.md'), 'utf8')
  const refresh = renderRefresh(parseFactsForRender(echoMd), version)
  return `// GENERATED by scripts/generate-protocol-bundle.ts — DO NOT EDIT.
// Run \`bun run generate:protocol-bundle\` after changing ECHO.md or the
// framing in scripts/protocol-copies.ts (FID-2026-0810-003).
// Condensed 15-turn protocol refresh content (sentinel is composed by
// protocol-summary.ts). Do not edit by hand.
export const PROTOCOL_REFRESH_CONTENT: string = ${JSON.stringify(refresh)}
`
}

/** Parse ECHO.md facts once for the renderers. */
function parseFactsForRender(echoMd: string): ReturnType<typeof extractFacts> {
  return extractFacts(echoMd)
}

/**
 * Content assertions (run in both modes):
 * - condensed-copy validation against ECHO.md (protocol-copies);
 * - harness-boundary sweep: harness-injected context must contain ZERO
 *   references to the single-agent document.
 */
/**
 * FID-2026-0817-002 A1: drift guard for the phase-gating classification in
 * the generated instructions. The instructions claim "only 5 tools are
 * phase-gated; everything else (including run_readonly_command) is all-phase";
 * this asserts that claim against the live tool registry so a reclassified or
 * renamed tool fails generation instead of silently drifting.
 */
function validateToolAvailability(): string[] {
  const failures: string[] = []
  const phaseGated = [
    'write_file',
    'str_replace',
    'apply_patch',
    'run_terminal_command',
    'sequentialthinking',
  ] as const
  const allPhaseSanity = [
    'run_readonly_command',
    'read_files',
    'code_search',
    'glob',
    'list_directory',
  ] as const
  const registry = new Set(toolNames)
  for (const name of phaseGated) {
    if (!registry.has(name)) {
      failures.push(
        `phase-gated tool "${name}" is missing from the toolNames registry.`,
      )
    }
  }
  for (const name of allPhaseSanity) {
    if (!registry.has(name)) {
      failures.push(
        `all-phase tool "${name}" is missing from the toolNames registry.`,
      )
    }
    if ((phaseGated as readonly string[]).includes(name)) {
      failures.push(
        `tool "${name}" is documented as all-phase but listed as phase-gated.`,
      )
    }
  }
  return failures
}

function runContentAssertions(): string[] {
  const failures: string[] = []
  const echoMd = readFileSync(resolve(ROOT, 'ECHO.md'), 'utf8')

  failures.push(...validateCondensedCopies(echoMd))
  failures.push(...validateToolAvailability())

  const curatedLearningPath = resolve(ROOT, 'docs/embedded-learnings.md')
  const curatedLearning = readFileSafe(curatedLearningPath)
  if (curatedLearning === undefined) {
    failures.push(
      'docs/embedded-learnings.md is missing — embedded learning source is required.',
    )
  } else {
    failures.push(
      ...validateEmbeddedLearningSource(
        'docs/embedded-learnings.md',
        curatedLearning,
      ).map((issue) => `[${issue.code}] ${issue.message}`),
    )
  }

  // Harness-injected context (hand-written + generated copies that ship in
  // prompts/refresh). Generator scripts are build tooling, not injected.
  const boundaryFiles: Array<[string, string | undefined]> = [
    [
      'packages/agent-runtime/src/echo/protocol-summary.ts',
      readFileSafe(
        resolve(ROOT, 'packages/agent-runtime/src/echo/protocol-summary.ts'),
      ),
    ],
    [
      'agents/savant/system-prompt.ts',
      readFileSafe(resolve(ROOT, 'agents/savant/system-prompt.ts')),
    ],
    [
      'agents/savant/prompts.ts',
      readFileSafe(resolve(ROOT, 'agents/savant/prompts.ts')),
    ],
    [
      'agents/thinker/thinker.ts',
      readFileSafe(resolve(ROOT, 'agents/thinker/thinker.ts')),
    ],
    [
      'common/src/constants/agents.ts',
      readFileSafe(resolve(ROOT, 'common/src/constants/agents.ts')),
    ],
    [
      'common/src/constants/echo-protocol-instructions.generated.ts',
      readFileSafe(OUT_INSTRUCTIONS),
    ],
    [
      'packages/agent-runtime/src/echo/protocol-refresh.generated.ts',
      readFileSafe(OUT_REFRESH),
    ],
  ]
  for (const [filePath, content] of boundaryFiles) {
    if (content === undefined) continue // not yet generated this run — covered by drift check
    const match = content.match(/single[ _-]?agent/i)
    if (match) {
      failures.push(
        `${filePath} references the single-agent document ("${match[0].trim()}") in harness-injected context — purge it.`,
      )
    }
  }

  return failures
}

/** Resolve repo prettier config (explicitly — resolveConfig returns null here). */
function loadPrettierConfig(): Record<string, unknown> {
  try {
    return JSON.parse(
      readFileSync(resolve(ROOT, '.prettierrc'), 'utf8'),
    ) as Record<string, unknown>
  } catch {
    return {}
  }
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check')
  const failures = runContentAssertions()
  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`protocol-bundle: ${failure}`)
    }
    process.exit(1)
  }

  const prettierConfig = loadPrettierConfig()
  const [bundle, instructions, refresh] = await Promise.all([
    formatWithPrettier(renderBundle(), {
      parser: 'typescript',
      ...prettierConfig,
    }),
    formatWithPrettier(renderInstructionsModule(), {
      parser: 'typescript',
      ...prettierConfig,
    }),
    formatWithPrettier(renderRefreshModule(), {
      parser: 'typescript',
      ...prettierConfig,
    }),
  ])
  const outputs: Array<[string, string]> = [
    [OUT_BUNDLE, bundle],
    [OUT_INSTRUCTIONS, instructions],
    [OUT_REFRESH, refresh],
  ]

  if (check) {
    let stale = false
    for (const [filePath, formatted] of outputs) {
      let disk: string | undefined
      try {
        disk = readFileSync(filePath, 'utf8')
      } catch {
        stale = true
      }
      if (disk !== formatted) {
        console.error(
          `STALE: ${resolve('.', filePath)} is out of sync with the grounding set / ECHO.md facts.`,
        )
        stale = true
      }
    }
    if (stale) {
      console.error('Run `bun run generate:protocol-bundle` to regenerate.')
      process.exit(1)
    }
    console.log(
      `Embedded protocol bundle + condensed copies are up to date (${GROUNDING_FILES.length} grounding files, harness v${readHarnessContract().version}).`,
    )
    return
  }

  let changedCount = 0
  for (const [filePath, formatted] of outputs) {
    let disk: string | undefined
    try {
      disk = readFileSync(filePath, 'utf8')
    } catch {
      disk = undefined
    }
    if (disk !== formatted) {
      writeFileSync(filePath, formatted)
      changedCount++
    }
  }
  console.log(
    `protocol bundle: ${changedCount > 0 ? `updated (${changedCount} file(s))` : 'unchanged'} (${GROUNDING_FILES.length} grounding files, harness v${readHarnessContract().version})`,
  )
}

function readFileSafe(filePath: string): string | undefined {
  try {
    return readFileSync(filePath, 'utf8')
  } catch {
    return undefined
  }
}

main()
