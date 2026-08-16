import fs from 'node:fs'
import path from 'node:path'

const EXCLUDED_DIRS = new Set([
  '.git',
  '.savant',
  'node_modules',
  'resources',
  'cli/bin',
  'dev/fids',
  'dev/session-summaries',
  'dev/scratchpad',
  'dev/nova',
  'dev/test-prompts',
])

const EXCLUDED_FILES = [
  /^bun\.lock$/,
  /^CHANGELOG\.md$/,
  /^dev\/quality-baseline\.json$/,
  /^docs\/release-notes-.*\.md$/,
  /\.generated\.(ts|tsx)$/,
  /^sdk\/test\/.*\/package-lock\.json$/,
]

/** Files outside the historical-record exclusion set that still reference a version. */
export function findVersionReferences(root: string, version: string): string[] {
  const hits: string[] = []
  const visit = (directory: string, relative: string): void => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(rel) || EXCLUDED_DIRS.has(entry.name)) continue
        visit(path.join(directory, entry.name), rel)
        continue
      }
      if (EXCLUDED_FILES.some((pattern) => pattern.test(rel))) continue
      const content = fs.readFileSync(path.join(directory, entry.name), 'utf8')
      if (content.includes(version)) hits.push(rel)
    }
  }
  visit(root, '')
  return hits.sort()
}

/**
 * Update the opt-in soft documentation surfaces (README badges, docs version
 * notes, ARCHITECTURE pending note, and the CHANGELOG in-development header).
 * Returns the relative paths that changed.
 */
export function updateDocSurfaces(
  root: string,
  oldVersion: string,
  newVersion: string,
): string[] {
  const changed: string[] = []
  const replace = (rel: string, from: string, to: string): void => {
    const filePath = path.join(root, rel)
    const content = fs.readFileSync(filePath, 'utf8')
    if (!content.includes(from)) return
    fs.writeFileSync(filePath, content.replace(from, to))
    changed.push(rel)
  }

  replace(
    'README.md',
    `**v${oldVersion} (pending, unreleased)**`,
    `**v${newVersion} (pending, unreleased)**`,
  )
  replace(
    'README.zh-CN.md',
    `**v${oldVersion}（待发布，未发布）**`,
    `**v${newVersion}（待发布，未发布）**`,
  )
  replace(
    'docs/sdk-overview.md',
    `| Version | \`${oldVersion}\` |`,
    `| Version | \`${newVersion}\` |`,
  )
  replace(
    'docs/privacy.md',
    `> **Version:** v${oldVersion} (pending, unreleased)`,
    `> **Version:** v${newVersion} (pending, unreleased)`,
  )
  replace(
    'ARCHITECTURE.md',
    `(${oldVersion} pending)`,
    `(${newVersion} pending)`,
  )

  // docs/SAVANT-VERSIONING.md: pending target advances, and the prior version
  // becomes the latest published release.
  {
    const versioningPath = path.join(root, 'docs', 'SAVANT-VERSIONING.md')
    const before = fs.readFileSync(versioningPath, 'utf8')
    const after = before
      .replace(`\`${oldVersion}\` (unreleased`, `\`${newVersion}\` (unreleased`)
      .replace(
        /latest published release is `[^`]+`/,
        `latest published release is \`${oldVersion}\``,
      )
    if (after !== before) {
      fs.writeFileSync(versioningPath, after)
      changed.push('docs/SAVANT-VERSIONING.md')
    }
  }

  const changelogPath = path.join(root, 'CHANGELOG.md')
  const changelog = fs.readFileSync(changelogPath, 'utf8')
  const header = `## ${newVersion} — in development (unreleased)`
  if (!changelog.includes(header)) {
    fs.writeFileSync(
      changelogPath,
      changelog.replace(/^# Changelog\n/, `# Changelog\n\n${header}\n`),
    )
    changed.push('CHANGELOG.md')
  }

  return changed
}
