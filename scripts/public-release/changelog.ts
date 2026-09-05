// FID-2026-0905-007 — public-release decomposition: changelog + version utils.
//
// CHANGELOG section extraction, version comparison/validation, and tool
// version gating. Verbatim moves from scripts/public-release.ts.

import { fail } from './fail'

export function extractChangelogSection(
  changelog: string,
  version: string,
): string {
  const headingPattern = /^##\s+(?:\[)?v?(\d+\.\d+\.\d+)(?:\]|\s|$)(.*)$/gm
  const headings: Array<{
    version: string
    start: number
    date?: string
  }> = []
  for (const match of changelog.matchAll(headingPattern)) {
    const headingVersion = match[1]
    if (!headingVersion) continue
    const headingDate = match[2]?.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1]
    headings.push({
      version: headingVersion,
      start: match.index ?? 0,
      date: headingDate,
    })
  }

  for (let index = 1; index < headings.length; index += 1) {
    const previous = headings[index - 1]
    const currentHeading = headings[index]
    const isOutOfOrder =
      previous.date && currentHeading.date
        ? previous.date < currentHeading.date
        : compareVersions(previous.version, currentHeading.version) < 0
    if (isOutOfOrder) {
      fail('CHANGELOG.md headings must be reverse-chronological.')
    }
  }

  const matches = headings.filter((heading) => heading.version === version)
  if (matches.length !== 1) {
    fail(
      `CHANGELOG.md must contain exactly one heading for v${version}; found ${matches.length}.`,
    )
  }

  const current = matches[0]
  const nextHeading = headings.find((heading) => heading.start > current.start)
  const section = changelog
    .slice(current.start, nextHeading?.start ?? changelog.length)
    .trim()
  if (!section) fail(`CHANGELOG.md section for v${version} is empty.`)
  return section
}

export function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    }
  }
  return 0
}

export function validateReleaseVersions(
  version: string,
  files: Record<string, string>,
): void {
  for (const [filePath, content] of Object.entries(files)) {
    const parsed = JSON.parse(content) as { version?: unknown }
    if (parsed.version !== version) {
      fail(`${filePath} is ${String(parsed.version)}; expected ${version}.`)
    }
  }
}
