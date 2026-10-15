/**
 * Skills constants and validation rules.
 *
 * Skills are SKILL.md files with YAML frontmatter that define reusable
 * instructions that agents can load on-demand via the skill tool.
 */

/**
 * The directory name where skills are stored (within .agents/).
 */
export const SKILLS_DIR_NAME = 'skills'

/**
 * FID-2026-0824-012 — quarantine directory for agent-authored/patched skills
 * awaiting operator trust. Explicitly excluded by the loader AND the `skill`
 * tool's disk lookup (defense in depth, not regex reliance) — entries there
 * are never discoverable or loadable until `skills trust` migrates them out.
 */
export const QUARANTINE_DIR_NAME = '.quarantine'

/**
 * The file name for skill definitions.
 */
export const SKILL_FILE_NAME = 'SKILL.md'

/**
 * Validation regex for skill names.
 * - 1-64 characters
 * - Lowercase alphanumeric with single hyphen separators
 * - Cannot start or end with hyphen
 * - No consecutive hyphens
 */
export const SKILL_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * Maximum length for skill name.
 */
export const SKILL_NAME_MAX_LENGTH = 64

/**
 * Maximum length for skill description.
 */
export const SKILL_DESCRIPTION_MAX_LENGTH = 1024

/**
 * Stricter description ceiling for agent-authored skills (FID-2026-0824-012,
 * Hermes house-standard parity). Hand-written skills keep the 1024 limit.
 */
export const AGENT_AUTHORED_DESCRIPTION_MAX_LENGTH = 60

/**
 * Semantic-version pattern for the `version` frontmatter field
 * (FID-2026-0824-012 internal versioning).
 */
export const SKILL_VERSION_REGEX = /^\d+\.\d+\.\d+$/

/** Maximum length for the `version` string. */
export const SKILL_VERSION_MAX_LENGTH = 32

/**
 * Absolute file-line ceiling for skill documents (matches the repo quality
 * policy; enforced by skills:check).
 */
export const SKILL_MAX_FILE_LINES = 300

/**
 * Validates a skill name according to the naming rules.
 * @param name - The skill name to validate
 * @returns true if valid, false otherwise
 */
export function isValidSkillName(name: string): boolean {
  if (!name || name.length > SKILL_NAME_MAX_LENGTH) {
    return false
  }
  return SKILL_NAME_REGEX.test(name)
}

/**
 * Validates a skill description according to length rules.
 * @param description - The skill description to validate
 * @returns true if valid, false otherwise
 */
export function isValidSkillDescription(description: string): boolean {
  return (
    typeof description === 'string' &&
    description.length >= 1 &&
    description.length <= SKILL_DESCRIPTION_MAX_LENGTH
  )
}
