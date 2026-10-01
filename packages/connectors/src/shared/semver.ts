/**
 * Minimal semver compare — replaces `@std/semver` (port deviation,
 * PORT-NOTES.md "Substitutions"). Only the three operations upstream uses
 * survive: `parseSemver`, `greaterThan`, `format`. Semver ordering per
 * semver.org spec §11: numeric fields, then prerelease precedence (no
 * prerelease > prerelease; identifier compare numeric-vs-numeric,
 * otherwise ASCII; a longer prerelease with an equal prefix is GREATER).
 * Build metadata (+…) is ignored for precedence, tolerated in input.
 */

export interface SemVer {
  major: number
  minor: number
  patch: number
  /** Prerelease identifiers, dot-split (empty = release). */
  pre: string[]
}

const Z_SEMVER =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

/** Parse a strict `MAJOR.MINOR.PATCH[-pre][+build]` string. Throws on malformed input — callers pass compiler-validated versions. */
export function parseSemver(input: string): SemVer {
  const match = Z_SEMVER.exec(input)
  if (!match) {
    throw new Error(`malformed semver: "${input}"`)
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] === undefined ? [] : match[4].split('.'),
  }
}

/** semver.org §11 precedence: is `a` strictly greater than `b`? */
export function greaterThan(a: SemVer, b: SemVer): boolean {
  if (a.major !== b.major) return a.major > b.major
  if (a.minor !== b.minor) return a.minor > b.minor
  if (a.patch !== b.patch) return a.patch > b.patch
  return comparePre(a.pre, b.pre) > 0
}

function comparePre(a: readonly string[], b: readonly string[]): number {
  // a release outranks any prerelease of the same triple
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1
  if (b.length === 0) return -1
  const shared = Math.min(a.length, b.length)
  for (let i = 0; i < shared; i++) {
    const x = a[i]
    const y = b[i]
    if (x === undefined || y === undefined) break
    if (x === y) continue
    const xNum = /^\d+$/.test(x)
    const yNum = /^\d+$/.test(y)
    if (xNum && yNum) return Number(x) > Number(y) ? 1 : -1
    // numeric identifiers always have lower precedence than alphanumeric
    if (xNum) return -1
    if (yNum) return 1
    return x > y ? 1 : -1
  }
  // equal prefix: the longer prerelease is greater
  return a.length > b.length ? 1 : -1
}

/** Format back to `MAJOR.MINOR.PATCH[-pre]` (build metadata is dropped). */
export function format(version: SemVer): string {
  const base = `${version.major}.${version.minor}.${version.patch}`
  return version.pre.length > 0 ? `${base}-${version.pre.join('.')}` : base
}

/** Upstream-compatible alias — ports `import { parse as parseSemver }`. */
export { parseSemver as parse }
