/**
 * Hand-maintained provider-doc drift checks (FID-2026-0913-005).
 *
 * The generator (`generate-provider-reference.ts`) owns three GENERATED
 * surfaces byte-exactly (.env.example, cli/release/README.md table,
 * README.md table). Every other provider-doc surface is hand-maintained and
 * rots silently when a provider lands — this module pins each one to the
 * registry so `generate:provider-docs --check` fails with the exact missing
 * token instead of shipping stale docs.
 *
 * Checks are presence-in-window, not byte-exact: prose around a pinned token
 * may be reworded freely. A missing window anchor (or a missing file) is
 * itself reported as drift — the anchor is part of the contract. Surfaces
 * that deliberately do NOT enumerate providers (illustrative shell blocks
 * that point at the table) carry no pin: nothing to rot.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import type { ProviderConfig } from '@savant-code/common/providers/types'

const DEFAULT_ROOT = resolve(import.meta.dir, '..')

/** Registry entries that appear in `/provider` setup surfaces. */
export function setupProviders(): ProviderConfig[] {
  return Object.values(PROVIDER_REGISTRY)
    .filter((config) => config.setupAvailable)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

type WindowCheck = {
  file: string
  /** What the window covers (used in drift messages). */
  surface: string
  startAnchor: string
  endAnchor: string
  /** Required token per setup provider; null skips the provider. */
  tokenFor: (config: ProviderConfig) => string | null
}

type FileCheck = {
  file: string
  surface: string
  /** Required token per setup provider; null skips the provider. */
  tokenFor: (config: ProviderConfig) => string | null
}

const envVarOf = (config: ProviderConfig): string | null =>
  config.credentials.envVar ?? null

/**
 * Windowed checks — the token must appear between two stable anchors so a
 * token satisfied by a generated table elsewhere in the file cannot mask a
 * stale hand-maintained block.
 */
const WINDOW_CHECKS: readonly WindowCheck[] = [
  {
    // README.md quick-start command list (before the env-var sentence).
    file: 'README.md',
    surface: 'quick-start command list',
    startAnchor: '### Configure a hosted provider key',
    endAnchor: 'The supported environment variables are',
    tokenFor: (config) => `/provider ${config.id}`,
  },
  {
    // README.md env-var sentence (documents every gateway key).
    file: 'README.md',
    surface: 'env-var sentence',
    startAnchor: 'The supported environment variables are',
    endAnchor: 'prompt is masked',
    tokenFor: envVarOf,
  },
  {
    // README.md "Gateway providers" feature bullet.
    file: 'README.md',
    surface: 'gateway-providers bullet',
    startAnchor: '**Gateway providers**',
    endAnchor: '**Default model**',
    tokenFor: (config) => config.label,
  },
  {
    // README.zh-CN.md provider table.
    file: 'README.zh-CN.md',
    surface: 'zh-CN provider table',
    startAnchor: '支持的托管提供商包括',
    endAnchor: '密钥持久化在',
    tokenFor: (config) => `/provider ${config.id}`,
  },
  {
    // README.zh-CN.md "Gateway providers" feature bullet.
    file: 'README.zh-CN.md',
    surface: 'zh-CN gateway-providers bullet',
    startAnchor: '**网关提供商**',
    endAnchor: '**默认模型**',
    tokenFor: (config) => config.label,
  },
  {
    // README.zh-CN.md quick-start command list.
    file: 'README.zh-CN.md',
    surface: 'zh-CN quick-start command list',
    startAnchor: '### 配置托管提供商密钥',
    endAnchor: '## CLI 命令',
    tokenFor: (config) => `/provider ${config.id}`,
  },
  {
    // README.zh-CN.md quick-start env-var sentence (same window).
    file: 'README.zh-CN.md',
    surface: 'zh-CN env-var sentence',
    startAnchor: '### 配置托管提供商密钥',
    endAnchor: '## CLI 命令',
    tokenFor: envVarOf,
  },
  {
    // cli/release/README.md dotenv template — it documents the "complete
    // variable surface", so every gateway key must appear.
    file: 'cli/release/README.md',
    surface: 'dotenv template',
    startAnchor: '# Supported hosted gateways',
    endAnchor: '# Local Ollama override',
    tokenFor: (config) =>
      config.id === 'openrouter'
        ? 'OPENROUTER_API_KEY='
        : config.credentials.envVar
          ? `${config.credentials.envVar}=`
          : null,
  },
] as const

/**
 * Whole-file checks — the surface is a single list where a global token
 * match is unambiguous (labels / dispatch prefixes / env-var rows).
 */
const FILE_CHECKS: readonly FileCheck[] = [
  {
    // docs/index.md "Provider flexibility" feature bullet.
    file: 'docs/index.md',
    surface: 'provider-flexibility bullet',
    tokenFor: (config) => config.label,
  },
  {
    // docs/sdk-overview.md model-id prefix dispatch list.
    file: 'docs/sdk-overview.md',
    surface: 'dispatch prefix list',
    tokenFor: (config) => `${config.id}/`,
  },
  {
    // docs/sdk-overview.md env-var reference row. OpenRouter's keys live on
    // their own dedicated row above the gateway row — skip it here.
    file: 'docs/sdk-overview.md',
    surface: 'env-var reference',
    tokenFor: (config) =>
      config.id === 'openrouter' ? null : envVarOf(config),
  },
  {
    // docs/installation.md provider table (command column).
    file: 'docs/installation.md',
    surface: 'provider table',
    tokenFor: (config) => `/provider ${config.id}`,
  },
  {
    // docs/features.md provider list (bulleted labels).
    file: 'docs/features.md',
    surface: 'provider list',
    tokenFor: (config) => config.label,
  },
] as const

/**
 * Collect drift issues across every hand-maintained provider-doc surface.
 * Each issue names the file, the surface, the provider id, and the exact
 * missing token (or the missing anchor/file). Empty array = all current.
 */
export function handSurfaceDrift(root: string = DEFAULT_ROOT): string[] {
  const issues: string[] = []
  const providers = setupProviders()
  const fileCache = new Map<string, string | null>()
  const contentOf = (file: string): string | null => {
    if (fileCache.has(file)) return fileCache.get(file) ?? null
    let content: string | null = null
    try {
      content = readFileSync(resolve(root, file), 'utf8')
    } catch {
      content = null // missing file = drift, not a crash
    }
    fileCache.set(file, content)
    return content
  }

  for (const check of WINDOW_CHECKS) {
    const content = contentOf(check.file)
    if (content === null) {
      issues.push(`${check.file}: ${check.surface} — file missing`)
      continue
    }
    const start = content.indexOf(check.startAnchor)
    const end = content.indexOf(check.endAnchor)
    if (start === -1 || end === -1 || end < start) {
      issues.push(
        `${check.file}: ${check.surface} window anchors not found ` +
          `(${JSON.stringify(check.startAnchor)} … ${JSON.stringify(check.endAnchor)})`,
      )
      continue
    }
    const window = content.slice(start, end)
    for (const config of providers) {
      const token = check.tokenFor(config)
      if (token === null) continue
      if (!window.includes(token)) {
        issues.push(
          `${check.file}: ${check.surface} missing "${token}" for ${config.id}`,
        )
      }
    }
  }

  for (const check of FILE_CHECKS) {
    const content = contentOf(check.file)
    if (content === null) {
      issues.push(`${check.file}: ${check.surface} — file missing`)
      continue
    }
    for (const config of providers) {
      const token = check.tokenFor(config)
      if (token === null) continue
      if (!content.includes(token)) {
        issues.push(
          `${check.file}: ${check.surface} missing "${token}" for ${config.id}`,
        )
      }
    }
  }

  return issues
}
