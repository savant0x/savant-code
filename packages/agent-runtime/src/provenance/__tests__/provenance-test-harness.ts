/**
 * Shared fixtures for the ZTAP provenance test family.
 *
 * Provides the temp-dir lifecycle (real temp projects, cleaned after each
 * test), a minimal AgentState stand-in, and a base SessionManifest builder.
 * Every assertion in the family runs against real Ed25519 keys and a real
 * temp-dir ledger.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach } from 'bun:test'

import type {
  SessionManifest,
  TrustReceipt,
} from '@savant-code/common/types/provenance'
import type { AgentState } from '@savant-code/common/types/session-state'

const tempDirs: string[] = []

export function makeTempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ztap-test-'))
  tempDirs.push(dir)
  return dir
}

export function makeAgentState(
  overrides: Partial<AgentState> = {},
): AgentState {
  // The provenance module only reads agentId / provenanceMode / provenance /
  // messageHistory from AgentState — construct a minimal structural stand-in.
  return {
    agentId: 'agent-1',
    messageHistory: [],
    ...overrides,
  } as unknown as AgentState
}

export function baseManifest(
  overrides: Partial<SessionManifest> = {},
): SessionManifest {
  return {
    schema: 'savant.provenance.session.v1',
    sessionId: 'sess_test',
    createdAt: '2026-08-13T00:00:00.000Z',
    mode: 'record',
    roles: {},
    ...overrides,
  }
}

export type { SessionManifest, TrustReceipt }

beforeEach(() => {
  tempDirs.length = 0
})

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
