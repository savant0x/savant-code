/**
 * Partitioned registry entries, second split (300-line file cap).
 *
 * `registry-partitioned.ts` reached 298/300 lines before this entry, so the
 * split continues here. Same semantics as the first partition: this module is
 * spread INTO PROVIDER_REGISTRY at module load and the registry remains the
 * single source of truth — `Object.keys` ordering is preserved (the vercel
 * entry sorts after every entry in the first partition). `as const satisfies
 * Record<string, ProviderConfig>` type safety is enforced on each exported
 * partial.
 */
import type { ProviderConfig } from './types'

export const PROVIDER_REGISTRY_PARTITION_2 = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    kind: 'gateway',
    credentials: {
      envVar: 'OPENAI_API_KEY',
      // Platform key (api.openai.com) — a SEPARATE credential class from the
      // ChatGPT-subscription OAuth lane (common/src/constants/chatgpt-oauth.ts,
      // /connect chatgpt → chatgpt.com/backend-api/codex). Both lanes coexist:
      // the OAuth gate precedes the registry loop for its allowlisted models.
      missingKeyMessage:
        'OpenAI API key not set. Set OPENAI_API_KEY environment variable or run /provider openai.',
    },
    // api.openai.com serves the Responses API for reasoning models with
    // tools (chat/completions returns HTTP 400 there for that shape —
    // contract documented by the vendored hermes regression suite,
    // test_model_switch_openai_api_mode.py:5-9). Single protocol, no
    // protocolMap: resolveProtocol's no-map path returns it and the
    // factory's existing createOpenAI().responses() branch dispatches.
    baseUrl: 'https://api.openai.com/v1',
    protocol: 'responses',
    // Upstream ids are BARE (`gpt-5.3-codex`); `strip` removes only the
    // internal `openai/` routing prefix — the vercel/apinex/cleanapis
    // precedent. (`openrouter/openai/…` gateway slugs are untouched: they
    // route by the openrouter prefix, never reaching this entry.)
    idTransform: 'strip',
    // Live catalog: the roster moves weekly; a checked-in static map would
    // drift (FID-2026-1001-001 decision). Served keyless too, but Bearer
    // returns the account-visible roster — the resolveKey seam (Nous/
    // apinex pattern) wires OPENAI_API_KEY in the cli wrapper.
    catalog: { source: 'live', url: 'https://api.openai.com/v1/models' },
    setupAvailable: true,
    domain: 'openai.com',
    order: 0,
  },
  vercel: {
    id: 'vercel',
    label: 'Vercel AI Gateway',
    kind: 'gateway',
    credentials: {
      envVar: 'AI_GATEWAY_API_KEY',
      // /provider hint is part of the canonical message (the provider is
      // setup-available; the masked `/provider vercel` store is the second
      // credential path — operator ruling 2026-09-27).
      missingKeyMessage:
        'Vercel AI Gateway API key not set. Set AI_GATEWAY_API_KEY environment variable or run /provider vercel.',
    },
    // vercel.com/docs/ai-gateway: OpenAI Chat Completions at
    // https://ai-gateway.vercel.sh/v1/chat/completions with
    // `Authorization: Bearer $AI_GATEWAY_API_KEY` (the documented curl
    // contract); the gateway normalizes every upstream model behind this
    // surface, so no per-model protocol map is needed.
    baseUrl: 'https://ai-gateway.vercel.sh/v1',
    protocol: 'openai',
    // Upstream ids are vendor-namespaced WITH slashes (alibaba/qwen-3-14b,
    // openai/gpt-6-astra); `strip` removes only the internal `vercel/`
    // routing prefix — apinex/orcarouter precedent.
    idTransform: 'strip',
    // Keyless live catalog (probed HTTP 200 keyless, 391 models, OpenAI list
    // shape with gateway fields: context_window/max_tokens) — the OrcaRouter
    // pattern; no resolver wire-in.
    catalog: { source: 'live', url: 'https://ai-gateway.vercel.sh/v1/models' },
    setupAvailable: true,
    domain: 'vercel.com',
    order: 4,
  },
  cleanapis: {
    id: 'cleanapis',
    label: 'Clean APIs',
    kind: 'gateway',
    credentials: {
      envVar: 'CLEANAPIS_API_KEY',
      // setup-available, so the masked `/provider cleanapis` store is the
      // second credential path (shell precedence per FID-2026-0804-001).
      missingKeyMessage:
        'Clean APIs API key not set. Set CLEANAPIS_API_KEY environment variable or run /provider cleanapis.',
    },
    // cleanapis.com advertises an OpenAI-compatible surface and opencode /
    // Claude Code as first-class clients, so the standard OpenAI Chat
    // Completions path at https://cleanapis.com/v1/chat/completions applies;
    // the protocol layer appends the suffix. Probed keyless:
    // `GET /v1/models` -> 401, i.e. the route exists and is auth-gated.
    baseUrl: 'https://cleanapis.com/v1',
    protocol: 'openai',
    // Model ids are served BARE (`gpt-5.6-luna`, not `openai/gpt-5.6-luna`),
    // so `strip` removes only the internal `cleanapis/` picker prefix and
    // leaves the upstream id intact — the vercel/apinex precedent.
    idTransform: 'strip',
    // AUTHENTICATED live catalog (probed 401 keyless) — the Nous / KiosAPI
    // pattern, so this needs a `resolveKey` wiring in
    // `cli/src/utils/openrouter-models/cleanapis.ts`; a keyless `url`-only
    // entry would silently never populate.
    catalog: { source: 'live', url: 'https://cleanapis.com/v1/models' },
    setupAvailable: true,
    domain: 'cleanapis.com',
    order: 4,
  },
} as const satisfies Record<string, ProviderConfig>
