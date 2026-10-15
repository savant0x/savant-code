/**
 * Partitioned registry entries, third split (300-line file cap).
 *
 * `registry-partitioned-2.ts` was 267/300 lines before this entry; the Tiarina
 * Cloud entry carries its probe receipt inline and would have crossed the cap,
 * so the split continues here (the runbook's rule — do not grow a partition
 * past 300). Same semantics as the earlier partitions: this module is spread
 * INTO PROVIDER_REGISTRY at module load and the registry remains the single
 * source of truth — `Object.keys` ordering is preserved (the tiarina entry
 * sorts after every entry in the second partition). `as const satisfies
 * Record<string, ProviderConfig>` type safety is enforced on the partial.
 */
import type { ProviderConfig } from './types'

export const PROVIDER_REGISTRY_PARTITION_3 = {
  tiarina: {
    id: 'tiarina',
    label: 'Tiarina Cloud',
    kind: 'gateway',
    credentials: {
      envVar: 'TIARINA_API_KEY',
      // /provider hint is part of the canonical message.
      missingKeyMessage:
        'Tiarina Cloud API key not set. Set TIARINA_API_KEY environment variable or run /provider tiarina.',
    },
    // ai.tiarina.cloud — OpenAI-compatible gateway (the AI Gateway of the
    // Indonesian PaaS; `tiarina.id` is a separate product, not this provider).
    // Live probes 2026-10-12 (FID-2026-1012-005): GET /health -> 200;
    // GET /v1/models -> 401 keyless and 200 / 19 rows authenticated (row shape
    // id/object/created/owned_by — NO window fields); keyless
    // POST /v1/chat/completions -> 401 (not an open relay); keyed
    // POST /v1/chat/completions -> 200 round-trip on glm-5.3-flash:free and
    // deepseek-v4-flash:free.
    baseUrl: 'https://ai.tiarina.cloud/v1',
    // Single protocol on the MEASURED wire: the vendor advertises "OpenAI and
    // Anthropic compatible", but keyed POST /v1/messages -> 404 under BOTH
    // `Authorization: Bearer` and `x-api-key`, and every probed Anthropic-shaped
    // prefix (/anthropic/v1/messages, /v1/anthropic/messages,
    // /claude/v1/messages) is 404 too. `openai-anthropic` would additionally
    // demand a protocolMap plus the `dual-protocol` exception for a lane the
    // vendor does not serve (fail-closed by validateProviderRegistry).
    protocol: 'openai',
    // Upstream ids are bare (`glm-5.3-flash:free`, `kimi-k3`); `strip` removes
    // only the internal `tiarina/` routing prefix — the intern/atria precedent.
    idTransform: 'strip',
    // STATIC 19-id allowlist: the keyed roster is small and audited, and 0 of
    // its 19 rows publish a window field, so a checked-in set with exact-id
    // fallback rows is the source of truth (the chatanywhere/intern
    // precedent). The `:free` and `:cloudflare` ids are separate roster
    // entries, not aliases.
    catalog: {
      source: 'static',
      modelsRef: 'tiarina',
      // FID-2026-1005-009: the roster size is a verified figure — observed
      // through the authenticated /v1/models live probe the record names as
      // the witness (console-verified: the figure is only visible behind the
      // account).
      evidence: {
        class: 'console-verified',
        source:
          'GET https://ai.tiarina.cloud/v1/models (auth) — 19 rows observed 2026-10-12, every item carrying only id/object/created/owned_by',
        verified: '2026-10-12',
        witness: 'FID-2026-1012-005 live-probe receipt',
      },
    },
    setupAvailable: true,
    domain: 'tiarina.cloud',
    order: 4,
  },
  apixo: {
    id: 'apixo',
    label: 'Apixo',
    kind: 'gateway',
    credentials: {
      // The vendor's own examples use `APIXO_API_KEY`; the operator's funded
      // credential is stored as `APIXOAI_API_KEY` in the repo-root
      // `.env.local` (loaded by cli/src/pre-init/load-dev-env.ts). The
      // registry name must be the one that resolves the key that exists.
      envVar: 'APIXOAI_API_KEY',
      // /provider hint is part of the canonical message.
      missingKeyMessage:
        'Apixo API key not set. Set APIXOAI_API_KEY environment variable or run /provider apixo.',
    },
    // api.apixoai.online — [OI]- and Anthropic-compatible gateway
    // (apixoai.online/docs). The [OI] lane serves Chat Completions at
    // /v1/chat/completions, which is the API root the protocol layer appends
    // to. Live probes 2026-10-13 (FID-2026-1013-003): GET /v1/models -> 200
    // keyless AND 200 authenticated, the two bodies byte-identical, 35 rows
    // with one uniform shape (id/object/type/created/created_at/owned_by/
    // display_name/context_window/max_output_tokens — windows published);
    // POST /v1/chat/completions -> 200 round-trip on deepseek-v4.1-flash
    // (a reasoning model: `reasoning_content` is returned and the billed
    // total_tokens exceeds prompt+completion by the reasoning tokens).
    baseUrl: 'https://api.apixoai.online/v1',
    // Single protocol on the MEASURED wire: the vendor also serves
    // /v1/messages and /v1/responses, but every model answers
    // /v1/chat/completions and that leg is proven, so `openai-anthropic`
    // would demand a protocolMap plus the `dual-protocol` exception for lanes
    // Savant does not route (the tiarina precedent: measured single wire beats
    // an advertised multi-wire).
    protocol: 'openai',
    // Upstream ids are bare (`deepseek-v4.1-flash`, `grok-4.7`); `strip`
    // removes only the internal `apixo/` routing prefix — the
    // vercel/mistral/tiarina precedent.
    idTransform: 'strip',
    // KEYLESS live catalog (probed 200 keyless 2026-10-13) — the Vercel /
    // OrcaRouter pattern, so the cli wrapper carries no `resolveKey`; a
    // resolver on a public catalog is the drift the runbook names.
    catalog: { source: 'live', url: 'https://api.apixoai.online/v1/models' },
    setupAvailable: true,
    domain: 'apixoai.online',
    order: 4,
  },
  aihubmix: {
    id: 'aihubmix',
    label: 'AIHubMix',
    kind: 'gateway',
    credentials: { envVar: 'AIHUBMIX_API_KEY' },
    // aihubmix.com — OpenAI-compatible gateway. The product request surface
    // is /v1/chat/completions; the protocol layer appends that suffix to this
    // API root. Live probes 2026-10-13: keyless GET /api/v1/models -> HTTP 200
    // with 869 rows, including 698 rows whose types contain the exact `llm`
    // token; a free chat request returned HTTP 200 with an account policy
    // response rather than a substantive completion.
    baseUrl: 'https://aihubmix.com/v1',
    protocol: 'openai',
    // Upstream model ids are bare (`coding-glm-5.3-flash-free`); strip removes
    // only the internal `aihubmix/` routing prefix before inference.
    idTransform: 'strip',
    // The richer public endpoint publishes model types and optional context /
    // output limits. The keyless and keyed bodies were byte-identical in the
    // sanitized probe, so the wrapper intentionally sends no catalog key.
    catalog: { source: 'live', url: 'https://aihubmix.com/api/v1/models' },
    // AIHubMix's documented carrier code: `APP-Code: MFSO2605` grants the
    // caller a standing 10% discount. It is a public discount code, not a
    // credential — so it is registry data, never an env var, and is sent on
    // every inference request this entry authorizes (generic factory on all
    // protocol branches, plus the DIRECT_PROVIDER bare-slug path).
    extraHeaders: { 'APP-Code': 'MFSO2605' },
    setupAvailable: true,
    domain: 'aihubmix.com',
    order: 4,
  },
} as const satisfies Record<string, ProviderConfig>
