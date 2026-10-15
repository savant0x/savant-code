/**
 * Shared harness for the /attest test family — FID-2026-0813-007 (+008).
 *
 * The fixture ledger is built with REAL Ed25519 keys (the same primitives the
 * runtime uses), so every assertion exercises genuine signature verification —
 * server-side (shared validator) AND client-side (inline verifier).
 *
 * Sibling of the Loop 333 decomposition: each suite file calls
 * setupAttestTest() at module scope to register the temp-dir lifecycle and
 * gets the shared helpers.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  deriveRoleKeypair,
  hashChange,
  jcsCanonicalize,
  signPayload,
  toBase64Url,
} from '@savant-code/common/crypto'
import { afterEach, beforeEach, mock } from 'bun:test'

import { setProjectRoot } from '../../project-files'

import type { ChatMessage } from '../../types/chat'
import type { RouterParams } from '../command-registry'
import type { JSONValue } from '@savant-code/common/types/json'
import type {
  SessionManifest,
  TrustReceipt,
} from '@savant-code/common/types/provenance'

export let tempDir: string
export let renderedMessages: ChatMessage[]

export function setupAttestTest() {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-attest-'))
    setProjectRoot(tempDir)
    renderedMessages = []
  })

  afterEach(() => {
    setProjectRoot(process.cwd())
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
        break
      } catch {
        Bun.sleepSync(50)
      }
    }
  })
}

export function makeParams(inputValue = '/attest'): RouterParams {
  return {
    setMessages: mock(
      (update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
        renderedMessages =
          typeof update === 'function' ? update(renderedMessages) : update
      },
    ),
    saveToHistory: mock(() => {}),
    setInputValue: mock(() => {}),
    inputValue,
    agentMode: 'HYBRID',
  } as unknown as RouterParams
}

export function renderedText(): string {
  return renderedMessages.map((m) => m.content ?? '').join('\n')
}

/**
 * Build a REAL signed ledger session at `.savant/provenance/<sessionId>/`.
 * `opts.tamper` rewrites a verdict line after signing (attack surface);
 * `opts.editAfter` changes the target file after the write (supersession).
 */
export async function writeFixtureSession(
  sessionId: string,
  opts: { tamper?: boolean; editAfter?: boolean } = {},
): Promise<{ manifest: SessionManifest; receipts: TrustReceipt[] }> {
  const seed = new Uint8Array(32)
  crypto.getRandomValues(seed)
  const forge = await deriveRoleKeypair(seed, sessionId, 'forge')
  const verifier = await deriveRoleKeypair(seed, sessionId, 'verifier')
  const adversary = await deriveRoleKeypair(seed, sessionId, 'adversary')

  const createdAt = '2026-08-13T08:00:00.000Z'
  const manifest: SessionManifest = {
    schema: 'savant.provenance.session.v1',
    sessionId,
    createdAt,
    mode: 'record',
    roles: {
      forge: toBase64Url(forge.publicKey),
      verifier: toBase64Url(verifier.publicKey),
      adversary: toBase64Url(adversary.publicKey),
    },
  }
  const ledgerDir = path.join(tempDir, '.savant', 'provenance', sessionId)
  fs.mkdirSync(ledgerDir, { recursive: true })
  fs.writeFileSync(
    path.join(ledgerDir, 'session.json'),
    JSON.stringify(manifest, null, 2),
    'utf8',
  )

  const target = path.join(tempDir, 'src', 'a.ts')
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const content = 'export const a = 1\n'
  fs.writeFileSync(target, content, 'utf8')

  const receipt: TrustReceipt = {
    schema: 'savant.provenance.receipt.v1',
    sessionId,
    seq: 1,
    status: 'pending',
    changeHash: hashChange(content),
    path: 'src/a.ts',
    tool: 'write_file',
    fidId: 'FID-2026-0813-001',
    lawChecks: [{ law: 1, outcome: 'passed' }],
    failClosed: false,
    writer: { agentId: 'forge-1', agentType: 'forge', phase: 'green' },
    timestamp: '2026-08-13T08:01:00.000Z',
    signatures: [],
    verdicts: [],
  }
  const base = {
    schema: receipt.schema,
    sessionId: receipt.sessionId,
    seq: receipt.seq,
    changeHash: receipt.changeHash,
    path: receipt.path,
    tool: receipt.tool,
    fidId: receipt.fidId,
    lawChecks: receipt.lawChecks,
    failClosed: receipt.failClosed,
    writer: receipt.writer,
    timestamp: receipt.timestamp,
  }
  const writerSig = signPayload(forge, {
    kind: 'jcs',
    canonical: jcsCanonicalize(base as unknown as JSONValue),
  })
  receipt.signatures = [
    {
      role: 'forge',
      agentId: 'forge-1',
      over: writerSig.over,
      sig: writerSig.sig,
    },
  ]

  const makeVerdict = (
    phase: 'audit' | 'adversarial',
    agentType: string,
    agentId: string,
    text: string,
  ) => {
    const payload = {
      changeHash: receipt.changeHash,
      phase,
      agentType,
      agentId,
      verdictText: text,
      timestamp: '2026-08-13T08:02:00.000Z',
    }
    const key = phase === 'audit' ? verifier : adversary
    const signed = signPayload(key, {
      kind: 'jcs',
      canonical: jcsCanonicalize(payload as unknown as JSONValue),
    })
    return { ...payload, over: signed.over, sig: signed.sig }
  }

  const audit = makeVerdict(
    'audit',
    'verifier',
    'verifier-1',
    'PASS — law checks hold',
  )
  const adversarial = makeVerdict(
    'adversarial',
    'adversary',
    'adversary-1',
    'PASS — no replay vector; per-role keys distinct',
  )
  receipt.status = 'complete'
  receipt.verdicts = [audit, adversarial]

  const lines: string[] = [
    JSON.stringify({ type: 'receipt', receipt }),
    JSON.stringify({
      type: 'verdict',
      sessionId,
      seq: receipt.seq,
      phase: audit.phase,
      agentType: audit.agentType,
      agentId: audit.agentId,
      verdictText: audit.verdictText,
      timestamp: audit.timestamp,
      changeHash: receipt.changeHash,
      over: audit.over,
      sig: audit.sig,
    }),
    JSON.stringify({
      type: 'verdict',
      sessionId,
      seq: receipt.seq,
      phase: adversarial.phase,
      agentType: adversarial.agentType,
      agentId: adversarial.agentId,
      verdictText: adversarial.verdictText,
      timestamp: adversarial.timestamp,
      changeHash: receipt.changeHash,
      over: adversarial.over,
      sig: adversarial.sig,
    }),
    JSON.stringify({
      type: 'session_close',
      sessionId,
      closedAt: '2026-08-13T08:03:00.000Z',
      finalSeq: 1,
    }),
  ]
  if (opts.tamper) {
    // Attack: rewrite the adversarial verdict line with a substituted text.
    const tampered = JSON.parse(lines[2])
    tampered.verdictText = 'PASS — (tampered by attacker)'
    lines[2] = JSON.stringify(tampered)
  }
  fs.writeFileSync(
    path.join(ledgerDir, 'receipts.jsonl'),
    lines.join('\n'),
    'utf8',
  )

  if (opts.editAfter) {
    fs.writeFileSync(target, 'export const a = 2\n', 'utf8')
  }
  return { manifest, receipts: [receipt] }
}
