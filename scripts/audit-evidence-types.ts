export type AuditMode = 'working-tree' | 'clean-certification'

export type AuditCommand = {
  label: string
  command: string
  args: string[]
}

export type AuditDelta = {
  staged: number
  unstaged: number
  untracked: number
  deleted: number
  renamed: number
  ignored: number
}

export type AuditTranscript = {
  label: string
  command: string
  args: string[]
  exitCode: number
  failureClass:
    'success' | 'exit' | 'signal' | 'spawn-error' | 'timeout' | 'evidence-error'
  durationMs: number
  redactedOutputSha256?: string
  transcriptFinalized: boolean
  finalizationError?: string
}

export type AuditManifest = {
  schemaVersion: 'audit-evidence/v1'
  mode: AuditMode
  repositoryHead: string
  bunVersion: string
  delta: AuditDelta
  commands: AuditTranscript[]
  manifestSha256: string
}
