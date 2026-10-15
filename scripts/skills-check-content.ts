/**
 * skills:check content validation — the per-SKILL.md rule checks. Pure
 * functions over file content; filesystem discovery and CLI reporting live
 * in the parent module.
 */

import matter from 'gray-matter'

import {
  AGENT_AUTHORED_DESCRIPTION_MAX_LENGTH,
  SKILL_DESCRIPTION_MAX_LENGTH,
  SKILL_MAX_FILE_LINES,
  SKILL_NAME_REGEX,
} from '@savant-code/common/constants/skills'
import { SkillFrontmatterSchema } from '@savant-code/common/types/skill'

import {
  BLOCKLIST_PATTERNS,
  COMMAND_ALLOWLIST,
  REQUIRED_SECTIONS,
} from './skills-check-policy'

export type SkillCheckFinding = {
  severity: 'error' | 'warning'
  /** rule id, e.g. `frontmatter`, `description-length`, `section-order`. */
  rule: string
  message: string
}

export type SkillCheckResult = {
  /** Skill directory name (may be invalid). */
  entry: string
  /** Absolute path to the skill's SKILL.md (or dir when unreadable). */
  file: string
  /** Whether the skill is a quarantined draft. */
  quarantined: boolean
  findings: SkillCheckFinding[]
}

export function isAgentAuthored(
  frontmatter: Record<string, unknown>,
  quarantined: boolean,
): boolean {
  if (quarantined) return true
  const metadata = frontmatter.metadata
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const record = metadata as Record<string, unknown>
    return (
      record.origin === 'agent' ||
      record['origin'] === 'agent' ||
      record.agent === true
    )
  }
  return false
}

/**
 * A fenced code block: ``` or ~~~, 3+ chars, optional info string, closed by a
 * line repeating the same fence. Removed before inline spans are matched
 * (FID-2026-0928-001 RC1).
 */
const FENCED_BLOCK = /^([`~]{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm

/**
 * A run of 3+ backticks that survived fence stripping — i.e. one written
 * inline inside prose. A run of 3+ is never a valid *inline* delimiter (inline
 * spans use single backticks), but it is still an odd count that mispairs every
 * following span, so it is neutralised here (RC1, second form).
 */
const INLINE_BACKTICK_RUN = /`{3,}/g

/** A leading short lowercase token followed by at least one argument. */
const COMMAND_INVOCATION = /^[a-z][a-z0-9-]{1,30}\s+\S/

/**
 * A leading token followed by a `word:` label — a quoted `name: value` record
 * (e.g. `untrusted comment: rsign …`), not a shell line (RC2).
 */
const LABEL_VALUE_SPAN = /^[a-z][a-z0-9-]{1,30}\s+[A-Za-z][\w-]*:/

/**
 * Extract the first command word from an inline-code span, if it looks like a
 * CLI invocation.
 *
 * Fenced blocks — and any inline run of 3+ backticks — are stripped first. They
 * contain an odd number of backticks, so an inline-span regex pairs across the
 * boundary and mis-attributes every subsequent span: the fence's info string is
 * reported as a command, and real commands after the fence can be swallowed
 * entirely. A span is then only a candidate if it reads like an invocation — a
 * bare backticked word is prose, and a `label: value` span quotes file content.
 */
function extractCommandWords(text: string): string[] {
  const words: string[] = []
  const spans =
    text
      .replace(FENCED_BLOCK, '')
      .replace(INLINE_BACKTICK_RUN, '')
      .match(/`([^`]+)`/g) ?? []
  for (const span of spans) {
    const code = span.slice(1, -1).trim()
    if (!COMMAND_INVOCATION.test(code)) continue
    if (LABEL_VALUE_SPAN.test(code)) continue
    const first = code.split(/\s+/)[0]
    if (!first) continue
    // Looks like a CLI invocation: short lowercase alphanumeric/hyphen token.
    if (/^[a-z][a-z0-9-]{1,30}$/.test(first)) words.push(first)
  }
  return words
}

export function checkSkillContent(params: {
  entry: string
  filePath: string
  content: string
  quarantined: boolean
}): SkillCheckFinding[] {
  const { entry, filePath, content, quarantined } = params
  const findings: SkillCheckFinding[] = []

  const lines = content.split(/\r?\n/)
  if (lines.length > SKILL_MAX_FILE_LINES) {
    findings.push({
      severity: 'error',
      rule: 'line-ceiling',
      message: `${entry}: ${lines.length} lines exceeds the ${SKILL_MAX_FILE_LINES}-line ceiling`,
    })
  }

  let parsed: matter.GrayMatterFile<string>
  try {
    parsed = matter(content)
  } catch {
    findings.push({
      severity: 'error',
      rule: 'frontmatter',
      message: `${filePath}: YAML frontmatter failed to parse`,
    })
    return findings
  }

  if (!parsed.data || Object.keys(parsed.data).length === 0) {
    findings.push({
      severity: 'error',
      rule: 'frontmatter',
      message: `${filePath}: missing YAML frontmatter`,
    })
    return findings
  }

  const schemaResult = SkillFrontmatterSchema.safeParse(parsed.data)
  if (!schemaResult.success) {
    findings.push({
      severity: 'error',
      rule: 'frontmatter',
      message: `${filePath}: ${schemaResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
    })
    return findings
  }
  const frontmatter = schemaResult.data

  if (frontmatter.name !== entry) {
    findings.push({
      severity: 'error',
      rule: 'name-mismatch',
      message: `${filePath}: frontmatter name '${frontmatter.name}' does not match directory '${entry}'`,
    })
  }
  if (!SKILL_NAME_REGEX.test(frontmatter.name)) {
    findings.push({
      severity: 'error',
      rule: 'name-mismatch',
      message: `${filePath}: invalid skill name '${frontmatter.name}'`,
    })
  }

  const agent = isAgentAuthored(frontmatter, quarantined)

  // Description policy.
  const maxDescription = agent
    ? AGENT_AUTHORED_DESCRIPTION_MAX_LENGTH
    : SKILL_DESCRIPTION_MAX_LENGTH
  if (frontmatter.description.length > maxDescription) {
    findings.push({
      severity: 'error',
      rule: 'description-length',
      message: `${filePath}: description is ${frontmatter.description.length} chars (max ${maxDescription} for ${agent ? 'agent-authored' : 'hand-written'})`,
    })
  }

  // Version policy.
  if (!frontmatter.version) {
    findings.push({
      severity: agent ? 'error' : 'warning',
      rule: 'version',
      message: `${filePath}: missing 'version' frontmatter${agent ? '' : ' (legacy default 0.1.0; add it on the next edit)'}`,
    })
  }

  // Command allowlist.
  const body = parsed.content
  for (const pattern of BLOCKLIST_PATTERNS) {
    if (pattern.test(body)) {
      findings.push({
        severity: 'error',
        rule: 'command-blocklist',
        message: `${filePath}: dangerous shell pattern ${pattern} is not allowed in skill content`,
      })
    }
  }
  if (agent) {
    const words = extractCommandWords(body)
    for (const word of words) {
      if (!COMMAND_ALLOWLIST.has(word)) {
        findings.push({
          severity: 'error',
          rule: 'command-allowlist',
          message: `${filePath}: command '${word}' is not allowlisted for agent-authored skills (FID-2026-0824-012 S0-C)`,
        })
      }
    }
  }

  // Section order (agent-authored only).
  if (agent) {
    const headings = [...body.matchAll(/^##\s+(.+)$/gm)].map((match) =>
      match[1].trim(),
    )
    let lastIndex = -1
    for (const required of REQUIRED_SECTIONS) {
      const index = headings.indexOf(required)
      if (index === -1) {
        findings.push({
          severity: 'error',
          rule: 'section-order',
          message: `${filePath}: missing required section '## ${required}'`,
        })
        continue
      }
      if (index <= lastIndex) {
        findings.push({
          severity: 'error',
          rule: 'section-order',
          message: `${filePath}: section '## ${required}' is out of order (expected after ${REQUIRED_SECTIONS[REQUIRED_SECTIONS.indexOf(required) - 1] ?? 'start'})`,
        })
      }
      lastIndex = index
    }
  }

  return findings
}
