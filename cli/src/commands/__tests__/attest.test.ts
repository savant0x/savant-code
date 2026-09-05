/**
 * /attest command tests — FID-2026-0813-007.
 * Parent of the Loop 333 decomposition (inline-verifier fidelity suite and
 * shared fixture harness live in sibling files).
 */
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { handleAttestCommand } from '../attest'
import {
  makeParams,
  renderedText,
  setupAttestTest,
  tempDir,
  writeFixtureSession,
} from './attest-test-harness'
import { HTML_DISCLAIMER, TRUST_WARNING } from '../attest/serializer'

setupAttestTest()

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
    // NOTE: a standalone substring "ads" check is intentionally omitted — the
    // embedded JSON bundle carries base64url-encoded Ed25519 signatures whose
    // random bytes may legitimately contain that substring, producing false
    // positives. ad-unit + <script src= already cover ad-related content.
    expect(html).not.toContain('http://')
    expect(html).not.toContain('https://')
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('ad-unit')
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
