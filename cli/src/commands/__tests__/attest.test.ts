/**
 * /attest test suite — FID-2026-0813-007 (+ FID-2026-0813-008 fixture).
 *
 * The fixture ledger is built with REAL Ed25519 keys (the same primitives the
 * runtime uses), so every assertion exercises genuine signature verification —
 * server-side (shared validator) AND client-side (inline verifier).
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
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { setProjectRoot } from '../../project-files'
import { handleAttestCommand } from '../attest'
import {
  INLINE_VERIFIER_SOURCE,
  runInlineVerifier,
} from '../attest/inline-verifier'
import { HTML_DISCLAIMER, TRUST_WARNING } from '../attest/serializer'

import type { ChatMessage } from '../../types/chat'
import type { RouterParams } from '../command-registry'
import type { JSONValue } from '@savant-code/common/types/json'
import type {
  SessionManifest,
  TrustReceipt,
} from '@savant-code/common/types/provenance'

let tempDir: string
let renderedMessages: ChatMessage[]

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

function makeParams(inputValue = '/attest'): RouterParams {
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

function renderedText(): string {
  return renderedMessages.map((m) => m.content ?? '').join('\n')
}

/**
 * Build a REAL signed ledger session at `.savant/provenance/<sessionId>/`.
 * `opts.tamperVerdict` rewrites a verdict line after signing (attack surface);
 * `opts.editAfter` changes the target file after the write (supersession).
 */
async function writeFixtureSession(
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

describe('/attest command (FID-2026-0813-007)', () => {
  test('valid ledger → exports authoritative JSON + offline HTML with verified summary', async () => {
    await writeFixtureSession('sess_ok')

    await handleAttestCommand(makeParams('/attest'), '')

    const text = renderedText()
    expect(text).toContain('Trust receipt exported')
    expect(text).toContain('Receipts: 1 (1 live, 0 superseded)')
    expect(text).toContain('Failing checks: 0')

    const jsonPath = path.join(
      tempDir,
      'dev',
      'exports',
      'provenance',
      'trust-receipt.json',
    )
    const htmlPath = path.join(
      tempDir,
      'dev',
      'exports',
      'provenance',
      'trust-receipt.html',
    )
    expect(fs.existsSync(jsonPath)).toBe(true)
    expect(fs.existsSync(htmlPath)).toBe(true)

    const bundle = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    expect(bundle.schema).toBe('savant.trust-receipt.v1')
    expect(bundle.sessions).toHaveLength(1)
    expect(bundle.sessions[0].summary).toMatchObject({
      receipts: 1,
      live: 1,
      superseded: 0,
      complete: 1,
      pending: 0,
      withFailures: 0,
    })
    expect(bundle.sessions[0].receipts[0].validation.valid).toBe(true)
    // Law 12: the bundle carries hashes, never content.
    expect(JSON.stringify(bundle)).not.toContain('export const a = 1')

    const html = fs.readFileSync(htmlPath, 'utf8')
    expect(html).toContain('Trust Receipt')
    expect(html).toContain('<!doctype html>')
  })

  test('no ledger → honest "no provenance" report, exit 0 style message', async () => {
    await handleAttestCommand(makeParams('/attest'), '')
    expect(renderedText()).toContain('No provenance ledger found')
    expect(
      fs.existsSync(path.join(tempDir, 'dev', 'exports', 'provenance')),
    ).toBe(false)
  })

  test('tampered verdict line → flagged as failing check in summary + bundle', async () => {
    await writeFixtureSession('sess_tampered', { tamper: true })

    await handleAttestCommand(makeParams('/attest'), '')
    const text = renderedText()
    expect(text).toContain('Failing checks: 1')
    expect(text).toContain('First failing check')

    const bundle = JSON.parse(
      fs.readFileSync(
        path.join(
          tempDir,
          'dev',
          'exports',
          'provenance',
          'trust-receipt.json',
        ),
        'utf8',
      ),
    )
    expect(bundle.sessions[0].receipts[0].validation.valid).toBe(false)
  })

  test('edited-after-write file → superseded classification, ledger untouched', async () => {
    await writeFixtureSession('sess_superseded', { editAfter: true })

    await handleAttestCommand(makeParams('/attest'), '')
    const text = renderedText()
    expect(text).toContain('Receipts: 1 (0 live, 1 superseded)')

    const bundle = JSON.parse(
      fs.readFileSync(
        path.join(
          tempDir,
          'dev',
          'exports',
          'provenance',
          'trust-receipt.json',
        ),
        'utf8',
      ),
    )
    expect(bundle.sessions[0].summary.superseded).toBe(1)
    expect(bundle.sessions[0].summary.live).toBe(0)
    expect(bundle.sessions[0].receipts[0].classification).toBe('superseded')
  })

  test('--session selects one session; --all exports every session', async () => {
    await writeFixtureSession('sess_a')
    await writeFixtureSession('sess_b')

    await handleAttestCommand(makeParams('/attest'), '--session sess_a')
    let bundle = JSON.parse(
      fs.readFileSync(
        path.join(
          tempDir,
          'dev',
          'exports',
          'provenance',
          'trust-receipt.json',
        ),
        'utf8',
      ),
    )
    expect(bundle.sessions).toHaveLength(1)
    expect(bundle.sessions[0].sessionId).toBe('sess_a')

    await handleAttestCommand(makeParams('/attest'), '--all')
    bundle = JSON.parse(
      fs.readFileSync(
        path.join(
          tempDir,
          'dev',
          'exports',
          'provenance',
          'trust-receipt.json',
        ),
        'utf8',
      ),
    )
    expect(bundle.sessions).toHaveLength(2)

    await handleAttestCommand(makeParams('/attest'), '--session nope')
    expect(renderedText()).toContain('No provenance session')
  })

  test('--output writes to an explicit directory', async () => {
    await writeFixtureSession('sess_out')
    const out = path.join(tempDir, 'custom-out')
    await handleAttestCommand(makeParams('/attest'), `--output ${out}`)
    expect(fs.existsSync(path.join(out, 'trust-receipt.json'))).toBe(true)
    expect(fs.existsSync(path.join(out, 'trust-receipt.html'))).toBe(true)
  })

  test('HTML artifact contract: verbatim disclaimer, trust warning, embedded JSON, inline verifier, no ads', async () => {
    await writeFixtureSession('sess_html')
    await handleAttestCommand(makeParams('/attest'), '')
    const html = fs.readFileSync(
      path.join(tempDir, 'dev', 'exports', 'provenance', 'trust-receipt.html'),
      'utf8',
    )

    // Nova audit flag #3 — verbatim convenience-view disclaimer.
    expect(html).toContain(HTML_DISCLAIMER)
    // Nova audit flag #2 — session-key trust warning.
    expect(html).toContain(TRUST_WARNING)
    // Bundle embedded verbatim (JSON script tag).
    expect(html).toContain('type="application/json" id="attest-bundle"')
    expect(html).toContain('savant.trust-receipt.v1')
    // Inline verifier present and runnable.
    expect(html).toContain('function verifyTrustReceiptBundle')
    expect(html).toContain('Run independent verification')
    // Zero network, zero ads (build order Q4 — pure trust artifact).
    expect(html).not.toContain('http://')
    expect(html).not.toContain('https://')
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('ad-unit')
    expect(html).not.toContain('ads')
    expect(html).not.toContain('<script src=')
  })

  test('manifest whitelist: bundle never serializes private material (Law 12)', async () => {
    await writeFixtureSession('sess_whitelist')
    await handleAttestCommand(makeParams('/attest'), '')
    const raw = fs.readFileSync(
      path.join(tempDir, 'dev', 'exports', 'provenance', 'trust-receipt.json'),
      'utf8',
    )
    expect(raw).not.toMatch(/seed|privateKey|secret|"seed"/i)
    const bundle = JSON.parse(raw)
    expect(Object.keys(bundle.sessions[0].manifest)).toEqual(
      expect.arrayContaining([
        'schema',
        'sessionId',
        'createdAt',
        'mode',
        'roles',
      ]),
    )
    expect(Object.keys(bundle.sessions[0].manifest.roles).sort()).toEqual([
      'adversary',
      'forge',
      'verifier',
    ])
  })
})

describe('Inline verifier fidelity (FID-2026-0813-007/008)', () => {
  test('valid bundle verifies OK — inline JCS reproduces server JCS byte-for-byte', async () => {
    const { manifest, receipts } = await writeFixtureSession('sess_verify')
    const bundle = {
      schema: 'savant.trust-receipt.v1',
      sessions: [
        {
          manifest: {
            sessionId: manifest.sessionId,
            createdAt: manifest.createdAt,
            roles: manifest.roles,
          },
          receipts: receipts.map((r) => ({
            receipt: r,
            classification: 'live',
          })),
        },
      ],
    }
    const result = await runInlineVerifier(bundle as never)
    expect(result.ok).toBe(true)
    expect(result.receipts).toHaveLength(1)
    expect(result.receipts[0].valid).toBe(true)
    expect(result.receipts[0].failures).toEqual([])
  })

  test('tampered bundle fails — inline verifier catches the substituted verdict text', async () => {
    const { manifest, receipts } = await writeFixtureSession('sess_verify_bad')
    const tampered = structuredClone(receipts[0])
    tampered.verdicts = tampered.verdicts.map((v) =>
      v.phase === 'adversarial'
        ? { ...v, verdictText: 'PASS — (tampered)' }
        : v,
    )
    const bundle = {
      schema: 'savant.trust-receipt.v1',
      sessions: [
        {
          manifest: {
            sessionId: manifest.sessionId,
            createdAt: manifest.createdAt,
            roles: manifest.roles,
          },
          receipts: [{ receipt: tampered, classification: 'live' }],
        },
      ],
    }
    const result = await runInlineVerifier(bundle as never)
    expect(result.ok).toBe(false)
    const bad = result.receipts.find((r) => !r.valid)
    expect(bad?.failures.some((f) => f.includes('over-hash mismatch'))).toBe(
      true,
    )
  })

  test('inline verifier source parses as valid JavaScript', () => {
    expect(() => new Function(INLINE_VERIFIER_SOURCE)).not.toThrow()
  })
})
