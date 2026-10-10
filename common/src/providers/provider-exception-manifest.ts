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
