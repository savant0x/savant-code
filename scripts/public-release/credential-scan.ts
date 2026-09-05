// FID-2026-0905-007 — public-release decomposition: credential scan.
//
// The fail-closed scan of staged files + contents for credential shapes
// (filename patterns, PEM blocks, entropy-scored token patterns) before an
// automation-mode release commit is created. Verbatim moves from
// scripts/public-release.ts.

import { closeSync, existsSync, lstatSync, openSync, readSync } from 'fs'
import path from 'path'

import { run } from './command-runner'

const CREDENTIAL_FILE_PATTERNS = [
  /(?:^|\/)\.env(?:$|\.(?!example(?:\.[^.]+)?$))/i,
  /(?:^|\/)\.npmrc$/i,
  /(?:^|\/)id_rsa(?:\.pub)?$/i,
  /\.(?:pem|p12|pfx|key)$/i,
  /(?:^|\/)(?:credentials|secrets)(?:\.|\/|$)/i,
]

// Source-code carve-out: a file named credentials.ts / secrets.ts is an
// idiomatic module whose NAME alone proves nothing — its content is what
// matters, and the content scan below enforces that (token entropy, PEM
// blocks, AUTHORIZATION headers). Config-shaped files (credentials.json,
// secrets.yaml, .env, *.pem …) stay filename-blocked because those names
// denote actual secret stores.
const CREDENTIAL_SOURCE_NAME_PATTERN =
  /(?:^|\/)(?:credentials|secrets)(?:\.|$)/i
const SOURCE_CODE_EXTENSION_PATTERN = /\.(?:[cm]?[jt]sx?)$/i

function isCredentialNamedSourceFile(file: string): boolean {
  return (
    CREDENTIAL_SOURCE_NAME_PATTERN.test(file) &&
    SOURCE_CODE_EXTENSION_PATTERN.test(file)
  )
}

// Shannon entropy floor (bits/char) applied to captured token bodies, plus a
// minimum character-class count. This is the gitleaks-style discriminator:
// repeated characters (`AAAA…`) fail entropy, and sequential alphabets
// (`abcdefghijklmnopqrstuvwxyz0123456789`) fail the class count (lowercase +
// digits only) even though their entropy looks high. Real random tokens pass
// both, so fixtures and doc examples never block an automation commit while
// genuine credentials still do.
const TOKEN_ENTROPY_FLOOR = 3.5

const CREDENTIAL_CONTENT_PATTERNS = [
  // Complete PEM blocks only (≥64 base64 chars between BEGIN/END) so test
  // fixtures and docs that merely mention the header are never flagged.
  /-----BEGIN (?:RSA |DSA |EC |OPENSSH |ENCRYPTED |PGP )?PRIVATE KEY(?: BLOCK)?-----[A-Za-z0-9+/=\s]{64,}-----END (?:RSA |DSA |EC |OPENSSH |ENCRYPTED |PGP )?PRIVATE KEY(?: BLOCK)?-----/,
  /\bAUTHORIZATION:\s*(?:bearer|basic)\s+[A-Za-z0-9+/=._~-]{16,}\b/i,
]

// Token-shaped patterns: the captured token body must clear the entropy floor
// and span at least the required character classes (uppercase, lowercase,
// digits, symbols). AWS access-key IDs are uppercase+digits by format, so they
// require fewer classes than base62 bearer tokens.
const CREDENTIAL_TOKEN_PATTERNS: Array<{
  pattern: RegExp
  minEntropy: number
  minClasses: number
}> = [
  {
    pattern: /\b(?:ghp|gho|ghu|ghs)_([A-Za-z0-9]{20,})\b/,
    minEntropy: TOKEN_ENTROPY_FLOOR,
    minClasses: 3,
  },
  {
    pattern: /\bgithub_pat_([A-Za-z0-9_]{20,})\b/,
    minEntropy: TOKEN_ENTROPY_FLOOR,
    minClasses: 3,
  },
  {
    pattern: /\bnpm_([A-Za-z0-9]{20,})\b/,
    minEntropy: TOKEN_ENTROPY_FLOOR,
    minClasses: 3,
  },
  // Slack xox tokens are predominantly digits + hyphens (2 classes); a
  // 3-class floor would let every genuine token through.
  {
    pattern: /\bxox[baprs]-([A-Za-z0-9-]{20,})\b/,
    minEntropy: TOKEN_ENTROPY_FLOOR,
    minClasses: 2,
  },
  // AWS access-key IDs are uppercase + digits by format (2 classes). 4.0 is
  // the theoretical entropy ceiling for 16 chars, so real keys (typically
  // ~13 distinct chars → ≈3.5–3.9) must not sit above their own ceiling.
  {
    pattern: /\bAKIA([0-9A-Z]{16})\b/,
    minEntropy: TOKEN_ENTROPY_FLOOR,
    minClasses: 2,
  },
  // Legacy OpenAI keys are frequently lowercase + digits only; a 3-class
  // floor would miss them.
  {
    pattern: /\bsk-([A-Za-z0-9]{20,})\b/,
    minEntropy: TOKEN_ENTROPY_FLOOR,
    minClasses: 2,
  },
  // Modern OpenAI keys use the `sk-proj-` prefix; the legacy pattern cannot
  // match them (the `proj` segment is only 4 chars before the hyphen).
  {
    pattern: /\bsk-proj-([A-Za-z0-9_-]{20,})\b/,
    minEntropy: TOKEN_ENTROPY_FLOOR,
    minClasses: 2,
  },
]

function shannonEntropy(value: string): number {
  if (value.length === 0) return 0
  const frequencies = new Map<string, number>()
  for (const char of value) {
    frequencies.set(char, (frequencies.get(char) ?? 0) + 1)
  }
  let entropy = 0
  for (const count of frequencies.values()) {
    const probability = count / value.length
    entropy -= probability * Math.log2(probability)
  }
  return entropy
}

function characterClasses(value: string): number {
  let classes = 0
  if (/[a-z]/.test(value)) classes += 1
  if (/[A-Z]/.test(value)) classes += 1
  if (/[0-9]/.test(value)) classes += 1
  if (/[^A-Za-z0-9]/.test(value)) classes += 1
  return classes
}

/**
 * Fail-closed scan of the staged file list + contents for credential shapes
 * before an automation-mode release commit is created and pushed to the
 * public repository. Protects the daily-push flow from publishing an
 * untracked secret (FID-2026-0808-003 audit finding F-A).
 */
export function scanStagedCredentials(
  files: readonly string[],
  root: string,
): string[] {
  const flagged: string[] = []
  for (const file of files) {
    if (
      CREDENTIAL_FILE_PATTERNS.some((pattern) => pattern.test(file)) &&
      !isCredentialNamedSourceFile(file)
    ) {
      flagged.push(`${file} (filename matches a credential pattern)`)
      continue
    }
    const absolute = path.join(root, file)
    if (!existsSync(absolute)) {
      const stagedDeletion = run(
        'git',
        [
          'diff',
          '--cached',
          '--diff-filter=D',
          '--name-only',
          '-z',
          '--',
          file,
        ],
        root,
        true,
      )
      if (stagedDeletion.status === 0 && stagedDeletion.stdout.includes('\0'))
        continue
      throw new Error(
        `credential scan could not confirm missing path ${file} as a staged deletion`,
      )
    }
    const scanBuffer = Buffer.allocUnsafe(2 * 1024 * 1024 + 1)
    let bytesRead = 0
    let fd: number | undefined
    try {
      const byteSize = lstatSync(absolute).size
      if (byteSize > 2 * 1024 * 1024) {
        flagged.push(
          `${file} (content exceeds the 2MB credential-scan cap; refusing to scan)`,
        )
        continue
      }
      fd = openSync(absolute, 'r')
      while (bytesRead < scanBuffer.length) {
        const read = readSync(
          fd,
          scanBuffer,
          bytesRead,
          scanBuffer.length - bytesRead,
          bytesRead,
        )
        if (read === 0) break
        bytesRead += read
      }
    } catch (error) {
      throw new Error(
        `credential scan could not read ${file}: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      if (fd !== undefined) closeSync(fd)
    }
    if (bytesRead > 2 * 1024 * 1024) {
      flagged.push(
        `${file} (content exceeds the 2MB credential-scan cap; refusing to scan)`,
      )
      continue
    }
    const content = scanBuffer.subarray(0, bytesRead).toString('utf8')
    if (CREDENTIAL_CONTENT_PATTERNS.some((pattern) => pattern.test(content))) {
      flagged.push(`${file} (content matches a credential pattern)`)
      continue
    }
    for (const {
      pattern,
      minEntropy,
      minClasses,
    } of CREDENTIAL_TOKEN_PATTERNS) {
      const match = content.match(pattern)
      if (
        match &&
        shannonEntropy(match[1] ?? '') >= minEntropy &&
        characterClasses(match[1] ?? '') >= minClasses
      ) {
        flagged.push(`${file} (content matches ${pattern})`)
        break
      }
    }
  }
  return flagged
}
