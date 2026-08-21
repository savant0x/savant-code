#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'

import type {
  AuditCommand,
  AuditDelta,
  AuditManifest,
  AuditMode,
  AuditTranscript,
} from './audit-evidence-types'

export type {
  AuditDelta,
  AuditManifest,
  AuditTranscript,
} from './audit-evidence-types'

const root = path.resolve(import.meta.dir, '..')
const allowedCommands = new Set(['bun', 'git'])
const auditCommands: readonly AuditCommand[] = [
  {
    label: 'repository-validation',
    command: 'bun',
    args: ['run', 'validate:repository'],
  },
  { label: 'quality-report', command: 'bun', args: ['run', 'quality:report'] },
  {
    label: 'protocol-bundle',
    command: 'bun',
    args: ['run', 'generate:protocol-bundle:check'],
  },
  {
    label: 'provider-reference',
    command: 'bun',
    args: ['run', 'generate:provider-docs:check'],
  },
  { label: 'current-hygiene', command: 'bun', args: ['run', 'hygiene:check'] },
  {
    label: 'targeted-tests',
    command: 'bun',
    args: [
      'test',
      'scripts/pre-push-scan.test.ts',
      'scripts/public-release.test.ts',
      'scripts/validation-manifest.test.ts',
      'scripts/fid-ledger.test.ts',
      'scripts/quality-report.test.ts',
      'common/src/__tests__/env-boundary.test.ts',
      'packages/agent-runtime/src/echo/__tests__/enforcement.test.ts',
    ],
  },
]

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function redactAuditText(value: string): string {
  return value
    .replace(/(authorization\s*:\s*bearer\s+)[^\s]+/gi, '$1[REDACTED]')
    .replace(
      /(token|password|secret|api[_-]?key)\s*[=:]\s*[^\s,;]+/gi,
      '$1=[REDACTED]',
    )
    .replace(
      /\b(?:ghp|github_pat|sk|pk)_[A-Za-z0-9_-]{12,}\b/g,
      '[REDACTED_TOKEN]',
    )
}

export function classifyGitDelta(status: string): AuditDelta {
  const delta: AuditDelta = {
    staged: 0,
    unstaged: 0,
    untracked: 0,
    deleted: 0,
    renamed: 0,
    ignored: 0,
  }
  for (const line of status.split(/\r?\n/).filter(Boolean)) {
    const code = line.slice(0, 2)
    if (code === '!!') delta.ignored += 1
    else if (code === '??') delta.untracked += 1
    else {
      if (code[0] !== ' ' && code[0] !== '?') delta.staged += 1
      if (code[1] !== ' ' && code[1] !== '?') delta.unstaged += 1
      if (code.includes('D')) delta.deleted += 1
      if (code.includes('R')) delta.renamed += 1
    }
  }
  return delta
}

function run(
  command: string,
  args: string[],
): {
  exitCode: number
  output: string
  failureClass: AuditTranscript['failureClass']
  transcriptFinalized: boolean
  finalizationError?: string
} {
  if (!allowedCommands.has(path.basename(command).toLowerCase())) {
    throw new Error(`Audit command is not allowlisted: ${command}`)
  }
  const started = Date.now()
  let result: ReturnType<typeof spawnSync>
  try {
    result = spawnSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
      windowsHide: true,
      shell: false,
      timeout: 30 * 60 * 1_000,
      killSignal: 'SIGTERM',
    })
  } catch {
    return {
      exitCode: 1,
      output: '',
      failureClass: 'spawn-error',
      durationMs: Date.now() - started,
      transcriptFinalized: false,
      finalizationError:
        'audit subprocess could not be spawned; evidence requires review',
    }
  }
  const timedOut =
    (result.error as (Error & { code?: string }) | undefined)?.code ===
    'ETIMEDOUT'
  const failureClass: AuditTranscript['failureClass'] = timedOut
    ? 'timeout'
    : result.error
      ? 'spawn-error'
      : result.signal
        ? 'signal'
        : result.status === 0
          ? 'success'
          : 'exit'
  try {
    const output = redactAuditText(
      `${String(result.stdout ?? '')}\n${String(result.stderr ?? '')}`,
    )
    const transcriptFinalized = failureClass === 'success'
    return {
      exitCode: result.status ?? 1,
      output,
      failureClass,
      durationMs: Date.now() - started,
      transcriptFinalized,
      ...(transcriptFinalized
        ? {}
        : {
            finalizationError:
              'audit command did not complete successfully; evidence requires review',
          }),
    }
  } catch {
    return {
      exitCode: result.status ?? 1,
      output: '',
      failureClass: 'evidence-error',
      durationMs: Date.now() - started,
      transcriptFinalized: false,
      finalizationError:
        'audit transcript redaction failed; raw output discarded',
    }
  }
}

function stableManifestInput(
  manifest: Omit<AuditManifest, 'manifestSha256'>,
): string {
  return JSON.stringify({
    ...manifest,
    commands: manifest.commands.map(
      ({ durationMs: _durationMs, ...command }) => command,
    ),
  })
}

export function buildAuditManifest(
  mode: AuditMode,
  repositoryHead: string,
  bunVersion: string,
  delta: AuditDelta,
  commands: AuditTranscript[],
): AuditManifest {
  const base = {
    schemaVersion: 'audit-evidence/v1' as const,
    mode,
    repositoryHead,
    bunVersion,
    delta,
    commands,
  }
  return { ...base, manifestSha256: hash(stableManifestInput(base)) }
}

export function runAudit(mode: AuditMode = 'working-tree'): AuditManifest {
  const head = run('git', ['rev-parse', 'HEAD'])
  const bun = run('bun', ['--version'])
  const status = run('git', [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ])
  const ignored = run('git', ['status', '--porcelain=v1', '--ignored'])
  const delta = classifyGitDelta(status.output)
  delta.ignored = classifyGitDelta(ignored.output).ignored
  const transcripts: AuditTranscript[] = []
  for (const spec of auditCommands) {
    const result = run(spec.command, spec.args)
    transcripts.push({
      label: spec.label,
      command: spec.command,
      args: spec.args,
      exitCode: result.exitCode,
      failureClass: result.failureClass,
      durationMs: result.durationMs,
      ...(result.transcriptFinalized
        ? { redactedOutputSha256: hash(result.output) }
        : {}),
      transcriptFinalized: result.transcriptFinalized,
      ...(result.finalizationError
        ? { finalizationError: result.finalizationError }
        : {}),
    })
  }
  const manifest = buildAuditManifest(
    mode,
    head.output.trim().split(/\r?\n/)[0] ?? 'unknown',
    bun.output.trim().split(/\r?\n/)[0] ?? 'unknown',
    delta,
    transcripts,
  )
  if (
    mode === 'clean-certification' &&
    Object.values(delta).some((value) => value > 0)
  ) {
    throw new Error(
      'NEEDS-REVIEW: clean certification requested for a dirty working tree',
    )
  }
  if (
    transcripts.some(
      (transcript) =>
        transcript.exitCode !== 0 ||
        transcript.failureClass !== 'success' ||
        !transcript.transcriptFinalized,
    )
  ) {
    throw new Error(
      'NEEDS-REVIEW: one or more audit commands failed or produced incomplete evidence',
    )
  }
  return manifest
}

if (import.meta.main) {
  const mode: AuditMode = process.argv.includes('--clean')
    ? 'clean-certification'
    : 'working-tree'
  try {
    const manifest = runAudit(mode)
    console.log(JSON.stringify(manifest, null, 2))
    console.log(
      mode === 'working-tree'
        ? 'AUDIT_RESULT=WORKING_TREE_EVIDENCE (not clean-release certification)'
        : 'AUDIT_RESULT=CLEAN_CERTIFICATION',
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
