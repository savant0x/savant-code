import fs from 'node:fs'
import path from 'node:path'

// FID-2026-1010-004: the callout helpers moved to their own module when this
// file crossed the 300-line ceiling. They have no other importers (verified by
// grep).
import {
  findNewestChangelogCallout,
  findReleaseCalloutBlock,
  syncReleaseCallouts,
  withoutCarriageReturns,
} from './version-callouts'

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
 * notes, ARCHITECTURE current-state note, and the CHANGELOG in-development header).
 * Returns the relative paths that changed.
 */
export function updateDocSurfaces(
  root: string,
  oldVersion: string,
  newVersion: string,
  today: string = todayIso(),
): string[] {
  const changed: string[] = []
  const replace = (rel: string, from: string, to: string): void => {
    const filePath = path.join(root, rel)
    const content = fs.readFileSync(filePath, 'utf8')
    if (!content.includes(from)) return
    fs.writeFileSync(filePath, content.replaceAll(from, to))
    changed.push(rel)
  }

  replace('README.md', `Release-v${oldVersion}-`, `Release-v${newVersion}-`)
  replace(
    'README.zh-CN.md',
    `Release-v${oldVersion}-`,
    `Release-v${newVersion}-`,
  )

  // FID-2026-0919-023: version *statements* are converged from the same table
  // the drift check reads, and from whatever version the surface currently
  // states — not just from `oldVersion`. The old exact-string form advanced a
  // surface only when it sat exactly one release behind, so a surface that fell
  // behind once stayed behind forever, invisibly (ARCHITECTURE.md had been
  // stating 0.0.26 through seven bumps). The localized README blurb was never
  // declared at all and drifted the same way.
  for (const surface of DOC_VERSION_SURFACES) {
    const filePath = path.join(root, surface.file)
    let content: string
    try {
      content = fs.readFileSync(filePath, 'utf8')
    } catch {
      continue
    }
    const match = content.match(surface.pattern)
    const stated = match?.[1]
    if (!match || !stated || stated === newVersion) continue
    fs.writeFileSync(
      filePath,
      content.replace(surface.pattern, (whole) =>
        whole.replace(stated, newVersion),
      ),
    )
    changed.push(surface.file)
  }

  const changelogPath = path.join(root, 'CHANGELOG.md')
  const changelog = fs.readFileSync(changelogPath, 'utf8')
  // Operator ruling (2026-09-18): NO unreleased accumulators. Bump time OPENS
  // the dated version heading (the format extractChangelogSection requires);
  // release notes accumulate beneath it and the release ships it as-is.
  const header = `## ${newVersion} — ${today}`
  if (!changelog.includes(`## ${newVersion}`)) {
    fs.writeFileSync(
      changelogPath,
      changelog.replace(/^# Changelog\n/, `# Changelog\n\n${header}\n`),
    )
    changed.push('CHANGELOG.md')
  }

  // T94 (operator ruling 2026-10-03: "it's part of the release script system"):
  // the release-script system owns the whole callout, label AND body — the
  // CHANGELOG's newest released section is the prose owner and the README
  // mirrors it. At bump time the new section is empty, so this is a no-op;
  // whenever the CHANGELOG callout and the README callout disagree, the README
  // is converged here, and `version:check` fails closed until it is.
  changed.push(...syncReleaseCallouts(root))

  return [...new Set(changed)]
}

/** A document surface that states the product version in prose or a badge. */
export type DocVersionSurface = {
  file: string
  /** Regex whose first capture group is the version the surface states. */
  pattern: RegExp
  /** Remedy for the surface — surfaced by version:check. */
  hint?: string
}

/**
 * FID-2026-0919-023: the documented version surfaces, as a checked contract.
 * `updateDocSurfaces` updates the ones it knows; this table is what makes an
 * unknown/missed surface *reported* instead of silently skipped (the desktop
 * precedent in version.ts). `version:check` fails on any drift listed below.
 */
export const DOC_VERSION_SURFACES: DocVersionSurface[] = [
  {
    file: 'README.md',
    pattern: /^> \*\*v(\d+\.\d+\.\d+)\*\* —/m,
    hint: 'release-blurb label',
  },
  {
    file: 'README.zh-CN.md',
    pattern: /^> \*\*v(\d+\.\d+\.\d+)\*\* ——/m,
    hint: 'localized release-blurb label',
  },
  {
    file: 'docs/sdk-overview.md',
    pattern: /\| Version \| `(\d+\.\d+\.\d+)` \|/,
  },
  {
    file: 'docs/privacy.md',
    pattern: /> \*\*Version:\*\* v(\d+\.\d+\.\d+)/,
  },
  {
    file: 'ARCHITECTURE.md',
    pattern: /at version `(\d+\.\d+\.\d+)`/,
  },
  {
    file: 'docs/SAVANT-VERSIONING.md',
    pattern: /\*\*Current release:\*\* Savant-Code `(\d+\.\d+\.\d+)`\./,
  },
]

/**
 * Doc surfaces whose stated version differs from the product version. A missing
 * file or an unmatched pattern is drift with an `undefined` version — never a
 * silent pass.
 */
export function collectDocVersionDrift(
  root: string,
  product: string,
): Array<{ file: string; version: string | undefined; hint?: string }> {
  const drift: Array<{
    file: string
    version: string | undefined
    hint?: string
  }> = []
  for (const surface of DOC_VERSION_SURFACES) {
    let content: string
    try {
      content = fs.readFileSync(path.join(root, surface.file), 'utf8')
    } catch {
      drift.push({ file: surface.file, version: undefined, hint: surface.hint })
      continue
    }
    const version = content.match(surface.pattern)?.[1]
    if (version !== product) {
      drift.push({ file: surface.file, version, hint: surface.hint })
    }
  }

  // T94: the README release-callout BODY is owned by the CHANGELOG — the
  // newest released section's callout is what the README must mirror. Both
  // sides must exist before the comparison means anything (a fresh repo with
  // no release section, or a README with no callout, has nothing to drift).
  try {
    const owner = findNewestChangelogCallout(
      fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'),
    )
    const mirror = findReleaseCalloutBlock(
      fs.readFileSync(path.join(root, 'README.md'), 'utf8'),
    )
    if (
      owner &&
      mirror &&
      withoutCarriageReturns(owner.block) !==
        withoutCarriageReturns(mirror.block)
    ) {
      drift.push({
        file: 'README.md',
        version: mirror.version,
        hint: 'release-callout body — sync from the CHANGELOG section (updateDocSurfaces)',
      })
    }
  } catch {
    // A missing CHANGELOG/README surface is reported by the loop above.
  }
  return drift
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
