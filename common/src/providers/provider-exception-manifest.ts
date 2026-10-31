/**
 * Provider exception manifest (FID-2026-0809-008).
 *
 * Explicit owners/evidence for every current exception derived from registry
 * metadata. Adding a new exceptional field requires updating this manifest.
 */

export type ProviderExceptionKind =
  | 'credential-resolver'
  | 'live-catalog'
  | 'dual-protocol'
  | 'multi-protocol'
  | 'extra-credentials'
  | 'id-rewrite'
  | 'local-runtime'
  | 'setup-exclusion'

export type ProviderExceptionManifestEntry = {
  providerId: string
  kinds: readonly ProviderExceptionKind[]
  owner: string
  evidence: readonly string[]
}

/**
 * Explicit owners/evidence for every current exception derived from registry
 * metadata. Adding a new exceptional field requires updating this manifest.
 */
export const PROVIDER_EXCEPTION_MANIFEST: readonly ProviderExceptionManifestEntry[] =
  [
    {
      // FID-2026-1030-004: KEYLESS live catalog (public GET /v1/models, HTTP
      // 200 and 23 coding rows measured 2026-10-30) with a dedicated
      // display_name/context_window/max_output_tokens parser. The catalog body
      // is public; inference still resolves HYPER_API_KEY through the generic
      // registry factory.
      providerId: 'hyper',
      kinds: ['live-catalog'],
      owner: 'cli/src/utils/openrouter-models/hyper.ts',
      evidence: [
        'cli/src/utils/openrouter-models/hyper.ts',
        'cli/src/utils/openrouter-models/gateway.ts',
        'cli/src/utils/openrouter-models/gateway-catalog-merge.ts',
      ],
    },
    {
      providerId: 'zylo',
      kinds: ['live-catalog'],
      owner: 'cli/src/utils/openrouter-models/zylo.ts',
      evidence: [
        'cli/src/utils/openrouter-models/zylo.ts',
        'cli/src/utils/openrouter-models/gateway-live-results.ts',
        'cli/src/utils/openrouter-models/gateway-catalog-merge.ts',
      ],
    },
    {
      providerId: 'blazerail',
      kinds: ['live-catalog'],
      owner: 'cli/src/utils/openrouter-models/blazerail.ts',
      evidence: [
        'cli/src/utils/openrouter-models/blazerail.ts',
        'cli/src/utils/openrouter-models/gateway-live-results.ts',
        'cli/src/utils/openrouter-models/gateway-catalog-merge.ts',
      ],
    },
    {
      // FID-2026-1017-015: authenticated River catalog publishes ids but
      // no context-window fields.
      providerId: 'river',
      kinds: ['live-catalog'],
      owner: 'cli/src/utils/openrouter-models/river.ts',
      evidence: [
        'cli/src/utils/openrouter-models/river.ts',
        'cli/src/utils/openrouter-models/gateway.ts',
        'common/src/constants/context-window-table-river.ts',
      ],
    },
    {
      providerId: 'codecraft',
      kinds: ['live-catalog'],
      owner: 'cli/src/utils/openrouter-models/codecraft.ts',
      evidence: [
        'cli/src/utils/openrouter-models/codecraft.ts',
        'cli/src/utils/openrouter-models/gateway.ts',
      ],
    },
    {
      // FID-2026-1009-005: authenticated live catalog (401 keyless, probed
      // 2026-10-09) with a dedicated max_context_length parser.
      providerId: 'mistral',
      kinds: ['live-catalog'],
      owner: 'cli/src/utils/openrouter-models/mistral.ts',
      evidence: [
        'cli/src/utils/openrouter-models/mistral.ts',
        'cli/src/utils/openrouter-models/gateway.ts',
      ],
    },
    {
      providerId: 'xkiro',
      kinds: ['live-catalog', 'multi-protocol'],
      owner: 'cli/src/utils/openrouter-models/xkiro.ts',
      evidence: [
        'cli/src/utils/openrouter-models/xkiro.ts',
        'cli/src/utils/openrouter-models/gateway.ts',
        'common/src/constants/model-config/provider-protocols.ts',
        'sdk/src/impl/model-provider/model-factories.ts',
      ],
    },
    {
      providerId: 'openrouter',
      kinds: ['credential-resolver', 'live-catalog'],
      owner: 'sdk/src/impl/openrouter-key-resolver.ts',
      evidence: [
        'sdk/src/impl/openrouter-key-resolver.ts',
        'cli/src/utils/openrouter-models/openrouter.ts',
      ],
    },
    {
      providerId: 'nvidia',
      kinds: ['live-catalog'],
      owner: 'cli/src/utils/openrouter-models/nvidia.ts',
      evidence: ['cli/src/utils/openrouter-models/nvidia.ts'],
    },
    {
      providerId: 'commandcode',
      kinds: ['dual-protocol'],
      owner: 'common/src/constants/model-config.ts',
      evidence: [
        'sdk/src/impl/model-provider/model-factories.ts',
        // FID-2026-0928-010: live vendor rosters — the provider's own
        // catalog surface and the casing/window probe evidence.
        'common/src/constants/model-config/providers.ts',
      ],
    },
    {
      providerId: 'nous',
      kinds: ['live-catalog'],
      owner: 'cli/src/utils/openrouter-models/nous.ts',
      evidence: [
        'cli/src/utils/openrouter-models/nous.ts',
        'cli/src/utils/openrouter-models/gateway.ts',
      ],
    },
    {
      providerId: 'kiosapi',
      kinds: ['live-catalog'],
      owner: 'cli/src/utils/openrouter-models/kiosapi.ts',
      evidence: [
        'cli/src/utils/openrouter-models/kiosapi.ts',
        'cli/src/utils/openrouter-models/gateway.ts',
      ],
    },
    {
      providerId: 'apinex',
      kinds: ['live-catalog'],
      owner: 'cli/src/utils/openrouter-models/apinex.ts',
      evidence: [
        'cli/src/utils/openrouter-models/apinex.ts',
        'cli/src/utils/openrouter-models/gateway.ts',
      ],
    },
    {
      providerId: 'orcarouter',
      kinds: ['live-catalog'],
      owner: 'cli/src/utils/openrouter-models/orcarouter.ts',
      evidence: [
        'cli/src/utils/openrouter-models/orcarouter.ts',
        'cli/src/utils/openrouter-models/gateway.ts',
      ],
    },
    {
      providerId: 'bai',
      kinds: ['live-catalog'],
      owner: 'cli/src/utils/openrouter-models/bai.ts',
      evidence: [
        'cli/src/utils/openrouter-models/bai.ts',
        'cli/src/utils/openrouter-models/gateway.ts',
      ],
    },
    {
      providerId: 'vercel',
      kinds: ['live-catalog'],
      owner: 'cli/src/utils/openrouter-models/vercel.ts',
      evidence: [
        'cli/src/utils/openrouter-models/vercel.ts',
        'cli/src/utils/openrouter-models/gateway.ts',
      ],
    },
    {
      providerId: 'cleanapis',
      kinds: ['live-catalog'],
      owner: 'cli/src/utils/openrouter-models/cleanapis.ts',
      evidence: [
        'cli/src/utils/openrouter-models/cleanapis.ts',
        'cli/src/utils/openrouter-models/gateway.ts',
      ],
    },
    {
      // FID-2026-1001-001: platform /v1/models wrapper (Nous/apinex pattern).
      providerId: 'openai',
      kinds: ['live-catalog'],
      owner: 'cli/src/utils/openrouter-models/openai.ts',
      evidence: [
        'cli/src/utils/openrouter-models/openai.ts',
        'cli/src/utils/openrouter-models/gateway.ts',
      ],
    },
    {
      // FID-2026-1013-003: KEYLESS live catalog (200 keyless and 200
      // authenticated with byte-identical bodies, probed 2026-10-13) with a
      // dedicated context_window/max_output_tokens parser — the Vercel
      // pattern, so no credential resolver is implied.
      providerId: 'apixo',
      kinds: ['live-catalog'],
      owner: 'cli/src/utils/openrouter-models/apixo.ts',
      evidence: [
        'cli/src/utils/openrouter-models/apixo.ts',
        'cli/src/utils/openrouter-models/gateway.ts',
      ],
    },
    {
      // FID-2026-1013-004: keyless rich catalog (HTTP 200 with 869 rows,
      // probed 2026-10-13) with a dedicated model_id/types parser. The
      // catalog body is public; inference still resolves AIHUBMIX_API_KEY
      // through the generic registry factory.
      providerId: 'aihubmix',
      kinds: ['live-catalog'],
      owner: 'cli/src/utils/openrouter-models/aihubmix.ts',
      evidence: [
        'cli/src/utils/openrouter-models/aihubmix.ts',
        'cli/src/utils/openrouter-models/gateway.ts',
      ],
    },
    {
      // FID-2026-1012-026: public ids-only catalog; windows come from the
      // measured Tier 1 fallback rows because the endpoint publishes none.
      providerId: 'deepinfra',
      kinds: ['live-catalog'],
      owner: 'cli/src/utils/openrouter-models/deepinfra.ts',
      evidence: [
        'cli/src/utils/openrouter-models/deepinfra.ts',
        'cli/src/utils/openrouter-models/gateway.ts',
        'common/src/constants/model-config/tier1.ts',
      ],
    },
    {
      // FID-2026-1012-026: public catalog with context_length on every
      // measured row; runtime windows are authoritative.
      providerId: 'venice',
      kinds: ['live-catalog'],
      owner: 'cli/src/utils/openrouter-models/venice.ts',
      evidence: [
        'cli/src/utils/openrouter-models/venice.ts',
        'cli/src/utils/openrouter-models/gateway.ts',
      ],
    },
    {
      // FID-2026-1016-018: keyed ids-only catalog (401 keyless); windows
      // come from the cross-gateway consensus seam because the endpoint
      // publishes none.
      providerId: 'ashna',
      kinds: ['live-catalog'],
      owner: 'cli/src/utils/openrouter-models/ashna.ts',
      evidence: [
        'cli/src/utils/openrouter-models/ashna.ts',
        'cli/src/utils/openrouter-models/gateway.ts',
        'common/src/constants/context-window-table-ashna.ts',
      ],
    },
    {
      providerId: 'tokenrouter',
      kinds: ['multi-protocol'],
      owner: 'common/src/constants/model-config/provider-protocols.ts',
      evidence: [
        'common/src/constants/model-config/provider-protocols.ts',
        'sdk/src/impl/model-provider/model-factories.ts',
        'dev/fids/archive/FID-2026-0916-002-catalog-window-truth.md',
      ],
    },
    {
      // T61 Option A (FID-2026-0928-008): the 'setup-exclusion' kind was
      // removed — the setup seam now carries credentials.extra
      // (ProviderSetupInfo.extraEnvVars) and cloudflare is setup-surfaced.
      providerId: 'cloudflare',
      kinds: ['extra-credentials', 'id-rewrite'],
      owner: 'sdk/src/impl/model-provider/model-factories.ts',
      evidence: [
        'sdk/src/impl/model-provider/model-factories.ts',
        'cli/src/utils/provider-setup.ts',
      ],
    },
    {
      providerId: 'ollama',
      kinds: ['local-runtime', 'setup-exclusion'],
      owner: 'cli/src/utils/ollama-onboarding.ts',
      evidence: [
        'cli/src/utils/ollama-onboarding.ts',
        'packages/llm-providers/src/ollama/detect.ts',
      ],
    },
  ] as const
