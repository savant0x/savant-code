/**
 * FID-2026-0914-003 — Stage C: the proposal generator.
 *
 * `bun run providers:propose -- <host>` generates an FID-001-shaped scaffold
 * into dev/scratchpad/ for the operator's manual curation flow: a gateway
 * catalog entry draft, a test-pin skeleton, and a docs blurb. Context-window
 * columns are marked PROVIDER-DOCS-REQUIRED (feed/research quota text is
 * seed-only — verification record #11). The script NEVER edits the registry,
 * the cli, or any shipping file — the write guard constrains output to dev/.
 *
 * Probe data is read from the latest candidates state when available; the
 * operator is expected to have run `providers:harvest --probe` first.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { assertWithinDev } from './lib/typosquat'

const CANDIDATES_STATE = 'dev/provider-candidates/candidates.json'
const SCRATCHPAD_DIR = 'dev/scratchpad/provider-proposals'

function slugForHost(host: string): string {
  return host
    .toLowerCase()
    .replace(/^api\./, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

function buildScaffold(
  host: string,
  state: Record<string, unknown> | null,
): string {
  const id = slugForHost(host)
  const envVar = `${id.replace(/-/g, '_').toUpperCase()}_API_KEY`
  const probe = state
    ? `From the last harvest: models=${JSON.stringify(state.lastProbe?.modelsCount ?? 'unknown')}`
    : 'No harvest state found — run `bun run providers:harvest --probe` first.'
  const boundaryWarning =
    state?.lastBoundary === 'open-relay-reject'
      ? `\n> ⚠️ **DO NOT CURATE — OPEN RELAY.** The ${todayStamp()}-or-later harvest measured\n> unauthenticated generation succeeding on this endpoint (LLMjacking class).\n> This host is hard-excluded from the wizard prefill; upstreaming it would\n> ship a credential-harvesting surface.\n\n`
      : ''

  return `# Provider proposal: ${host}
${boundaryWarning}
**Generated:** ${todayStamp()} by FID-2026-0914-003 Stage C
**Status:** DRAFT — requires operator curation (FID-001 flow). Nothing here
is wired into the product; this file is a working scaffold only.

## 1. Ground truth to verify by hand (feed text is a lead, never evidence)

- [ ] Official docs URL (locate; quote the exact base URL for inference)
- [ ] \`GET {base}/v1/models\` with a key → model list + ids (harvest saw: ${probe})
- [ ] Context windows per model — **PROVIDER-DOCS-REQUIRED** (never from the
      discovery feed; cite the vendor page per model)
- [ ] Free-tier shape (quota, rate limits) — cite vendor docs
- [ ] ToS data-training posture (free tier): training-consent? opt-out?
- [ ] Keyed chat round-trip (one real request through the production chain)
- [ ] Key goes into \`.env.local\` as \`${envVar}\` (never printed, never committed)

## 2. Registry entry draft (common/src/providers/registry.ts)

\`\`\`ts
// DRAFT — review against docs/archive/design/Adding New Providers.md
${JSON.stringify(
  {
    id,
    label: id,
    kind: 'gateway',
    protocol: 'openai',
    idTransform: 'keep',
    resolver: 'default',
    credentials: { envVar },
    baseUrlPlaceholder: `https://${host}/v1`,
  },
  null,
  2,
)}
\`\`\`

## 3. Static catalog skeleton (cli/src/utils/openrouter-models/static-catalogs-gateways.ts)

\`\`\`ts
// DRAFT — fill model ids + PROVIDER-DOCS-REQUIRED windows from vendor docs
export function ${id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())}Catalog() {
  return [
    // { id: '<model-id>', label: '<Label>', contextLength: PROVIDER_DOCS_REQUIRED },
  ]
}
\`\`\`

## 4. Test-pin skeleton (mirror the FID-2026-0914-001 template)

- [ ] returns exactly the curated allowlist models
- [ ] pins vendor-published context windows (values cited to vendor docs)
- [ ] picker derivation + setup derivation from the registry entry
- [ ] closed-world registry-key pin widened (+1)

## 5. Docs blurb (README provider list + docs/features.md)

> **${id}** — OpenAI-compatible gateway; free tier: VERIFY-AT-CURATION.
> Added by the discovery pipeline (${todayStamp()}); curated manually.

## 6. Operator gates (FID-001 flow)

1. Fund/verify the account if the free tier requires balance
2. Keyed gauntlet against the production chain
3. Docs sync across the 8 hand-maintained surfaces
4. FID closure + CHANGELOG entry
`
}

async function main(): Promise<number> {
  const host = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
  if (!host) {
    console.error('Usage: bun run providers:propose -- <host>')
    console.error(
      'Example: bun run providers:propose -- api.example-free.ai\n' +
        'Run `bun run providers:harvest --probe` first so the scaffold can cite probe data.',
    )
    return 2
  }

  let state: Record<string, unknown> | null = null
  const statePath = join(process.cwd(), CANDIDATES_STATE)
  if (existsSync(statePath)) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(statePath, 'utf8'))
      if (typeof parsed === 'object' && parsed !== null) {
        const outer = parsed as Record<string, unknown>
        // v1 wrapper ({_meta, hosts}) or legacy bare host map — read both.
        const map =
          typeof outer['hosts'] === 'object' && outer['hosts'] !== null
            ? (outer['hosts'] as Record<string, unknown>)
            : outer
        state =
          (map[host] as Record<string, unknown> | null | undefined) ?? null
      }
    } catch {
      state = null
    }
  }

  assertWithinDev(`${SCRATCHPAD_DIR}/${host}.md`)
  const markdown = buildScaffold(host, state)
  const absoluteDir = join(process.cwd(), SCRATCHPAD_DIR)
  mkdirSync(absoluteDir, { recursive: true })
  const filePath = join(absoluteDir, `${slugForHost(host)}-${todayStamp()}.md`)
  writeFileSync(filePath, markdown, 'utf8')
  console.log(`[propose] scaffold written: ${filePath}`)
  console.log(
    '[propose] next: hand-verify ground truth (checklist inside), then follow the FID-001 curation flow. Nothing is wired into the product by this script.',
  )
  return 0
}

process.exitCode = 1
void main().then((code) => {
  process.exitCode = code
})
