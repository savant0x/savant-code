// FID-2026-1010-004: the release-callout helpers, extracted verbatim from
// version-docs.ts after that file crossed the 300-line quality ceiling (the
// callout comparison learned to ignore CRLF, which pushed it over).
//
// The contract they implement (T94): the CHANGELOG's newest RELEASED section
// owns the callout prose, and the README mirrors it. `version:check` fails
// closed whenever the two disagree.
import fs from 'node:fs'
import path from 'node:path'

/** The README's release callout: the first contiguous `>` block opened by a `**vX.Y.Z** —` line. */
export function findReleaseCalloutBlock(
  content: string,
): { version: string; block: string } | undefined {
  const lines = content.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index]!.match(/^> \*\*v(\d+\.\d+\.\d+)\*\* —/)
    if (!match) continue
    let end = index
    while (end + 1 < lines.length && lines[end + 1]!.startsWith('>')) end += 1
    return {
      version: match[1]!,
      block: lines.slice(index, end + 1).join('\n'),
    }
  }
  return undefined
}

/**
 * The newest RELEASED CHANGELOG section's callout — the prose owner (T94).
 * The first `## <version> — <date>` heading in the reverse-chronological file
 * opens it; an `Unreleased` accumulation header is not a released section.
 */
export function findNewestChangelogCallout(
  changelog: string,
): { version: string; block: string } | undefined {
  const heading = changelog.match(/^## \d+\.\d+\.\d+ — /m)
  if (!heading || heading.index === undefined) return undefined
  return findReleaseCalloutBlock(changelog.slice(heading.index))
}

/**
 * Line endings are not content (FID-2026-1010-004). `.gitattributes` declares
 * `*.md text eol=lf`, but a Windows tool can leave the WORKING copy CRLF while
 * the committed blob stays LF — git only renormalizes the file on the next
 * touch. Comparing the blocks byte-for-byte made `version:check` fail for a
 * working tree whose prose was already correct, so the comparison runs on the
 * carriage-stripped form. Real content drift still fails loudly; only `\r`,
 * which git rewrites before it is ever committed, is ignored.
 */
export function withoutCarriageReturns(block: string): string {
  return block.replaceAll('\r', '')
}

/**
 * Copy the CHANGELOG's newest release callout over the README's release
 * callout. Idempotent; a no-op when either side has no callout yet or they
 * already agree. Returns the relative paths changed.
 */
export function syncReleaseCallouts(root: string): string[] {
  let changelog: string
  let readme: string
  try {
    changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
    readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8')
  } catch {
    return []
  }
  const owner = findNewestChangelogCallout(changelog)
  const mirror = findReleaseCalloutBlock(readme)
  if (
    !owner ||
    !mirror ||
    withoutCarriageReturns(owner.block) === withoutCarriageReturns(mirror.block)
  )
    return []
  fs.writeFileSync(readmePath(root), readme.replace(mirror.block, owner.block))
  return ['README.md']
}

function readmePath(root: string): string {
  return path.join(root, 'README.md')
}
