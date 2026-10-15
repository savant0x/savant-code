/**
 * FID-2026-0813-008 — clean-process audit: supersession recompute and
 * tamper fail-closed controls. Split from clean-process-audit.test.ts
 * (FID-2026-0819-005 Loop 194); fixture harness moved verbatim.
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
import { validateReceipt } from '@savant-code/common/provenance'
import { beforeEach, afterEach, describe, expect, mock, test } from 'bun:test'

import { setProjectRoot } from '../../../project-files'
import { handleAttestCommand } from '../../attest'
import { validateCleanProcessBundle } from '../clean-process-validator'

import type { ChatMessage } from '../../../types/chat'
import type { RouterParams } from '../../command-registry'
import type { JSONValue } from '@savant-code/common/types/json'
import type {
  SessionManifest,
  TrustReceipt,
} from '@savant-code/common/types/provenance'

let projectRoot: string
let messages: ChatMessage[]

beforeEach(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ztap-clean-audit-'))
  setProjectRoot(projectRoot)
  messages = []
})

afterEach(() => {
  setProjectRoot(process.cwd())
  fs.rmSync(projectRoot, { recursive: true, force: true })
})

function params(): RouterParams {
  return {
    inputValue: '/attest',
    setMessages: mock(
      (
        update: ChatMessage[] | ((previous: ChatMessage[]) => ChatMessage[]),
      ) => {
        messages = typeof update === 'function' ? update(messages) : update
      },
    ),
    saveToHistory: mock(() => {}),
    setInputValue: mock(() => {}),
  } as unknown as RouterParams
}

function exportRoot(): string {
  return path.join(projectRoot, 'dev', 'exports', 'provenance')
}

async function createSignedFixture(sessionId: string): Promise<void> {
  const seed = new Uint8Array(32)
  crypto.getRandomValues(seed)
  const forge = await deriveRoleKeypair(seed, sessionId, 'forge')
  const verifier = await deriveRoleKeypair(seed, sessionId, 'verifier')
  const adversary = await deriveRoleKeypair(seed, sessionId, 'adversary')
  const manifest: SessionManifest = {
    schema: 'savant.provenance.session.v1',
    sessionId,
    createdAt: '2026-08-13T09:00:00.000Z',
    closedAt: '2026-08-13T09:10:00.000Z',
    finalSeq: 3,
    mode: 'record',
    roles: {
      forge: toBase64Url(forge.publicKey),
      verifier: toBase64Url(verifier.publicKey),
      adversary: toBase64Url(adversary.publicKey),
    },
  }
  const sessionDir = path.join(projectRoot, '.savant', 'provenance', sessionId)
  fs.mkdirSync(sessionDir, { recursive: true })
  fs.writeFileSync(
    path.join(sessionDir, 'session.json'),
    JSON.stringify(manifest),
    'utf8',
  )

  const writes = [
    {
      tool: 'write_file' as const,
      path: 'src/a.ts',
      content: 'export const a = 1\n',
    },
    {
      tool: 'str_replace' as const,
      path: 'src/b.ts',
      content: 'export const b = 2\n',
    },
    {
      tool: 'apply_patch' as const,
      path: 'src/c.ts',
      content: 'export const c = 3\n',
    },
  ]
  const lines: string[] = []
  for (let index = 0; index < writes.length; index++) {
    const write = writes[index]
    const target = path.join(projectRoot, write.path)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, write.content, 'utf8')
    const receipt: TrustReceipt = {
      schema: 'savant.provenance.receipt.v1',
      sessionId,
      seq: index + 1,
      status: 'complete',
      changeHash: hashChange(write.content),
      path: write.path,
      tool: write.tool,
      fidId: 'FID-2026-0813-001',
      lawChecks: [{ law: 1, outcome: 'passed' }],
      failClosed: false,
      writer: { agentId: 'forge-1', agentType: 'forge', phase: 'green' },
      timestamp: `2026-08-13T09:0${index + 1}:00.000Z`,
      signatures: [],
      verdicts: [],
    }
    const writerPayload = {
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
    const writerSignature = signPayload(forge, {
      kind: 'jcs',
      canonical: jcsCanonicalize(writerPayload as unknown as JSONValue),
    })
    receipt.signatures = [
      {
        role: 'forge',
        agentId: 'forge-1',
        over: writerSignature.over,
        sig: writerSignature.sig,
      },
    ]
    const verdicts = [
      ['audit', 'verifier', verifier, 'PASS — verifier checked the write'],
      ['adversarial', 'adversary', adversary, 'PASS — no tamper path found'],
    ] as const
    for (const [phase, agentType, key, verdictText] of verdicts) {
      const payload = {
        changeHash: receipt.changeHash,
        phase,
        agentType,
        agentId: `${agentType}-1`,
        verdictText,
        timestamp: `2026-08-13T09:0${index + 2}:00.000Z`,
      }
      const signed = signPayload(key, {
        kind: 'jcs',
        canonical: jcsCanonicalize(payload as unknown as JSONValue),
      })
      receipt.verdicts.push({ ...payload, over: signed.over, sig: signed.sig })
      lines.push(
        JSON.stringify({
          type: 'verdict',
          sessionId,
          seq: receipt.seq,
          ...payload,
          over: signed.over,
          sig: signed.sig,
        }),
      )
    }
    lines.unshift(JSON.stringify({ type: 'receipt', receipt }))
  }
  lines.push(
    JSON.stringify({
      type: 'session_close',
      sessionId,
      closedAt: manifest.closedAt,
      finalSeq: manifest.finalSeq,
    }),
  )
  fs.writeFileSync(
    path.join(sessionDir, 'receipts.jsonl'),
    lines.join('\n') + '\n',
    'utf8',
  )
}

function readBundle(): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(exportRoot(), 'trust-receipt.json'), 'utf8'),
  ) as Record<string, unknown>
}

describe('clean-process provenance audit (FID-2026-0813-008)', () => {
  test('supersession is independently recomputed after a disk edit', async () => {
    await createSignedFixture('sess_superseded_clean')
    await handleAttestCommand(params(), '')
    const target = path.join(projectRoot, 'src', 'b.ts')
    fs.writeFileSync(target, 'export const b = 999\n', 'utf8')

    await handleAttestCommand(params(), '')
    const clean = validateCleanProcessBundle(readBundle(), projectRoot)
    expect(clean.ok).toBe(true)
    expect(
      clean.receipts.filter((r) => r.classification === 'superseded'),
    ).toHaveLength(1)
    expect(
      clean.receipts.filter((r) => r.classification === 'live'),
    ).toHaveLength(2)
  })

  test('tamper controls fail closed: verdict substitution and unknown schema field', async () => {
    await createSignedFixture('sess_tamper_clean')
    await handleAttestCommand(params(), '')
    const bundle = readBundle() as {
      sessions: Array<{
        manifest: SessionManifest
        receipts: Array<{ receipt: TrustReceipt }>
      }>
    }
    const original = bundle.sessions[0].receipts[0].receipt
    const tampered = structuredClone(bundle)
    tampered.sessions[0].receipts[0].receipt.verdicts[0].verdictText =
      'PASS — forged text'
    const tamperedResult = validateCleanProcessBundle(tampered, projectRoot)
    expect(tamperedResult.ok).toBe(false)
    expect(tamperedResult.receipts.some((r) => !r.valid)).toBe(true)

    const unknownField = structuredClone(bundle)
    ;(
      unknownField.sessions[0].receipts[0].receipt as TrustReceipt & {
        injected?: string
      }
    ).injected = 'attack'
    const unknownResult = validateCleanProcessBundle(unknownField, projectRoot)
    expect(unknownResult.ok).toBe(false)
    expect(
      unknownResult.receipts[0]?.failures.some((failure) =>
        failure.includes('unknown fields'),
      ),
    ).toBe(true)

    // The product validator rejects the same schema attack.
    const productFailures = validateReceipt(
      unknownField.sessions[0].receipts[0].receipt,
      bundle.sessions[0].manifest,
    )
    expect(
      productFailures.some((failure) => failure.includes('unknown fields')),
    ).toBe(true)
    expect(original.verdicts[0]?.verdictText).toContain('PASS')
  })
})
