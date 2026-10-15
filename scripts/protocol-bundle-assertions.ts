/**
 * @module protocol-bundle-assertions
 *
 * FID-2026-0819-005 Loop 255: content assertions for the protocol bundle
 * generator, extracted verbatim from generate-protocol-bundle.ts.
 *
 * Content assertions (run in both modes):
 * - condensed-copy validation against ECHO.md (protocol-copies);
 * - harness-boundary sweep: harness-injected context must contain ZERO
 *   references to the single-agent document.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

import { validateEmbeddedLearningSource } from './learnings-core.js'
import { validateCondensedCopies } from './protocol-copies.js'
import { toolNames } from '../common/src/tools/constants'

const ROOT = resolve(import.meta.dir, '..')

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

export function runContentAssertions(paths: {
  outInstructions: string
  outRefresh: string
}): string[] {
  const { outInstructions, outRefresh } = paths
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
      readFileSafe(outInstructions),
    ],
    [
      'packages/agent-runtime/src/echo/protocol-refresh.generated.ts',
      readFileSafe(outRefresh),
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

function readFileSafe(filePath: string): string | undefined {
  try {
    return readFileSync(filePath, 'utf8')
  } catch {
    return undefined
  }
}
