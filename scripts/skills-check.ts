/**
 * skills:check — FID-2026-0824-012 S0-C mechanical skill validator.
 *
 * Scans every SKILL.md under the project + home skill directories (both
 * `.agents/skills/` and `.claude/skills/`, including `.quarantine/` drafts
 * which are invisible to the runtime loader) and validates:
 *
 *  1. frontmatter parses + passes SkillFrontmatterSchema and name === dir
 *  2. description policy: 1024 chars hand-written; 60 chars agent-authored
 *     (identified by `metadata.origin: agent` or living under `.quarantine/`)
 *  3. section order for agent-authored: When to Use → Procedure → Pitfalls →
 *     Verification (all four required, in order)
 *  4. command allowlist: dangerous shell patterns always fail; agent-authored
 *     inline-code command words must resolve against the allowlist
 *     (mirrors the FID-2026-0823-009 argv-allowlist precedent — unknown
 *     commands fail validation, never execute)
 *  5. 300-line file ceiling (repo quality policy)
 *  6. `version` presence (error for agent-authored, warning for hand-written
 *     legacy skills — the loader defaults them to 0.1.0)
 *
 * Exit code 0 = no errors (warnings allowed); exit 1 = at least one error.
 * Run via `bun run skills:check`.
 */

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import matter from 'gray-matter'

import {
  AGENT_AUTHORED_DESCRIPTION_MAX_LENGTH,
  isValidSkillName,
  SKILL_DESCRIPTION_MAX_LENGTH,
  SKILL_FILE_NAME,
  SKILL_MAX_FILE_LINES,
  SKILL_NAME_REGEX,
} from '@savant-code/common/constants/skills'
import { SkillFrontmatterSchema } from '@savant-code/common/types/skill'

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

/** Shell patterns that always fail validation (any skill, any origin). */
const BLOCKLIST_PATTERNS: RegExp[] = [
  /\brm\s+-rf\b/,
  /\bsudo\b/,
  /\bcurl\b[^\n|]*\|\s*(ba)?sh\b/,
  /\bwget\b[^\n|]*\|\s*(ba)?sh\b/,
  /\bbase64\s+-d\b/,
  /\bchmod\s+\+x\s+\/tmp\b/,
  /\beval\s+/,
  /`\s*\$/,
  /\bssh\s+\S+@/,
]

/**
 * Allowlisted command words for agent-authored skills: known-safe binaries
 * plus Savant tool names. Anything else that looks like a CLI invocation
 * fails validation for agent-authored skills.
 */
const COMMAND_ALLOWLIST = new Set([
  // Savant tool names
  'read_files',
  'read_subtree',
  'read_url',
  'read_docs',
  'code_search',
  'glob',
  'list_directory',
  'find_files',
  'write_file',
  'str_replace',
  'apply_patch',
  'run_terminal_command',
  'run_readonly_command',
  'web_search',
  'spawn_agents',
  'skill',
  'skill_manage',
  'ask_user',
  'end_turn',
  'set_output',
  'write_todos',
  'transition_phase',
  'think_deeply',
  'sequentialthinking',
  'update_goal',
  'get_goal',
  // Known-safe CLI binaries
  'bun',
  'bunx',
  'node',
  'npm',
  'npx',
  'git',
  'ls',
  'cat',
  'grep',
  'rg',
  'sed',
  'awk',
  'jq',
  'find',
  'sort',
  'head',
  'tail',
  'wc',
  'date',
  'pwd',
  'which',
  'uname',
  'echo',
  'mkdir',
  'cp',
  'mv',
  'rm',
  'touch',
  'curl',
  'wget',
  'python',
  'python3',
  'cargo',
  'rustc',
  'tsc',
  'docker',
  'mkdirp',
])

/** Required sections, in order, for agent-authored skills. */
const REQUIRED_SECTIONS = [
  'When to Use',
  'Procedure',
  'Pitfalls',
  'Verification',
] as const

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

/** Extract the first command word from an inline-code span, if it looks like a CLI invocation. */
function extractCommandWords(text: string): string[] {
  const words: string[] = []
  const spans = text.match(/`([^`]+)`/g) ?? []
  for (const span of spans) {
    const code = span.slice(1, -1).trim()
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

/** Discover skill dirs: valid-name entries + `.quarantine/` drafts. */
export function discoverSkillDirs(skillsDir: string): {
  entry: string
  dir: string
  quarantined: boolean
}[] {
  const result: { entry: string; dir: string; quarantined: boolean }[] = []
  let entries: string[]
  try {
    entries = fs.readdirSync(skillsDir)
  } catch {
    return result
  }
  for (const entry of entries) {
    if (entry === '.quarantine') {
      const quarantineDir = path.join(skillsDir, entry)
      let drafts: string[]
      try {
        drafts = fs.readdirSync(quarantineDir)
      } catch {
        continue
      }
      for (const draft of drafts) {
        const draftDir = path.join(quarantineDir, draft)
        if (fs.statSync(draftDir).isDirectory()) {
          result.push({ entry: draft, dir: draftDir, quarantined: true })
        }
      }
      continue
    }
    if (!isValidSkillName(entry)) continue
    const dir = path.join(skillsDir, entry)
    let stat
    try {
      stat = fs.statSync(dir)
    } catch {
      continue
    }
    if (stat.isDirectory()) result.push({ entry, dir, quarantined: false })
  }
  return result
}

/** The four default skill-directory roots (later overrides earlier is loader
 *  semantics; the checker validates every copy it finds). */
export function getDefaultSkillsRoots(cwd: string): string[] {
  const home = os.homedir()
  return [
    path.join(home, '.claude', 'skills'),
    path.join(home, '.agents', 'skills'),
    path.join(cwd, '.claude', 'skills'),
    path.join(cwd, '.agents', 'skills'),
  ]
}

/** Check every skill under a single root. */
export function checkSkillsRoot(root: string): SkillCheckResult[] {
  const results: SkillCheckResult[] = []
  for (const { entry, dir, quarantined } of discoverSkillDirs(root)) {
    const filePath = path.join(dir, SKILL_FILE_NAME)
    let content: string
    try {
      content = fs.readFileSync(filePath, 'utf8')
    } catch {
      results.push({
        entry,
        file: filePath,
        quarantined,
        findings: [
          {
            severity: 'error',
            rule: 'missing',
            message: `${filePath}: SKILL.md not found`,
          },
        ],
      })
      continue
    }
    results.push({
      entry,
      file: filePath,
      quarantined,
      findings: checkSkillContent({ entry, filePath, content, quarantined }),
    })
  }
  return results
}

/** Full repo check: every default root, deduped by file path. */
export function checkAllSkills(cwd: string): SkillCheckResult[] {
  const seen = new Set<string>()
  const results: SkillCheckResult[] = []
  for (const root of getDefaultSkillsRoots(cwd)) {
    for (const result of checkSkillsRoot(root)) {
      const key = path.resolve(result.file)
      if (seen.has(key)) continue
      seen.add(key)
      results.push(result)
    }
  }
  return results
}

/** Run from CLI: `bun run skills:check`. */
function main(): void {
  const cwd = process.cwd()
  const results = checkAllSkills(cwd)
  let errors = 0
  let warnings = 0
  // FID-2026-0824-012: as a REPO gate, only project-scoped skills can fail
  // the build. Home-directory skills (~/.claude/skills, ~/.agents/skills)
  // belong to the operator — their findings print (advisory) but never fail
  // CI or a fresh clone where they do not exist.
  const projectRoot = path.resolve(cwd)
  for (const result of results) {
    if (result.findings.length === 0) continue
    const tag = result.quarantined ? ' [quarantine]' : ''
    const isProjectScoped = path.resolve(result.file).startsWith(projectRoot)
    for (const finding of result.findings) {
      if (finding.severity === 'error') {
        if (isProjectScoped) errors++
        else warnings++
      } else {
        warnings++
      }
      const level = finding.severity === 'error' ? '✗' : '⚠'
      console.log(
        `${level} ${finding.rule}${tag}${isProjectScoped ? '' : ' (home)'}: ${finding.message}`,
      )
    }
  }
  console.log(
    `skills:check: ${results.length} skill(s) scanned · ${errors} error(s) · ${warnings} warning(s)`,
  )
  process.exit(errors > 0 ? 1 : 0)
}

if (import.meta.main) {
  main()
}
