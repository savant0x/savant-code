export const CANONICAL_NEXT_PUBLIC_DEFAULTS: Record<string, string> = {
  NEXT_PUBLIC_CB_ENVIRONMENT: 'prod',
  NEXT_PUBLIC_SAVANT_CODE_APP_URL: 'https://savant-code.com',
  NEXT_PUBLIC_WEB_PORT: '3000',
  NEXT_PUBLIC_SUPPORT_EMAIL: 'support@savant-code.com',
  NEXT_PUBLIC_POSTHOG_API_KEY: 'phc_release_placeholder',
  NEXT_PUBLIC_POSTHOG_HOST_URL: 'https://us.i.posthog.com',
  NEXT_PUBLIC_GRAVITY_PIXEL_ID: '00000000-0000-0000-0000-000000000000',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_release_placeholder',
  NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL: 'https://savant-code.com/portal',
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID: 'release_placeholder',
}

export const CANONICAL_RELEASE_RUNTIME_DEFAULTS: Record<string, string> = {
  DIRECT_PROVIDER: 'openrouter',
  INFERENCE_BASE_URL: 'https://openrouter.ai/api/v1',
  SAVANT_CODE_DEFAULT_MODEL_ID: 'openrouter/free',
}

export function getReleaseRuntimeDefaults(
  binaryName: string,
): Record<string, string> {
  return binaryName === 'savant-free'
    ? {}
    : { ...CANONICAL_RELEASE_RUNTIME_DEFAULTS }
}

export interface BinaryEnvLeak {
  key: string
  expected: string
  actual: string
}

export interface EnvIntegrityDecision {
  block: boolean
  warning: string | null
  reason: 'dev-build' | 'override' | null
  leaks: BinaryEnvLeak[]
}

export function evaluateBinaryEnvIntegrity(
  binaryEnv: Record<string, string>,
  canonicalDefaults: Record<string, string>,
  options: { devBuild?: boolean; allowOverrides?: boolean } = {},
): EnvIntegrityDecision {
  const leaks = findBinaryEnvLeaks(binaryEnv, canonicalDefaults)
  const devBuild = options.devBuild ?? false
  const allowOverrides = options.allowOverrides ?? false

  if (leaks.length > 0 && !devBuild && !allowOverrides) {
    return { block: true, warning: null, reason: null, leaks }
  }

  const accepted = leaks.length > 0
  return {
    block: false,
    warning: accepted
      ? `⚠️  ${leaks.length} NEXT_PUBLIC_* override(s) accepted (${
          devBuild ? 'dev build' : 'explicit override'
        }):\n` +
        leaks.map(({ key, actual }) => `  ${key} = "${actual}"`).join('\n')
      : null,
    reason: accepted ? (devBuild ? 'dev-build' : 'override') : null,
    leaks,
  }
}

export function findBinaryEnvLeaks(
  binaryEnv: Record<string, string>,
  canonicalDefaults: Record<string, string>,
): BinaryEnvLeak[] {
  const leaks: BinaryEnvLeak[] = []

  for (const [key, actual] of Object.entries(binaryEnv)) {
    if (!key.startsWith('NEXT_PUBLIC_')) continue
    const expected = canonicalDefaults[key]
    if (expected === undefined) {
      leaks.push({ key, expected: '<none>', actual })
    } else if (actual !== expected) {
      leaks.push({ key, expected, actual })
    }
  }

  for (const key of Object.keys(canonicalDefaults)) {
    if (!key.startsWith('NEXT_PUBLIC_')) continue
    if (binaryEnv[key] === undefined) {
      leaks.push({ key, expected: canonicalDefaults[key], actual: '<unset>' })
    }
  }

  return leaks
}
