/**
 * Drift tests for the provider-doc surfaces (FID-2026-0913-005).
 *
 * Pins two properties:
 * 1. The current tree is drift-free across every hand-maintained surface
 *    (`handSurfaceDrift()` returns []).
 * 2. The check FAILS on a stale surface: a fixture root missing one
 *    provider token reports that exact token (never silently passes).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import { handSurfaceDrift, setupProviders } from '../provider-docs-drift'

const tempRoots: string[] = []

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('setupProviders', () => {
  it('returns only setup-available registry entries, ordered', () => {
    const providers = setupProviders()
    expect(providers.length).toBeGreaterThan(0)
    for (const config of providers) {
      expect(config.setupAvailable).toBe(true)
    }
    for (let i = 1; i < providers.length; i++) {
      const prev = providers[i - 1]
      const curr = providers[i]
      const orderOk =
        prev.order < curr.order ||
        (prev.order === curr.order && prev.id < curr.id)
      expect(orderOk).toBe(true)
    }
  })
})

describe('handSurfaceDrift (current tree)', () => {
  it('reports zero drift for every hand-maintained surface', () => {
    expect(handSurfaceDrift()).toEqual([])
  })
})

describe('handSurfaceDrift (stale fixtures)', () => {
  it('reports the exact missing token for a stale surface', () => {
    // Build a fixture root where every checked window/file exists but one
    // provider token is absent from one surface.
    const providers = setupProviders()
    const victim = providers.find((c) => c.id === 'tokenbom')
    expect(victim).toBeDefined()

    const root = mkdtempSync(path.join(os.tmpdir(), 'savant-prov-drift-'))
    tempRoots.push(root)
    mkdirSync(path.join(root, 'docs'), { recursive: true })
    mkdirSync(path.join(root, 'cli', 'release'), { recursive: true })

    const allButVictim = providers
      .filter((c) => c.id !== victim?.id)
      .map((c) => `/provider ${c.id}`)
      .join('\n')
    const envAllButVictim = providers
      .filter((c) => c.credentials.envVar && c.id !== victim?.id)
      .map((c) => `${c.credentials.envVar}`)
      .join(', ')

    const writeFixture = (file: string, content: string) =>
      writeFileSync(path.join(root, file), content)

    // README.md — windows + generated table shell (token semantics only).
    writeFixture(
      'README.md',
      [
        '### Configure a hosted provider key',
        '',
        '```text',
        allButVictim,
        '```',
        '',
        `The supported environment variables are ${envAllButVictim}. The key`,
        'prompt is masked',
        '',
        '**Gateway providers** — ' +
          providers.map((c) => c.label).join(', ') +
          '.',
        '',
        '**Default model**',
      ].join('\n'),
    )

    // README.zh-CN.md — table + bullet + quick-start windows.
    writeFixture(
      'README.zh-CN.md',
      [
        '支持的托管提供商包括：',
        '',
        '| 提供商 | 命令 | 环境变量 | 说明 |',
        '| --- | --- | --- | --- |',
        ...providers
          .filter((c) => c.id !== victim?.id)
          .map((c) => `| ${c.label} | /provider ${c.id} | x | y |`),
        '',
        '密钥持久化在',
        '',
        '自动化时',
        '',
        '### OpenRouter 直连模式',
        '',
        '**网关提供商** —— ' +
          providers
            .filter((c) => c.id !== victim?.id)
            .map((c) => c.label)
            .join('、') +
          '。',
        '',
        '**默认模型**',
        '',
        '### 配置托管提供商密钥',
        '',
        '```text',
        allButVictim,
        '```',
        '',
        `支持的环境变量是 ${envAllButVictim}。`,
        '',
        '## CLI 命令',
      ].join('\n'),
    )

    // cli/release/README.md — dotenv template window.
    writeFixture(
      'cli/release/README.md',
      [
        '# Supported hosted gateways',
        ...providers
          .filter((c) => c.credentials.envVar && c.id !== victim?.id)
          .map((c) => `${c.credentials.envVar}=dummy`),
        'OPENROUTER_API_KEY=dummy',
        '',
        '# Local Ollama override',
      ].join('\n'),
    )

    // docs/* — whole-file checks (complete lists).
    writeFixture(
      'docs/index.md',
      'Provider flexibility: ' +
        providers
          .filter((c) => c.id !== victim?.id)
          .map((c) => c.label)
          .join(', '),
    )
    writeFixture(
      'docs/sdk-overview.md',
      [
        'dispatch: ' +
          providers
            .filter((c) => c.id !== victim?.id)
            .map((c) => `${c.id}/`)
            .join(' '),
        '',
        'env: ' +
          providers
            .filter(
              (c) =>
                c.id !== 'openrouter' &&
                c.credentials.envVar &&
                c.id !== victim?.id,
            )
            .map((c) => c.credentials.envVar)
            .join(' '),
      ].join('\n'),
    )
    writeFixture(
      'docs/installation.md',
      providers
        .filter((c) => c.id !== victim?.id)
        .map((c) => `/provider ${c.id}`)
        .join('\n'),
    )
    writeFixture(
      'docs/features.md',
      providers
        .filter((c) => c.id !== victim?.id)
        .map((c) => c.label)
        .join('\n'),
    )

    const drift = handSurfaceDrift(root)
    // The victim provider must be reported on every surface it belongs to.
    expect(drift.some((issue) => issue.includes('tokenbom'))).toBe(true)
    for (const issue of drift) {
      expect(issue).toContain('tokenbom')
    }
  })

  it('reports a missing window anchor as drift (never silently passes)', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'savant-prov-anchor-'))
    tempRoots.push(root)
    mkdirSync(path.join(root, 'docs'), { recursive: true })
    mkdirSync(path.join(root, 'cli', 'release'), { recursive: true })

    // Files exist but carry no recognizable windows at all.
    const placeholder = 'nothing provider-related here'
    for (const file of [
      'README.md',
      'README.zh-CN.md',
      'cli/release/README.md',
      'docs/index.md',
      'docs/sdk-overview.md',
      'docs/installation.md',
      'docs/features.md',
    ]) {
      writeFileSync(path.join(root, file), placeholder)
    }

    const drift = handSurfaceDrift(root)
    expect(drift.length).toBeGreaterThan(0)
    expect(
      drift.some((issue) => issue.includes('window anchors not found')),
    ).toBe(true)
  })
})
