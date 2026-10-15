import { describe, expect, it } from 'bun:test'

import {
  buildAuditManifest,
  classifyGitDelta,
  redactAuditText,
} from './audit-evidence'

import type { AuditTranscript } from './audit-evidence-types'

describe('audit evidence', () => {
  it('redacts credential-shaped output before hashing', () => {
    const redacted = redactAuditText(
      'Authorization: Bearer secret-value token=ghp_1234567890abcdef',
    )
    expect(redacted).not.toContain('secret-value')
    expect(redacted).not.toContain('ghp_1234567890abcdef')
  })

  it('classifies staged, unstaged, untracked, deleted, renamed, and ignored deltas', () => {
    const delta = classifyGitDelta(
      'M  staged.ts\n M unstaged.ts\n?? new.ts\nD  deleted.ts\nR  old.ts -> new.ts\n!! ignored.ts\n',
    )
    expect(delta).toEqual({
      staged: 3,
      unstaged: 1,
      untracked: 1,
      deleted: 1,
      renamed: 1,
      ignored: 1,
    })
  })

  it('builds identical manifest hashes for identical inputs', () => {
    const args = [
      'working-tree' as const,
      'a'.repeat(40),
      '1.3.14',
      {
        staged: 0,
        unstaged: 1,
        untracked: 0,
        deleted: 0,
        renamed: 0,
        ignored: 0,
      },
      [
        {
          label: 'quality',
          command: 'bun',
          args: ['run', 'quality:report'],
          exitCode: 0,
          failureClass: 'success',
          durationMs: 12,
          redactedOutputSha256: 'b'.repeat(64),
          transcriptFinalized: true,
        },
      ] as unknown as AuditTranscript[],
    ] as const
    expect(buildAuditManifest(...args).manifestSha256).toBe(
      buildAuditManifest(...args).manifestSha256,
    )
  })
})
