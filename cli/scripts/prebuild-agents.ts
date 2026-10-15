#!/usr/bin/env bun

import * as fs from 'fs'
import * as path from 'path'

import {
  format as formatWithPrettier,
  resolveConfig as resolvePrettierConfig,
} from 'prettier'

import { writeFileAtomic } from '../src/utils/write-file-atomic'

import type { AgentDefinition } from '@savant-code/common/templates/initial-agents-dir/types/agent-definition'

// FID-2026-0810-001: load repo-root .env.local before importing agent files.
// The boot chain runs with `--cwd cli`, so Bun's auto-loader looks for
// cli/.env.local (absent) instead of the repo-root file. This explicit import
// walks up from cli/scripts/ via findUp() to find and apply .env.local.
import '../src/pre-init/load-dev-env'

const AGENTS_DIR = path.join(import.meta.dir, '../../agents')
const OUTPUT_FILE = path.join(
  import.meta.dir,
  '../src/agents/bundled-agents.generated.ts',
)
const DATA_DIR = path.join(
  import.meta.dir,
  '../src/agents/bundled-agents.generated-data',
)

type BundledAgentDefinition = Omit<AgentDefinition, 'handleSteps'> & {
  handleSteps?: string
  [key: string]: unknown
}

type AgentLoadResult =
  | { definition: BundledAgentDefinition; failed: false }
  | { definition: null; failed: false }
  | { definition: null; failed: true }

function getAllTsFiles(dir: string): string[] {
  const files: string[] = []

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        // Skip __tests__ and node_modules directories
        if (
          entry.name === '__tests__' ||
          entry.name === 'node_modules' ||
          entry.name === 'types'
        ) {
          continue
        }
        files.push(...getAllTsFiles(fullPath))
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.d.ts') &&
        !entry.name.endsWith('.test.ts') &&
        !entry.name.endsWith('manual-e2e.ts')
      ) {
        files.push(fullPath)
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(`Error reading directory ${dir}: ${errorMessage}`)
  }

  return files
}

async function loadAgentDefinition(filePath: string): Promise<AgentLoadResult> {
  try {
    const module = await import(filePath)
    const definition = module.default

    if (!definition) {
      const namedExports = Object.keys(module).filter(
        (key) => key !== 'default',
      )
      if (namedExports.length === 0) {
        console.warn(
          `⚠️  Skipped ${filePath}: no default export and no named exports found`,
        )
      }
      return { definition: null, failed: false }
    }

    if (!definition.id) {
      console.warn(`⚠️  Skipped ${filePath}: missing required 'id' field`)
      return { definition: null, failed: false }
    }

    if (!definition.model) {
      console.warn(
        `⚠️  Skipped ${filePath} (agent '${definition.id}'): missing required 'model' field`,
      )
      return { definition: null, failed: false }
    }

    const processed: BundledAgentDefinition = {
      ...definition,
      ...(typeof definition.handleSteps === 'function'
        ? { handleSteps: definition.handleSteps.toString() }
        : definition.handleSteps === undefined
          ? {}
          : { handleSteps: definition.handleSteps }),
    }

    return { definition: processed, failed: false }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`❌ Failed to load agent from ${filePath}: ${errorMsg}`)
    return { definition: null, failed: true }
  }
}

function chunkName(agentId: string, index: number): string {
  const safeId = agentId.replace(/[^a-zA-Z0-9_-]/g, '-')
  return `${String(index).padStart(2, '0')}-${safeId}.ts`
}

function generateAgentChunk(
  agentId: string,
  definition: BundledAgentDefinition,
): string {
  const agent = { [agentId]: definition }
  return `/** AUTO-GENERATED from agents/${agentId}; do not edit. */

import type { AgentDefinition } from '@savant-code/common/templates/initial-agents-dir/types/agent-definition'

type BundledAgentDefinition = Omit<AgentDefinition, 'handleSteps'> & {
  handleSteps?: string
  [key: string]: unknown
}

export const bundledAgent: Record<string, BundledAgentDefinition> = ${JSON.stringify(agent, null, 2)};
`
}

function generateBundledAgentsFile(agentIds: string[]): string {
  const imports = agentIds
    .map(
      (id, index) =>
        `import { bundledAgent as bundledAgent${index} } from './bundled-agents.generated-data/${chunkName(id, index).slice(0, -3)}'`,
    )
    .join('\n')
  const chunks = agentIds.map((_, index) => `bundledAgent${index}`).join(', ')

  return `/**
 * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 * Agent definitions are generated into per-agent modules by prebuild-agents.ts.
 */

${imports}
import type { AgentDefinition } from '@savant-code/common/templates/initial-agents-dir/types/agent-definition'
import type { LocalAgentInfo } from '../utils/local-agent-registry'

export type BundledAgentDefinition = Omit<AgentDefinition, 'handleSteps'> & {
  handleSteps?: string
  [key: string]: unknown
}

export const bundledAgents: Record<string, BundledAgentDefinition> = Object.assign(
  {},
  ${chunks},
)

export function getBundledAgentsAsLocalInfo(): LocalAgentInfo[] {
  return Object.values(bundledAgents).map((agent) => ({
    id: agent.id,
    displayName: agent.displayName || agent.id,
    filePath: '[bundled]',
    isBundled: true,
  }))
}

export function getBundledAgentIds(): string[] {
  return Object.keys(bundledAgents)
}

export function isBundledAgent(agentId: string): boolean {
  return agentId in bundledAgents
}
`
}

async function main() {
  const DEBUG = false
  if (DEBUG) {
    console.log('🔍 DEBUG: Scanning agents/ directory...')
  }

  if (!fs.existsSync(AGENTS_DIR)) {
    console.error(`Error: agents/ directory not found at ${AGENTS_DIR}`)
    process.exitCode = 1
    return
  }

  const tsFiles = getAllTsFiles(AGENTS_DIR)
  if (DEBUG) {
    console.log(`📁 DEBUG: Found ${tsFiles.length} TypeScript files`)
  }

  const agents: Record<string, BundledAgentDefinition> = {}
  let loadedCount = 0
  let skippedCount = 0
  let failedCount = 0

  for (const filePath of tsFiles) {
    const relativePath = path.relative(AGENTS_DIR, filePath)
    const result = await loadAgentDefinition(filePath)

    if (result.definition) {
      agents[result.definition.id] = result.definition
      loadedCount++
      if (DEBUG) {
        console.log(`  ✅ DEBUG: ${result.definition.id} (${relativePath})`)
      }
    } else if (result.failed) {
      failedCount++
    } else {
      skippedCount++
      if (DEBUG) {
        console.log(
          `  ⏭️ DEBUG: Skipped: ${relativePath} (no valid default export)`,
        )
      }
    }
  }

  if (failedCount > 0) {
    console.error(
      `❌ Agent prebuild aborted: ${failedCount} agent definition(s) failed to load; existing bundle was not replaced.`,
    )
    process.exitCode = 1
    return
  }

  if (DEBUG) {
    console.log(
      `\n📦 DEBUG: Loaded ${loadedCount} agents, skipped ${skippedCount} files`,
    )
  }

  // Generate the output files only after every agent loaded successfully.
  const agentIds = Object.keys(agents)
  const chunks = agentIds.map((id, index) => ({
    filePath: path.join(DATA_DIR, chunkName(id, index)),
    source: generateAgentChunk(id, agents[id]),
  }))
  const output = generateBundledAgentsFile(agentIds)

  // Keep every generated module compliant with the repository format gate.
  const prettierConfig = await resolvePrettierConfig(import.meta.dir).catch(
    () => null,
  )
  const formatOptions = {
    parser: 'typescript' as const,
    ...(prettierConfig ?? {}),
  }
  const formatted = await formatWithPrettier(output, formatOptions)
  const formattedChunks = await Promise.all(
    chunks.map(async (chunk) => ({
      filePath: chunk.filePath,
      content: await formatWithPrettier(chunk.source, formatOptions),
    })),
  )

  const outputDir = path.dirname(OUTPUT_FILE)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  fs.rmSync(DATA_DIR, { recursive: true, force: true })
  fs.mkdirSync(DATA_DIR, { recursive: true })
  for (const chunk of formattedChunks) {
    writeFileAtomic(chunk.filePath, chunk.content)
  }
  writeFileAtomic(OUTPUT_FILE, formatted)
  if (DEBUG) {
    console.log(`\n✨ DEBUG: Generated ${OUTPUT_FILE}`)
    console.log(`   DEBUG: ${Object.keys(agents).length} agents bundled`)
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
