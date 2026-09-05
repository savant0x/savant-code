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
 *
 * Decomposition: the policy data (blocklist/allowlist/sections) lives in
 * `skills-check-policy.ts`, the per-file content validation in
 * `skills-check-content.ts`; this module keeps discovery, root walking,
 * dedupe, and the CLI entrypoint. Public functions are re-exported so the
 * `./skills-check` import surface is unchanged.
 */

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  isValidSkillName,
  SKILL_FILE_NAME,
} from '@savant-code/common/constants/skills'

import {
  checkSkillContent,
  type SkillCheckResult,
} from './skills-check-content'

export { checkSkillContent, isAgentAuthored } from './skills-check-content'
export type {
  SkillCheckFinding,
  SkillCheckResult,
} from './skills-check-content'

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
