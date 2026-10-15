import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  SKILLS_DIR_NAME,
  SKILL_FILE_NAME,
  isValidSkillName,
} from '@savant-code/common/constants/skills'
import {
  SkillFrontmatterSchema,
  type SkillDefinition,
} from '@savant-code/common/types/skill'
import { jsonToolResult } from '@savant-code/common/util/messages'
import { validateReferencePath } from '@savant-code/common/util/skill-management'
import matter from 'gray-matter'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { ProjectFileContext } from '@savant-code/common/util/file'

/**
 * Dynamically load a single skill from disk.
 * Used when a skill is not found in the pre-loaded cache but may have been created during the session.
 */
async function loadSkillFromDisk(
  projectRoot: string,
  skillName: string,
): Promise<SkillDefinition | null> {
  // FID-2026-0824-012: defense in depth — reject anything that is not a
  // valid skill name BEFORE touching disk. This excludes `.quarantine` (which
  // fails the regex) and any path-traversal spelling; quarantined drafts are
  // invisible until an operator runs `skills trust`.
  if (!isValidSkillName(skillName)) {
    return null
  }

  const home = os.homedir()
  const skillsDirs = [
    // Global directories first
    path.join(home, '.agents', SKILLS_DIR_NAME),
    path.join(home, '.claude', SKILLS_DIR_NAME),
    // Project directories (later takes precedence for overwriting)
    path.join(projectRoot, '.agents', SKILLS_DIR_NAME),
    path.join(projectRoot, '.claude', SKILLS_DIR_NAME),
  ]

  for (const skillsDir of skillsDirs) {
    const skillDir = path.join(skillsDir, skillName)
    const skillFilePath = path.join(skillDir, SKILL_FILE_NAME)

    try {
      // Check if the skill directory and file exist
      const stat = fs.statSync(skillDir)
      if (!stat.isDirectory()) continue

      fs.statSync(skillFilePath) // Will throw if file doesn't exist

      // Read and parse the skill file
      const content = fs.readFileSync(skillFilePath, 'utf8')
      const parsed = matter(content)

      if (!parsed.data || Object.keys(parsed.data).length === 0) {
        continue
      }

      // Validate frontmatter
      const result = SkillFrontmatterSchema.safeParse(parsed.data)
      if (!result.success) {
        continue
      }

      const frontmatter = result.data

      // Verify name matches directory name
      if (frontmatter.name !== skillName) {
        continue
      }

      return {
        name: frontmatter.name,
        description: frontmatter.description,
        content,
        license: frontmatter.license,
        filePath: skillFilePath,
        metadata: frontmatter.metadata,
      }
    } catch {
      // Skill doesn't exist in this directory, try the next one
      continue
    }
  }

  return null
}

type ToolName = 'skill'

/**
 * FID-2026-0824-012 S0-D — progressive disclosure Level-2 load: resolve a
 * `references/<relPath>` sub-file of a skill and return its content. Path is
 * validated against traversal before any disk access; a missing/invalid file
 * fails with an explicit message, never a raw error.
 */
function loadReferenceFile(skillDir: string, relPath: string): string | null {
  const invalid = validateReferencePath(relPath)
  if (invalid) return null
  const file = path.join(skillDir, 'references', relPath)
  if (!fs.existsSync(file)) return null
  return fs.readFileSync(file, 'utf8')
}

export const handleSkill = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<ToolName>
  fileContext: ProjectFileContext
}): Promise<{ output: SavantCodeToolOutput<ToolName> }> => {
  const { previousToolCallFinished, toolCall, fileContext } = params
  const { name, path: relPath } = toolCall.input

  await previousToolCallFinished

  const skills = fileContext.skills ?? {}

  // Always prefer the on-disk copy so skills installed or updated during the
  // session (e.g. via `npx skills add`) are picked up with their latest
  // contents. Fall back to the cache pre-loaded at session start.
  const diskSkill = fileContext.projectRoot
    ? await loadSkillFromDisk(fileContext.projectRoot, name)
    : null

  const skill = diskSkill ?? skills[name]

  // Progressive disclosure: a `path` asks for a references/ sub-file. The
  // core SKILL.md stays Level 0/1 (name + description in listings); bulk
  // procedural data is loaded only when explicitly queried.
  if (relPath !== undefined) {
    if (!skill) {
      return {
        output: jsonToolResult({
          name,
          description: '',
          content: `Error: Skill '${name}' not found (cannot resolve references path '${relPath}').`,
        }),
      }
    }
    const skillDir = path.dirname(skill.filePath)
    const referenceContent = loadReferenceFile(skillDir, relPath)
    if (referenceContent === null) {
      return {
        output: jsonToolResult({
          name,
          description: skill.description,
          content: `Error: references/'${relPath}' not found for skill '${name}'. Available paths can be discovered from the skill's SKILL.md content.`,
        }),
      }
    }
    return {
      output: jsonToolResult({
        name,
        description: skill.description,
        content: referenceContent,
      }),
    }
  }

  if (!skill) {
    const availableSkills = Object.keys(skills)
    const suggestion =
      availableSkills.length > 0
        ? ` Available skills: ${availableSkills.join(', ')}. You can also load skills created during this session by name.`
        : ' No skills are currently available. You can load skills created during this session by name.'

    return {
      output: jsonToolResult({
        name,
        description: '',
        content: `Error: Skill '${name}' not found.${suggestion}`,
      }),
    }
  }

  const result: {
    name: string
    description: string
    content: string
    license?: string
  } = {
    name: skill.name,
    description: skill.description,
    content: skill.content,
  }
  if (skill.license) {
    result.license = skill.license
  }

  return {
    output: jsonToolResult(result),
  }
}) satisfies SavantCodeToolHandlerFunction<ToolName>
