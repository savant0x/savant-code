import { z } from 'zod/v4'

import {
  SKILL_NAME_MAX_LENGTH,
  SKILL_NAME_REGEX,
  SKILL_DESCRIPTION_MAX_LENGTH,
  SKILL_VERSION_MAX_LENGTH,
  SKILL_VERSION_REGEX,
} from '../constants/skills'

/**
 * Zod schema for skill frontmatter metadata.
 */
export const SkillMetadataSchema = z.record(z.string(), z.string())

/**
 * Zod schema for skill frontmatter (parsed from YAML).
 */
export const SkillFrontmatterSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(SKILL_NAME_MAX_LENGTH)
    .regex(
      SKILL_NAME_REGEX,
      'Name must be lowercase alphanumeric with single hyphen separators',
    ),
  description: z.string().min(1).max(SKILL_DESCRIPTION_MAX_LENGTH),
  license: z.string().optional(),
  metadata: SkillMetadataSchema.optional(),
  // FID-2026-0824-012 internal versioning: semver string; legacy skills
  // without it default to 0.1.0 at load/manage time.
  version: z
    .string()
    .max(SKILL_VERSION_MAX_LENGTH)
    .regex(SKILL_VERSION_REGEX, 'Version must be semantic (e.g. 0.1.0)')
    .optional(),
  // FID-2026-0824-012: immutable skills may never be mutated by an agent
  // (skill_manage + pre-write gate reject all mutations). Operator file edits
  // remain allowed.
  immutable: z.boolean().optional(),
})

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>

/**
 * Full skill definition including content and source path.
 */
export const SkillDefinitionSchema = z.object({
  /** Skill name (must match directory name) */
  name: z.string(),
  /** Short description for agent discovery */
  description: z.string(),
  /** Optional license */
  license: z.string().optional(),
  /** Optional key-value metadata */
  metadata: SkillMetadataSchema.optional(),
  /** Optional semantic version (FID-2026-0824-012). */
  version: z.string().optional(),
  /** Optional immutability flag (FID-2026-0824-012). */
  immutable: z.boolean().optional(),
  /** Full SKILL.md content (including frontmatter) */
  content: z.string(),
  /** Source file path */
  filePath: z.string(),
})

export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>

/**
 * Collection of skills keyed by skill name.
 */
export type SkillsMap = Record<string, SkillDefinition>
