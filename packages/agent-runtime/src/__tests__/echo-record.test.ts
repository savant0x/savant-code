import { describe, expect, it } from 'bun:test'

import { recordEchoComplianceActivity } from '../tools/tool-executor/echo-record'
import { EchoComplianceTracker } from '../util/echo-compliance'

describe('recordEchoComplianceActivity — verification credit (FID-2026-0820-014 EC-3)', () => {
  function trackerWithPendingWrite(): EchoComplianceTracker {
    const tracker = new EchoComplianceTracker({ mode: 'warn' })
    tracker.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 5,
      contentKnowledge: true,
      isNewFile: false,
      securitySensitive: false,
    })
    return tracker
  }

  it('credits verification from run_readonly_command (EC-3)', () => {
    const tracker = trackerWithPendingWrite()
    recordEchoComplianceActivity({
      echoCompliance: tracker,
      toolName: 'run_readonly_command',
      effectiveInput: { command: 'bun run lint:md' },
    })
    const records = tracker.getWriteRecords()
    expect(records).toHaveLength(1)
    expect(records[0]?.verified).toBe(true)
  })

  it('still credits verification from run_terminal_command', () => {
    const tracker = trackerWithPendingWrite()
    recordEchoComplianceActivity({
      echoCompliance: tracker,
      toolName: 'run_terminal_command',
      effectiveInput: {
        command: 'bun run --cwd=packages/agent-runtime typecheck',
      },
    })
    const records = tracker.getWriteRecords()
    expect(records).toHaveLength(1)
    expect(records[0]?.verified).toBe(true)
  })

  it('does NOT credit a non-verification command', () => {
    const tracker = trackerWithPendingWrite()
    recordEchoComplianceActivity({
      echoCompliance: tracker,
      toolName: 'run_readonly_command',
      effectiveInput: { command: 'ls src' },
    })
    const records = tracker.getWriteRecords()
    expect(records).toHaveLength(1)
    expect(records[0]?.verified).toBe(false)
  })
})
