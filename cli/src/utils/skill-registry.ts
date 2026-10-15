import os from 'node:os'
import path from 'node:path'

import { SKILLS_DIR_NAME } from '@savant-code/common/constants/skills'
import { loadSkills as sdkLoadSkills } from '@savant-code/sdk'

import { getProjectRoot } from '../project-files'
import { logger } from './logger'
import { evaluateProjectTrustGate } from './project-trust-gate'

import type {
  SkillDefinition,
  SkillsMap,
} from '@savant-code/common/types/skill'

// ============================================================================
// Skills cache (loaded via SDK at startup)
// ============================================================================

let skillsCache: SkillsMap = {}

/**
 * Initialize the skill registry by loading skills via the SDK.
 * This must be called at CLI startup.
 *
 * Skills are loaded from:
 * - ~/.agents/skills/ (global)
 * - {projectRoot}/.agents/skills/ (project, overrides global)
 */
export async function initializeSkillRegistry(options?: {
  /** Project root override (tests). Default: resolved project root or cwd. */
  cwd?: string
  /** Trust-store path override (tests). Default: the Savant home store. */
  trustStorePath?: string
}): Promise<void> {
  const cwd = options?.cwd ?? (getProjectRoot() || process.cwd())

  // FID-2026-1006-002 WP9: workspace skills are executable prompt material
  // loaded from the opened directory, so the project-trust decision gates the
  // load (veto-only hook decider included). The boot phase has no interactive
  // surface, so an unresolved `ask` fails closed; the operator grants trust
  // through the store or --approve, and a later interactive consumer
  // re-resolves with the answer. A gate error is treated as a refusal too —
  // the safe direction for a trust boundary, never a crash.
  let gate: Awaited<ReturnType<typeof evaluateProjectTrustGate>> | undefined
  try {
    gate = await evaluateProjectTrustGate(cwd, {
      nonInteractive: true,
      ...(options?.trustStorePath !== undefined
        ? { storePath: options.trustStorePath }
        : {}),
    })
  } catch {
    gate = undefined
  }
  if (!gate || !gate.trusted) {
    // Untrusted (or gate error): GLOBAL skills only — the operator's own
    // ~/.claude/skills and ~/.agents/skills — never the project directories,
    // which are the cloned repository's surface. Same later-override order
    // the SDK applies (Claude-compatible first, SavantCode second).
    const home = os.homedir()
    const globalSkills: SkillsMap = {}
    for (const globalDir of [
      path.join(home, '.claude', SKILLS_DIR_NAME),
      path.join(home, '.agents', SKILLS_DIR_NAME),
    ]) {
      const dirSkills = await sdkLoadSkills({
        skillsPath: globalDir,
        verbose: false,
      })
      Object.assign(globalSkills, dirSkills)
    }
    skillsCache = globalSkills
    logger.warn(
      {
        directory: cwd,
        ...(gate
          ? { source: gate.resolution.source }
          : { source: 'gate-error' }),
      },
      'Workspace skills not loaded: project is not trusted (global skills only)',
    )
    return
  }

  try {
    // Load skills from both global (~/.agents/skills) and project directories
    // The SDK handles merging, with project skills overriding global ones
    skillsCache = await sdkLoadSkills({
      cwd,
      verbose: false,
    })
  } catch (error) {
    logger.warn({ error }, 'Failed to load skills')
    skillsCache = {}
  }
}

// ============================================================================
// Skills access
// ============================================================================

/**
 * Get all loaded skills.
 */
export function getLoadedSkills(): SkillsMap {
  return skillsCache
}

/**
 * Get a skill by name.
 */
export function getSkillByName(name: string): SkillDefinition | undefined {
  return skillsCache[name]
}

/**
 * Get the number of loaded skills.
 */
export function getSkillCount(): number {
  return Object.keys(skillsCache).length
}

// ============================================================================
// UI/Display utilities
// ============================================================================

/**
 * Get a message describing loaded skills for display.
 */
export function getLoadedSkillsMessage(): string | null {
  const skills = Object.values(skillsCache)

  if (skills.length === 0) {
    return null
  }

  const header = `Loaded ${skills.length} skill${skills.length === 1 ? '' : 's'}`
  const skillList = skills
    .map(
      (skill) =>
        `  - ${skill.name}: ${skill.description.slice(0, 60)}${skill.description.length > 60 ? '...' : ''}`,
    )
    .join('\n')

  return `${header}\n${skillList}`
}

// ============================================================================
// Testing utilities
// ============================================================================

/**
 * Clear cached skills. Intended for test scenarios.
 */
export function __resetSkillRegistryForTests(): void {
  skillsCache = {}
}
