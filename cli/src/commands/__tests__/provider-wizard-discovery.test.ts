import fs from 'fs'
import os from 'os'
import path from 'path'

import { parseCustomProviders } from '@savant-code/common/providers/custom-providers'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  adoptActiveSession,
  cancelWizardSession,
  createWizardSession,
  submitActiveWizardStep,
  submitWizardStep,
} from '../../utils/provider-wizard'
import {
  createDiscoveryWizardSession,
  deriveDiscoveryPrefill,
  readDiscoveryPrefill,
} from '../../utils/provider-wizard-discovery'

import type { CandidateState } from '../../../../scripts/providers/lib/diff-state'

/**
 * FID-2026-0914-003 (MQ6) — the discovery wizard prefill seam.
 *
 * `/provider add <host>` for a probe-passed discovery candidate opens the
 * EXISTING step machine pre-filled (id/label/baseUrl/envVar from the
 * harvest state + our probe); the user confirms every step (empty submit
 * adopts the pre-filled value — the consent gesture), and the finalized
 * record carries the provenance stamp through the single validation truth.
 * The machine stays pure; only the state-file reader touches disk.
 */

const STATE_ENTRY: CandidateState = {
  category: 'first-party-free',
  fingerprint: '"[...]":fingerprint',
  downStreak: 0,
  lastSeenUtc: '2026-09-15T08:00:00.000Z',
  url: 'https://api.example-free.ai/v1',
  lastBoundary: 'boundary-ok',
  lastProbe: {
    reachable: true,
    modelsCount: 12,
    boundary: 'boundary-ok',
    latencyMs: 240,
  },
}

function writeStateFile(
  dir: string,
  entries: Record<string, CandidateState>,
): void {
  fs.mkdirSync(path.join(dir, 'dev', 'provider-candidates'), {
    recursive: true,
  })
  fs.writeFileSync(
    path.join(dir, 'dev', 'provider-candidates', 'candidates.json'),
    JSON.stringify(entries),
    'utf8',
  )
}

describe('deriveDiscoveryPrefill (pure host → prefill)', () => {
  test('derives id/label/envVar from the host and carries probe evidence', () => {
    const prefill = deriveDiscoveryPrefill({
      host: 'api.example-free.ai',
      url: 'https://api.example-free.ai/v1',
      acceptedAt: '2026-09-15T09:00:00.000Z',
      modelsCount: 12,
      boundary: 'boundary-ok',
    })
    expect(prefill).not.toBeNull()
    expect(prefill?.id).toBe('example-free')
    expect(prefill?.label).toContain('example-free')
    expect(prefill?.baseUrl).toBe('https://api.example-free.ai/v1')
    expect(prefill?.apiKeyEnvVar).toBe('EXAMPLE_FREE_API_KEY')
    expect(prefill?.acceptedAt).toBe('2026-09-15T09:00:00.000Z')
    expect(prefill?.modelsCount).toBe(12)
  })

  test('reserved ids (built-in/org/grammar) refuse to prefill — no shadowing', () => {
    expect(
      deriveDiscoveryPrefill({
        host: 'api.openrouter.ai',
        url: 'https://api.openrouter.ai/v1',
        acceptedAt: '2026-09-15T09:00:00.000Z',
        modelsCount: 5,
        boundary: 'boundary-ok',
      }),
    ).toBeNull()
  })

  test('claimed env vars fall back to the _DISCOVERY_KEY suffix', () => {
    const prefill = deriveDiscoveryPrefill({
      host: 'api.mistral-cdn.example',
      url: 'https://api.mistral-cdn.example/v1',
      acceptedAt: '2026-09-15T09:00:00.000Z',
      modelsCount: null,
      boundary: null,
    })
    expect(prefill).not.toBeNull()
    // MISTRAL_CDN_API_KEY is unclaimed → the primary shape stands.
    expect(prefill?.apiKeyEnvVar).toBe('MISTRAL_CDN_API_KEY')
  })

  test('malformed hosts (charset/id-rule violations) refuse to prefill', () => {
    expect(
      deriveDiscoveryPrefill({
        host: 'x',
        url: 'https://x/v1',
        acceptedAt: '2026-09-15T09:00:00.000Z',
        modelsCount: null,
        boundary: null,
      }),
    ).toBeNull()
    expect(
      deriveDiscoveryPrefill({
        host: '',
        url: 'https://x/v1',
        acceptedAt: '2026-09-15T09:00:00.000Z',
        modelsCount: null,
        boundary: null,
      }),
    ).toBeNull()
  })
})

describe('readDiscoveryPrefill (candidates.json reader)', () => {
  let tempDir = ''

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-discovery-'))
    cancelWizardSession()
  })

  afterEach(() => {
    cancelWizardSession()
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('returns null when no harvest state exists (never throws)', () => {
    expect(readDiscoveryPrefill('api.example-free.ai', tempDir)).toBeNull()
  })

  test('returns null when the host is absent from the state', () => {
    writeStateFile(tempDir, { 'api.other-host.ai': STATE_ENTRY })
    expect(readDiscoveryPrefill('api.example-free.ai', tempDir)).toBeNull()
  })

  test('builds the prefill from the persisted state (url + probe evidence)', () => {
    writeStateFile(tempDir, { 'api.example-free.ai': STATE_ENTRY })
    const prefill = readDiscoveryPrefill('api.example-free.ai', tempDir)
    expect(prefill).not.toBeNull()
    expect(prefill?.baseUrl).toBe('https://api.example-free.ai/v1')
    expect(prefill?.modelsCount).toBe(12)
    expect(prefill?.boundary).toBe('boundary-ok')
    expect(prefill?.acceptedAt).toBeTruthy()
  })

  test('corrupt state file fails silent → null (a broken run never wedges the wizard)', () => {
    fs.mkdirSync(path.join(tempDir, 'dev', 'provider-candidates'), {
      recursive: true,
    })
    fs.writeFileSync(
      path.join(tempDir, 'dev', 'provider-candidates', 'candidates.json'),
      '{not json',
      'utf8',
    )
    expect(readDiscoveryPrefill('api.example-free.ai', tempDir)).toBeNull()
  })

  test('OPEN-RELAY hosts refuse to prefill (LIVE evidence: chutes.ai class)', () => {
    writeStateFile(tempDir, {
      'api.open-relay.example': {
        ...STATE_ENTRY,
        lastBoundary: 'open-relay-reject',
        lastProbe: {
          reachable: true,
          modelsCount: 12,
          boundary: 'open-relay-reject',
          latencyMs: 240,
        },
      },
    })
    expect(readDiscoveryPrefill('api.open-relay.example', tempDir)).toBeNull()
  })
})

describe('createDiscoveryWizardSession + the consent walk', () => {
  const prefill = {
    id: 'example-free',
    label: 'example-free.ai (discovery)',
    baseUrl: 'https://api.example-free.ai/v1',
    apiKeyEnvVar: 'EXAMPLE_FREE_API_KEY',
    acceptedAt: '2026-09-15T09:00:00.000Z',
    modelsCount: 12,
    boundary: 'boundary-ok',
  }

  test('session opens at label with the prefill in the draft + stamp source', () => {
    const session = createDiscoveryWizardSession(prefill)
    expect(session.mode).toBe('add')
    expect(session.step).toBe('label')
    expect(session.discovery?.acceptedAt).toBe('2026-09-15T09:00:00.000Z')
    expect(session.draft.id).toBe('example-free')
    expect(session.draft.label).toContain('example-free')
    expect(session.draft.baseUrl).toBe('https://api.example-free.ai/v1')
    expect(session.draft.apiKeyEnvVar).toBe('EXAMPLE_FREE_API_KEY')
  })

  test('empty submit ADOPTS the pre-filled value (the consent gesture)', () => {
    let session = createDiscoveryWizardSession(prefill)
    session = submitWizardStep(session, '') // label: adopt
    expect(session.step).toBe('baseUrl')
    expect(session.draft.label).toContain('example-free')
    session = submitWizardStep(session, '') // baseUrl: adopt
    expect(session.step).toBe('protocol')
    expect(session.draft.baseUrl).toBe('https://api.example-free.ai/v1')
    session = submitWizardStep(session, '') // protocol: openai default
    expect(session.step).toBe('envVar')
    session = submitWizardStep(session, '') // envVar: adopt
    expect(session.step).toBe('models')
    expect(session.draft.apiKeyEnvVar).toBe('EXAMPLE_FREE_API_KEY')
  })

  test('typed input REPLACES the pre-filled value', () => {
    let session = createDiscoveryWizardSession(prefill)
    session = submitWizardStep(session, 'My Renamed Gateway')
    expect(session.step).toBe('baseUrl')
    expect(session.draft.label).toBe('My Renamed Gateway')
  })

  test('finalize carries the provenance stamp through the single validation truth', () => {
    let session = createDiscoveryWizardSession(prefill)
    for (const value of ['', '', '', '']) {
      session = submitWizardStep(session, value) // label, baseUrl, protocol, envVar
    }
    session = submitWizardStep(session, '') // models: none
    session = submitWizardStep(session, 'sk-discovery-test-key') // key
    expect(session.step).toBe('done')
    expect(session.final?.source).toBe('discovery-pipeline')
    expect(session.final?.acceptedAt).toBe('2026-09-15T09:00:00.000Z')

    // The stamped record must survive the SAME parser settings.json uses.
    const { configs, problems } = parseCustomProviders({
      customProviders: [session.final],
    } as unknown as Parameters<typeof parseCustomProviders>[0])
    expect(problems).toEqual([])
    expect(configs.length).toBe(1)
    expect(configs[0]?.source).toBe('discovery-pipeline')
    expect(configs[0]?.acceptedAt).toBe('2026-09-15T09:00:00.000Z')
  })

  test('plain add sessions never adopt empty inputs (consent is discovery-only)', () => {
    // The empty-adopt gesture exists ONLY on discovery sessions: a plain
    // /provider add must keep re-prompting on empty input at every step.
    const plain = createWizardSession('add')
    const rejected = submitWizardStep(plain, '') // id step, empty
    expect(rejected.step).toBe('id')
    expect(rejected.error).toBeTruthy()
  })

  test('the prebuilt session enters the ONE active-wizard registry (adoptActiveSession)', () => {
    const session = createDiscoveryWizardSession(prefill)
    adoptActiveSession(session)
    // Submits flow through the same seam the typed/picker paths use.
    const advanced = submitActiveWizardStep('')
    expect(advanced?.step).toBe('baseUrl')
    cancelWizardSession()
    // Registry now empty: the seam submit goes nowhere (fail-closed).
    expect(submitActiveWizardStep('')).toBeUndefined()
  })
})
