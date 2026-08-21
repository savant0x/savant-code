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
      providerId: 'opencode-go',
      kinds: ['dual-protocol'],
      owner: 'common/src/constants/model-config.ts',
      evidence: ['sdk/src/impl/model-provider/model-factories.ts'],
    },
    {
      providerId: 'commandcode',
      kinds: ['dual-protocol'],
      owner: 'common/src/constants/model-config.ts',
      evidence: ['sdk/src/impl/model-provider/model-factories.ts'],
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
      providerId: 'cloudflare',
      kinds: ['extra-credentials', 'id-rewrite', 'setup-exclusion'],
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
